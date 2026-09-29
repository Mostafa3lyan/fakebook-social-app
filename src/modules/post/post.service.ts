// post.service.ts
import { FlattenMaps, HydratedDocument, Types } from "mongoose";
import { PostRepository, UserRepository } from "../../DB/repository";
import { BadRequestException, ForbiddenException, NotFoundException } from "../../common/exceptions";
import { notificationsService, NotificationsService, redisService, RedisService, s3Service, S3Service, TokenService } from "../../common/services";
import { CreatePostDto, ReactAtPostDto, PostIdParamDto, UpdatePostDto } from "./post.validation";
import { randomUUID } from "node:crypto";
import { IPagination, IPost, IUser } from "../../common/interfaces";
import { escapeRegex, getVisibility } from "../../common/utils/helpers/post";
import { PaginationDto } from "../../common/validation";


class PostService {
  private readonly redis: RedisService;
  private readonly tokenService: TokenService;
  private readonly userRepository: UserRepository;
  private readonly postRepository: PostRepository;
  private readonly notificationsService: NotificationsService;
  private readonly s3: S3Service;


  // constructor
  constructor() {
    this.redis = redisService; // reuse the singleton
    this.tokenService = new TokenService();
    this.postRepository = new PostRepository();
    this.userRepository = new UserRepository();
    this.notificationsService = notificationsService;
    this.s3 = s3Service;
  }

  async createPost(dto: CreatePostDto, files: Express.Multer.File[], user: HydratedDocument<IUser>) {
    const { content, visibility, tags, location } = dto;

    const mentions: Types.ObjectId[] = [];
    if (tags?.length) {
      const mentionedAccounts = await this.userRepository.find({
        filter: { _id: { $in: tags } },
        options: { lean: true },
      });
      if (mentionedAccounts.length !== tags.length) {
        throw new NotFoundException("One or more tagged users not found");
      }
      mentions.push(...tags);
    }

    const folderId = randomUUID();
    let attachments: string[] = [];
    if (files?.length > 10) {
      throw new BadRequestException("Maximum 10 attachments allowed");
    }
    if (files?.length) {
      attachments = await this.s3.uploadMultipleAssets({ files, path: `posts/${folderId}` });
    }

    let post: HydratedDocument<IPost>;
    try {
      post = await this.postRepository.createOne({
        data: { createdBy: user._id, content, visibility, tags: mentions, location, folderId, attachments },
      });
    } catch (err) {
      if (attachments.length) {
        await this.s3.deleteMultipleAssets({ keys: attachments });
      }
      throw err;
    }

    if (mentions.length) {
      const results = await Promise.allSettled(
        mentions.map((recipientId) =>
          this.notificationsService.notifyNewMessage({
            recipientId: recipientId.toString(),
            message: `${user.firstName} ${user.lastName} tagged you in a post`,
          }),
        ),
      );

      if (results.some((result) => result.status === "rejected")) {
        throw new NotFoundException("One or more tagged users not found");
      }
    }

    return post;
  }

  async getPosts({ page, limit, search }: PaginationDto, user: HydratedDocument<IUser>): Promise<IPagination<FlattenMaps<IPost>>> {
    const posts = await this.postRepository.paginate({
      filter: {
        $or: getVisibility(user),
        ...(search && { content: { $regex: escapeRegex(search), $options: "i" } }),
      },
      populate: [{ path: "createdBy", select: "firstName lastName profilePicture" }],
      projection: { reactions: 0, folderId: 0 },
      page,
      limit,
      sort: { createdAt: -1 },
    });

    return posts;
  }

  async getPostById({ postId }: PostIdParamDto, user: HydratedDocument<IUser>): Promise<FlattenMaps<IPost>> {
    const post = await this.postRepository.findOne({
      filter: { _id: postId, $or: getVisibility(user) },
      populate: [{ path: "createdBy", select: "firstName lastName profilePicture" }],
      projection: { folderId: 0 },
    });

    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  async updatePost(
    dto: UpdatePostDto,
    files: Express.Multer.File[],
    { postId }: PostIdParamDto,
    user: HydratedDocument<IUser>,
  ) {
    const { content, visibility, tags, location, removeAttachments = [] } = dto;

    const post = await this.postRepository.findById({ id: postId });
    if (!post) throw new NotFoundException("Post not found");

    if (post.createdBy.toString() !== user._id.toString()) {
      throw new ForbiddenException("You are not allowed to update this post");
    }

    // ── resolve attachments: survivors (after removal) + any newly uploaded files ──
    const willHaveNewAttachments = files?.length > 0;
    const willRemoveAttachments = (removeAttachments?.length ?? 0) > 0;

    const survivors = willRemoveAttachments
      ? (post.attachments ?? []).filter((key) => !removeAttachments.includes(key))
      : (post.attachments ?? []);

    // ── content-or-attachment invariant, checked against the resulting state ──
    const resultingContent = content ?? post.content;
    const resultingAttachmentsCount = survivors.length + (willHaveNewAttachments ? files.length : 0);

    if (!resultingContent && resultingAttachmentsCount === 0) {
      throw new BadRequestException("Post must have either content or at least one attachment");
    }

    if (resultingAttachmentsCount > 10) {
      throw new BadRequestException("Maximum 10 attachments allowed");
    }

    // ── tags: undefined = untouched, [] = clear, [...] = replace ──
    const tagsProvided = tags !== undefined;
    let mentions: Types.ObjectId[] | undefined;

    if (tagsProvided) {
      if (tags.length === 0) {
        mentions = [];
      } else {
        const mentionedAccounts = await this.userRepository.find({
          filter: { _id: { $in: tags } },
        });
        if (mentionedAccounts.length !== tags.length) {
          throw new NotFoundException("One or more tagged users not found");
        }
        mentions = tags.map((id) => new Types.ObjectId(id));
      }
    }

    // ── upload new files, if any ──
    let newAttachments: string[] = [];
    if (willHaveNewAttachments) {
      newAttachments = await this.s3.uploadMultipleAssets({
        files,
        path: `posts/${post.folderId}`,
      });
    }

    const attachmentsChanged = willHaveNewAttachments || willRemoveAttachments;
    const resultingAttachments = [...survivors, ...newAttachments];

    // ── commit the DB write ──
    let updatedPost: HydratedDocument<IPost> | null;
    try {
      updatedPost = await this.postRepository.findOneAndUpdate({
        filter: { _id: postId, createdBy: user._id },
        update: {
          ...(content !== undefined && { content }),
          ...(visibility !== undefined && { visibility }),
          ...(tagsProvided && { tags: mentions }),
          ...(location !== undefined && { location }),
          ...(attachmentsChanged && { attachments: resultingAttachments }),
          updatedBy: user._id,
          isEdited: true,
        },
      });
    } catch (err) {
      if (newAttachments.length) {
        await this.s3.deleteMultipleAssets({ keys: newAttachments });
      }
      throw err;
    }

    if (!updatedPost) {
      if (newAttachments.length) {
        await this.s3.deleteMultipleAssets({ keys: newAttachments });
      }
      throw new NotFoundException("Post not found");
    }

    // ── cleanup: only delete the specific keys that were actually removed ──
    if (willRemoveAttachments) {
      const actuallyRemoved = (post.attachments ?? []).filter((key) => removeAttachments.includes(key));
      if (actuallyRemoved.length) {
        await this.s3.deleteMultipleAssets({ keys: actuallyRemoved });
      }
    }

    // ── notify only users newly added to tags, not everyone in the final list ──
    if (mentions?.length) {
      const newlyTagged = mentions.filter(
        (id) => !post.tags?.some((existing) => existing.toString() === id.toString()),
      );
      if (newlyTagged.length) {
        await Promise.allSettled(
          newlyTagged.map((recipientId) =>
            this.notificationsService.notifyNewMessage({
              recipientId: recipientId.toString(),
              message: `${user.firstName} ${user.lastName} tagged you in a post`,
            }),
          ),
        );
      }
    }

    return updatedPost;
  }

  async reactAtPost({ reaction }: ReactAtPostDto, { postId }: PostIdParamDto, user: HydratedDocument<IUser>) {
    const post = await this.postRepository.findById({ id: postId });
    if (!post) throw new NotFoundException("Post not found");

    const existingReaction = post.reactions?.find(
      (r) => r.createdBy.toString() === user._id.toString()
    );

    if (existingReaction?.reactionType === reaction) {
      await this.postRepository.updateOne({
        filter: { _id: postId },
        update: {
          $pull: { reactions: { createdBy: user._id } },
          $inc: { reactionsCount: -1, [`reactionsBreakdown.${reaction}`]: -1 },
        },
      });
    } else {
      if (existingReaction) {
        await this.postRepository.updateOne({
          filter: { _id: postId },
          update: {
            $pull: { reactions: { createdBy: user._id } },
            $inc: { reactionsCount: -1, [`reactionsBreakdown.${existingReaction.reactionType}`]: -1 },
          },
        });
      }
      await this.postRepository.updateOne({
        filter: { _id: postId },
        update: {
          $push: { reactions: { reactionType: reaction, createdBy: user._id, createdAt: new Date() } },
          $inc: { reactionsCount: 1, [`reactionsBreakdown.${reaction}`]: 1 },
        },
      });
    }

    const updatedPost = await this.postRepository.findById({
      id: postId,
      projection: { reactionsCount: 1, reactionsBreakdown: 1 },
    });

    if (!updatedPost) throw new NotFoundException("Post not found");

    return updatedPost;
  }

  async softDeletePost({ postId, userId }: { postId: string; userId: Types.ObjectId }) {
    const post = await this.postRepository.findOneAndUpdate({
      filter: { _id: postId },
      update: { deletedAt: new Date(), updatedBy: userId },
    });

    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  async restorePost({ postId, userId }: { postId: string; userId: Types.ObjectId }) {
    const post = await this.postRepository.findOneAndUpdate({
      filter: { _id: postId, paranoid: false } as any,
      update: { restoredAt: new Date(), updatedBy: userId },
    });

    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  async hardDeletePost({ postId }: { postId: string }) {
    const post = await this.postRepository.findOneAndDelete({
      filter: { _id: postId, force: true } as any,
    });

    if (!post) throw new NotFoundException("Post not found");
    return post;
  }
}

export const postService = new PostService();