// post.service.ts
import { FlattenMaps, HydratedDocument, Types } from "mongoose";
import { PostRepository, UserRepository } from "../../DB/repository";
import { NotFoundException } from "../../common/exceptions";
import { notificationsService, NotificationsService, redisService, RedisService, s3Service, S3Service, TokenService } from "../../common/services";
import { CreatePostDto, ReactAtPostDto, ReactAtPostParamsDto, UpdatePostDto } from "./post.validation";
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

      for (const tag of tags) {
        mentions.push(tag);
      }
    }

    const folderId = randomUUID();
    let attachments: string[] = [];
    if (files?.length) {
      attachments = await this.s3.uploadMultipleAssets({
        files,
        path: `posts/${folderId}`,
      });
    }

    const post = await this.postRepository.createOne({
      data: {
        createdBy: user._id,
        content,
        visibility,
        tags: mentions,
        location,
        folderId,
        attachments,
      },
    });

    if (!post) {
      if (attachments.length) {
        await this.s3.deleteMultipleAssets({
          keys: attachments,
        });
      }
      throw new NotFoundException("Post not created");
    }

    if (mentions.length) {
      await Promise.all(
        mentions.map((recipientId) =>
          this.notificationsService.notifyNewMessage({
            recipientId: recipientId.toString(),
            message: `${user.firstName} ${user.lastName} tagged you in a post`,
          }),
        ),
      );
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

  async getPostById(id: string): Promise<FlattenMaps<IPost>> {
    const post = await this.postRepository.findById({
      id,
      populate: [{ path: "createdBy", select: "firstName lastName profilePicture" }],
      projection: { folderId: 0 },
    });

    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  async updatePost({
    postId,
    dto,
    userId,
  }: {
    postId: string;
    dto: UpdatePostDto;
    userId: Types.ObjectId;
  }) {
    const post = await this.postRepository.findByIdAndUpdate({
      id: postId,
      update: { ...dto, updatedBy: userId, isEdited: true },
    });

    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  async reactAtPost({ reaction }: ReactAtPostDto, { id }: ReactAtPostParamsDto, user: HydratedDocument<IUser>) {
    const post = await this.postRepository.findById({ id });
    if (!post) throw new NotFoundException("Post not found");

    const existingReaction = post.reactions?.find(
      (r) => r.createdBy.toString() === user._id.toString()
    );

    if (existingReaction?.reactionType === reaction) {
      await this.postRepository.updateOne({
        filter: { _id: id },
        update: {
          $pull: { reactions: { createdBy: user._id } },
          $inc: { reactionsCount: -1, [`reactionsBreakdown.${reaction}`]: -1 },
        },
      });
    } else {
      if (existingReaction) {
        await this.postRepository.updateOne({
          filter: { _id: id },
          update: {
            $pull: { reactions: { createdBy: user._id } },
            $inc: { reactionsCount: -1, [`reactionsBreakdown.${existingReaction.reactionType}`]: -1 },
          },
        });
      }
      await this.postRepository.updateOne({
        filter: { _id: id },
        update: {
          $push: { reactions: { reactionType: reaction, createdBy: user._id, createdAt: new Date() } },
          $inc: { reactionsCount: 1, [`reactionsBreakdown.${reaction}`]: 1 },
        },
      });
    }

    const updatedPost = await this.postRepository.findById({
      id,
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