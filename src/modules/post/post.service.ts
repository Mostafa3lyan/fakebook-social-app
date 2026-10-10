// post.service.ts
import { randomUUID } from "node:crypto";
import { FlattenMaps, HydratedDocument, Types } from "mongoose";
import { CommentRepository, PostRepository } from "../../DB/repository";
import { BadRequestException, ForbiddenException, NotFoundException } from "../../common/exceptions";
import { s3Service, S3Service } from "../../common/services";
import { IPagination, IPost, IUser } from "../../common/interfaces";
import { escapeRegex } from "../../common/utils";
import {
  POST_POPULATE,
  getVisibility,
  PostHelper,
  postHelper,
  AddReactionUpdate,
  RemoveReactionUpdate,
} from "./post.helper";
import { PaginationDto } from "../../common/validation";
import { CreatePostDto, PostIdParamDto, ReactAtPostDto, SharePostDto, UpdatePostDto } from "./post.validation";
import { PostVisibilityEnum, RoleEnum } from "../../common/enums";

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



  // Create

  async createPost({ content, visibility, tags, location }: CreatePostDto, files: Express.Multer.File[] = [], user: HydratedDocument<IUser>) {

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

    async sharePost(
    { content, visibility, tags }: SharePostDto,
    { postId }: PostIdParamDto,
    user: HydratedDocument<IUser>,
  ){
    const post = await this.postRepository.findById({ id: postId });
    if (!post) throw new NotFoundException("Post not found");

    if (post.visibility !== PostVisibilityEnum.PUBLIC) {
      throw new ForbiddenException("You are not allowed to share this post");
    }

    // Resolve the original root post (flatten chained shares like Facebook)
    const rootPostId = (post.sharedFrom?.originalPostId ?? postId) as unknown as Types.ObjectId;
    const rootAuthorId = (post.sharedFrom?.originalAuthorId ?? post.createdBy) as unknown as Types.ObjectId;

    // Resolve mentions / tags
    const mentions = tags?.length ? await this.postHelper.resolveMentions(tags) : [];

    const folderId = randomUUID();
    const sharedPost = await this.postRepository.createOne({
      data: {
        createdBy: user._id,
        folderId,
        content: content || undefined,
        visibility,
        tags: mentions,
        attachments: [],
        sharedFrom: {
          originalPostId: rootPostId,
          originalAuthorId: rootAuthorId,
        },
      },
    });

    // Increment shareCount on the root post
    await this.postRepository.updateOne({
      filter: { _id: rootPostId.toString() },
      update: { $inc: { shareCount: 1 } },
    });

    // Notify tagged users and root author (best effort)
    await this.postHelper.notifyNewlyTagged(undefined, mentions, user, "post");
    await this.postHelper.notifyAuthor(rootAuthorId, user, "shared your post");

    return sharedPost;
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
      populate: POST_POPULATE,
      projection: { reactions: 0, comments: 0 },
      page,
      limit,
      sort: { createdAt: -1 },
    });
  }

  async getPostById({ postId }: PostIdParamDto, user: HydratedDocument<IUser>): Promise<FlattenMaps<IPost>> {
    const post = await this.postRepository.findOne({
      filter: { _id: postId, $or: getVisibility(user) },
      populate: POST_POPULATE,
    });

    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  // Update

  async updatePost(
    { content, visibility, tags, location, removeAttachments = [] }: UpdatePostDto,
    files: Express.Multer.File[] = [],
    { postId }: PostIdParamDto,
    user: HydratedDocument<IUser>,
  ) {
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
      await this.postRepository.updateOne({
        filter: { _id: postId },
        update: RemoveReactionUpdate(user._id, reaction),
      });
    } else {
      // different reaction = swap
      if (existingReaction) {
        await this.postRepository.updateOne({
          filter: { _id: postId },
          update: RemoveReactionUpdate(user._id, existingReaction.reactionType),
        });
      }
      await this.postRepository.updateOne({
        filter: { _id: postId },
        update: AddReactionUpdate(user._id, reaction),
      });
    }

    const updatedPost = await this.postRepository.findById({
      id: postId,
      projection: { reactionsCount: 1, reactionsBreakdown: 1 },
    });
    if (!updatedPost) throw new NotFoundException("Post not found");

    return updatedPost;
  }

  // Delete / restore

  async softDeletePost({ postId }: PostIdParamDto, user: HydratedDocument<IUser>) {
    const post = await this.postRepository.findById({ id: postId });
    if (!post) throw new NotFoundException("Post not found");

    const isAllowed = user.role === RoleEnum.Admin || post.createdBy.toString() === user._id.toString();
    if (!isAllowed) throw new ForbiddenException("You are not allowed to delete this post");

    const deletedPost = await this.postRepository.findOneAndUpdate({
      filter: { _id: postId },
      update: { deletedAt: new Date(), updatedBy: user._id },
    });

    if (!deletedPost) throw new NotFoundException("Post not found");

    if (deletedPost.sharedFrom?.originalPostId) {
      const rootId =
        (deletedPost.sharedFrom.originalPostId as { _id?: Types.ObjectId })._id?.toString() ??
        deletedPost.sharedFrom.originalPostId.toString();
      await this.postRepository.updateOne({
        filter: { _id: rootId },
        update: { $inc: { shareCount: -1 } },
      });
    }

    return deletedPost;
  }

  async restorePost({ postId }: PostIdParamDto, user: HydratedDocument<IUser>) {
    const post = await this.postRepository.findOne({
      filter: { _id: postId, paranoid: false },
    });
    if (!post) throw new NotFoundException("Post not found");

    const isAllowed = user.role === RoleEnum.Admin || post.createdBy.toString() === user._id.toString();
    if (!isAllowed) throw new ForbiddenException("You are not allowed to restore this post");

    const restoredPost = await this.postRepository.findOneAndUpdate({
      filter: { _id: postId, paranoid: false },
      update: { restoredAt: new Date(), updatedBy: user._id },
    });

    if (!restoredPost) throw new NotFoundException("Post not found");

    if (restoredPost.sharedFrom?.originalPostId) {
      const rootId =
        (restoredPost.sharedFrom.originalPostId as { _id?: Types.ObjectId })._id?.toString() ??
        restoredPost.sharedFrom.originalPostId.toString();
      await this.postRepository.updateOne({
        filter: { _id: rootId },
        update: { $inc: { shareCount: 1 } },
      });
    }

    return restoredPost;
  }

  async hardDeletePost({ postId }: PostIdParamDto, user: HydratedDocument<IUser>) {
    const post = await this.postRepository.findOneAndDelete({
      filter: { _id: postId },
    });

    if (!post) throw new NotFoundException("Post not found");

    const isAllowed = user.role === RoleEnum.Admin || post.createdBy.toString() === user._id.toString();
    if (!isAllowed) throw new ForbiddenException("You are not allowed to delete this post");

    if (post.sharedFrom?.originalPostId && !post.deletedAt) {
      const rootId =
        (post.sharedFrom.originalPostId as { _id?: Types.ObjectId })._id?.toString() ??
        post.sharedFrom.originalPostId.toString();
      await this.postRepository.updateOne({
        filter: { _id: rootId },
        update: { $inc: { shareCount: -1 } },
      });
    }

    // Clean up all comments associated with this post and all attachments (best effort)
    try {
      const comments = await this.commentRepository.find({
        filter: { postId },
        projection: { attachments: 1 },
        options: { lean: true },
      });

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