// post.service.ts
import { randomUUID } from "node:crypto";
import { FlattenMaps, HydratedDocument, Types } from "mongoose";
import { CommentRepository, PostRepository } from "../../DB/repository";
import { BadRequestException, ForbiddenException, NotFoundException } from "../../common/exceptions";
import { s3Service, S3Service } from "../../common/services";
import { IPagination, IPost, IUser } from "../../common/interfaces";
import { escapeRegex } from "../../common/utils";
import {
  AUTHOR_POPULATE,
  getVisibility,
  PostHelper,
  postHelper,
} from "./post.helper";
import { PaginationDto } from "../../common/validation";
import { CreatePostDto, PostIdParamDto, ReactAtPostDto, UpdatePostDto } from "./post.validation";
import { PostVisibilityEnum, ReactionTypeEnum, RoleEnum } from "../../common/enums";

class PostService {
  private readonly MAX_ATTACHMENTS = 10;

  private readonly postRepository: PostRepository;
  private readonly commentRepository: CommentRepository;
  private readonly s3: S3Service;
  private readonly postHelper: PostHelper;

  constructor(
    postRepository = new PostRepository(),
    commentRepository = new CommentRepository(),
    s3 = s3Service,
    postHelperInstance = postHelper,
  ) {
    this.postRepository = postRepository;
    this.commentRepository = commentRepository;
    this.s3 = s3;
    this.postHelper = postHelperInstance;
  }

  // Private helpers

  private removeReaction(postId: string, userId: Types.ObjectId, reactionType: ReactionTypeEnum) {
    return this.postRepository.updateOne({
      filter: { _id: postId },
      update: {
        $pull: { reactions: { createdBy: userId } },
        $inc: { reactionsCount: -1, [`reactionsBreakdown.${reactionType}`]: -1 },
      },
    });
  }

  private addReaction(postId: string, userId: Types.ObjectId, reactionType: string) {
    return this.postRepository.updateOne({
      filter: { _id: postId },
      update: {
        $push: { reactions: { reactionType, createdBy: userId, createdAt: new Date() } },
        $inc: { reactionsCount: 1, [`reactionsBreakdown.${reactionType}`]: 1 },
      },
    });
  }

  // Create

  async createPost(dto: CreatePostDto, files: Express.Multer.File[] = [], user: HydratedDocument<IUser>) {
    const { content, visibility, tags, location } = dto;

    if (files.length > this.MAX_ATTACHMENTS) {
      throw new BadRequestException(`Maximum ${this.MAX_ATTACHMENTS} attachments allowed`);
    }

    const mentions = tags?.length ? await this.postHelper.resolveMentions(tags) : [];

    const folderId = randomUUID();
    const attachments = files.length
      ? await this.s3.uploadMultipleAssets({ files, path: `posts/${folderId}` })
      : [];

    let post: HydratedDocument<IPost>;
    try {
      post = await this.postRepository.createOne({
        data: { createdBy: user._id, content, visibility, tags: mentions, location, folderId, attachments },
      });
    } catch (err) {
      await this.postHelper.safeDeleteAssets(attachments);
      throw err;
    }

    await this.postHelper.notifyNewlyTagged(undefined, mentions, user, "post");

    return post;
  }

  // Read

  async getPosts(
    { page, limit, search }: PaginationDto,
    user: HydratedDocument<IUser>,
  ): Promise<IPagination<FlattenMaps<IPost>>> {
    return this.postRepository.paginate({
      filter: {
        $or: getVisibility(user),
        ...(search && { content: { $regex: escapeRegex(search), $options: "i" } }),
      },
      populate: AUTHOR_POPULATE,
      projection: { reactions: 0, comments: 0 },
      page,
      limit,
      sort: { createdAt: -1 },
    });
  }

  async getPostById({ postId }: PostIdParamDto, user: HydratedDocument<IUser>): Promise<FlattenMaps<IPost>> {
    const post = await this.postRepository.findOne({
      filter: { _id: postId, $or: getVisibility(user) },
      populate: AUTHOR_POPULATE,
    });

    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  async sharePost({ postId }: PostIdParamDto, user: HydratedDocument<IUser>) {
    const post = await this.postRepository.findById({ id: postId });
    if (!post) throw new NotFoundException("Post not found");

    if (post.visibility !== PostVisibilityEnum.PUBLIC) throw new ForbiddenException("You are not allowed to share this post");
    if (post.createdBy.toString() === user._id.toString()) throw new BadRequestException("You are not allowed to share your own post");

    const sharedPost = await this.postRepository.createOne({
      data: { createdBy: user._id, content: post.content, visibility: post.visibility, tags: post.tags, location: post.location, folderId: post.folderId, attachments: post.attachments },
    });
    return sharedPost;
  }

  // Update

  async updatePost(
    dto: UpdatePostDto,
    files: Express.Multer.File[] = [],
    { postId }: PostIdParamDto,
    user: HydratedDocument<IUser>,
  ) {
    const { content, visibility, tags, location, removeAttachments = [] } = dto;

    const post = await this.postRepository.findById({ id: postId });
    if (!post) throw new NotFoundException("Post not found");

    if (post.createdBy.toString() !== user._id.toString()) {
      throw new ForbiddenException("You are not allowed to update this post");
    }

    // ── attachments: compute resulting state and validate before any side effect ──
    const current = post.attachments ?? [];
    const toRemove = new Set(removeAttachments);
    const removedKeys = current.filter((key) => toRemove.has(key));
    const survivors = current.filter((key) => !toRemove.has(key));
    const totalAttachments = survivors.length + files.length;

    if (!(content ?? post.content) && totalAttachments === 0) {
      throw new BadRequestException("Post must have either content or at least one attachment");
    }
    if (totalAttachments > this.MAX_ATTACHMENTS) {
      throw new BadRequestException(`Maximum ${this.MAX_ATTACHMENTS} attachments allowed`);
    }

    // ── tags: undefined = untouched, [] = clear, [...] = replace ──
    const mentions = tags === undefined ? undefined : await this.postHelper.resolveMentions(tags);

    // ── upload new files ──
    const newAttachments = files.length
      ? await this.s3.uploadMultipleAssets({ files, path: `posts/${post.folderId}` })
      : [];

    const attachmentsChanged = files.length > 0 || removedKeys.length > 0;

    // ── commit; roll back uploads on any failure ──
    let updatedPost: HydratedDocument<IPost> | null;
    try {
      updatedPost = await this.postRepository.findOneAndUpdate({
        filter: { _id: postId, createdBy: user._id },
        update: {
          ...(content !== undefined && { content }),
          ...(visibility !== undefined && { visibility }),
          ...(mentions !== undefined && { tags: mentions }),
          ...(location !== undefined && { location }),
          ...(attachmentsChanged && { attachments: [...survivors, ...newAttachments] }),
          updatedBy: user._id,
          isEdited: true,
        },
      });
    } catch (err) {
      await this.postHelper.safeDeleteAssets(newAttachments);
      throw err;
    }

    if (!updatedPost) {
      await this.postHelper.safeDeleteAssets(newAttachments);
      throw new NotFoundException("Post not found");
    }

    // ── post-commit side effects must never fail the request ──
    await this.postHelper.safeDeleteAssets(removedKeys);
    await this.postHelper.notifyNewlyTagged(post.tags as Types.ObjectId[] | undefined, mentions, user, "post");

    return updatedPost;
  }

  // Reactions

  async reactAtPost({ reaction }: ReactAtPostDto, { postId }: PostIdParamDto, user: HydratedDocument<IUser>) {
    const post = await this.postRepository.findById({ id: postId });
    if (!post) throw new NotFoundException("Post not found");

    const existingReaction = post.reactions?.find((r) => r.createdBy.toString() === user._id.toString());

    // same reaction again = toggle off
    if (existingReaction?.reactionType === reaction) {
      await this.removeReaction(postId, user._id, reaction);
    } else {
      // different reaction = swap
      if (existingReaction) {
        await this.removeReaction(postId, user._id, existingReaction.reactionType);
      }
      await this.addReaction(postId, user._id, reaction);
    }

    const updatedPost = await this.postRepository.findById({
      id: postId,
      projection: { reactionsCount: 1, reactionsBreakdown: 1 },
    });
    if (!updatedPost) throw new NotFoundException("Post not found");

    return updatedPost;
  }

  // Delete / restore

  async softDeletePost({ postId, user }: { postId: string; user: HydratedDocument<IUser> }) {
    const post = await this.postRepository.findById({ id: postId });
    if (!post) throw new NotFoundException("Post not found");

    const isAllowed = user.role === RoleEnum.Admin || post.createdBy.toString() === user._id.toString();
    if (!isAllowed) throw new ForbiddenException("You are not allowed to delete this post");

    const deletedPost = await this.postRepository.findOneAndUpdate({
      filter: { _id: postId },
      update: { deletedAt: new Date(), updatedBy: user._id },
    });

    if (!deletedPost) throw new NotFoundException("Post not found");
    return deletedPost;
  }

  async restorePost({ postId, user }: { postId: string; user: HydratedDocument<IUser> }) {
    const post = await this.postRepository.findOne({
      filter: { _id: postId, paranoid: false } as any,
    });
    if (!post) throw new NotFoundException("Post not found");

    const isAllowed = user.role === RoleEnum.Admin || post.createdBy.toString() === user._id.toString();
    if (!isAllowed) throw new ForbiddenException("You are not allowed to restore this post");

    const restoredPost = await this.postRepository.findOneAndUpdate({
      filter: { _id: postId, paranoid: false } as any,
      update: { restoredAt: new Date(), updatedBy: user._id },
    });

    if (!restoredPost) throw new NotFoundException("Post not found");
    return restoredPost;
  }

  async hardDeletePost({ postId }: { postId: string }) {
    const post = await this.postRepository.findOneAndDelete({
      filter: { _id: postId, force: true } as any,
    });

    if (!post) throw new NotFoundException("Post not found");

    // Clean up all comments associated with this post and all attachments (best effort)
    try {
      const comments = (await this.commentRepository.find({
        filter: { postId },
        projection: { attachments: 1 },
        options: { lean: true },
      })) as unknown as { _id: Types.ObjectId; attachments?: string[] }[];

      await this.commentRepository.deleteMany({ filter: { postId } });

      const allAssetKeys = [
        ...(post.attachments ?? []),
        ...comments.flatMap((c) => c.attachments ?? []),
      ];

      await this.postHelper.safeDeleteAssets(allAssetKeys);
    } catch (err) {
      console.error("Failed to clean up cascading assets for post:", err);
    }

    return post;
  }
}

export const postService = new PostService();