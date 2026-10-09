// comment.service.ts
import { FlattenMaps, HydratedDocument, Types } from "mongoose";
import { CommentRepository, PostRepository } from "../../DB/repository";
import { BadRequestException, ForbiddenException, NotFoundException } from "../../common/exceptions";
import { notificationsService, NotificationsService, s3Service, S3Service } from "../../common/services";
import { IComment, IPagination, IPost, IUser } from "../../common/interfaces";
import { escapeRegex } from "../../common/utils";
import {
  AUTHOR_POPULATE,
  getVisibility,
  PostHelper,
  postHelper,
} from "../post/post.helper";
import { PaginationDto } from "../../common/validation";
import { ReactionTypeEnum, RoleEnum } from "../../common/enums";
import {
  CommentIdParamDto,
  CreateCommentDto,
  PostIdParamDto,
  ReactAtCommentDto,
  UpdateCommentDto,
} from "./comment.validation";

class CommentService {
  private readonly MAX_ATTACHMENTS = 2;

  private readonly postRepository: PostRepository;
  private readonly commentRepository: CommentRepository;
  private readonly notificationsService: NotificationsService;
  private readonly s3: S3Service;
  private readonly postHelper: PostHelper;

  constructor(
    commentRepository = new CommentRepository(),
    postRepository = new PostRepository(),
    notifications = notificationsService,
    s3 = s3Service,
    postHelperInstance = postHelper,
  ) {
    this.commentRepository = commentRepository;
    this.postRepository = postRepository;
    this.notificationsService = notifications;
    this.s3 = s3;
    this.postHelper = postHelperInstance;
  }

  // Private helpers

  /** A user can only interact with comments of a post they are allowed to see. */
  private async getVisiblePost(postId: string, user: HydratedDocument<IUser>) {
    const post = await this.postRepository.findOne({
      filter: { _id: postId, $or: getVisibility(user) },
      projection: { folderId: 1, createdBy: 1 },
    });
    if (!post) throw new NotFoundException("Post not found");
    return post as unknown as HydratedDocument<IPost>;
  }

  private async getCommentOfPost(postId: string, commentId: string) {
    const comment = await this.commentRepository.findOne({
      filter: { _id: commentId, postId },
    });
    if (!comment) throw new NotFoundException("Comment not found");
    return comment as unknown as HydratedDocument<IComment>;
  }

  private async notifyOwner(ownerId: Types.ObjectId | IUser, actor: HydratedDocument<IUser>, message: string) {
    const recipientId = ownerId.toString();
    if (recipientId === actor._id.toString()) return;
    try {
      await this.notificationsService.notifyNewMessage({
        recipientId,
        message: `${actor.firstName} ${actor.lastName} ${message}`,
      });
    } catch (err) {
      console.error("Failed to send notification:", err);
    }
  }

  private removeReaction(commentId: string, userId: Types.ObjectId, reactionType: ReactionTypeEnum) {
    return this.commentRepository.updateOne({
      filter: { _id: commentId },
      update: {
        $pull: { reactions: { createdBy: userId } },
        $inc: { reactionsCount: -1, [`reactionsBreakdown.${reactionType}`]: -1 },
      },
    });
  }

  private addReaction(commentId: string, userId: Types.ObjectId, reactionType: string) {
    return this.commentRepository.updateOne({
      filter: { _id: commentId },
      update: {
        $push: { reactions: { reactionType, createdBy: userId, createdAt: new Date() } },
        $inc: { reactionsCount: 1, [`reactionsBreakdown.${reactionType}`]: 1 },
      },
    });
  }

  /** Shared create logic for top-level comments and replies. */
  private async insertComment(
    dto: CreateCommentDto,
    files: Express.Multer.File[],
    user: HydratedDocument<IUser>,
    post: HydratedDocument<IPost>,
    parent?: HydratedDocument<IComment>,
  ) {
    const { content, tags } = dto;

    if (files.length > this.MAX_ATTACHMENTS) {
      throw new BadRequestException(`Maximum ${this.MAX_ATTACHMENTS} attachments allowed`);
    }

    const mentions = tags?.length ? await this.postHelper.resolveMentions(tags) : [];

    const attachments = files.length
      ? await this.s3.uploadMultipleAssets({ files, path: `posts/${post.folderId}/comments` })
      : [];

    let comment: HydratedDocument<IComment>;
    try {
      comment = await this.commentRepository.createOne({
        data: {
          postId: post._id,
          ...(parent && { commentId: parent._id }),
          createdBy: user._id,
          content,
          tags: mentions,
          attachments,
        },
      });
    } catch (err) {
      await this.postHelper.safeDeleteAssets(attachments);
      throw err;
    }

    // counters / notifications must never fail the request
    try {
      await this.postRepository.updateOne({ filter: { _id: post._id }, update: { $inc: { commentsCount: 1 } } });
      if (parent) {
        await this.commentRepository.updateOne({ filter: { _id: parent._id }, update: { $inc: { repliesCount: 1 } } });
      }
    } catch (err) {
      console.error("Failed to update counters:", err);
    }

    await this.postHelper.notifyNewlyTagged(undefined, mentions, user, "comment");
    if (parent) await this.notifyOwner(parent.createdBy, user, "replied to your comment");
    else await this.notifyOwner(post.createdBy, user, "commented on your post");

    return comment;
  }

  // Create

  async createComment(
    dto: CreateCommentDto,
    files: Express.Multer.File[] = [],
    { postId }: PostIdParamDto,
    user: HydratedDocument<IUser>,
  ) {
    const post = await this.getVisiblePost(postId, user);
    return this.insertComment(dto, files, user, post);
  }

  async replyOnComment(
    dto: CreateCommentDto,
    files: Express.Multer.File[] = [],
    { postId, commentId }: CommentIdParamDto,
    user: HydratedDocument<IUser>,
  ) {
    const post = await this.getVisiblePost(postId, user);
    const parent = await this.getCommentOfPost(postId, commentId);
    return this.insertComment(dto, files, user, post, parent);
  }

  // Read

  async getComments(
    { postId }: PostIdParamDto,
    { page, limit, search }: PaginationDto,
    user: HydratedDocument<IUser>,
  ): Promise<IPagination<FlattenMaps<IComment>>> {
    await this.getVisiblePost(postId, user);

    return this.commentRepository.paginate({
      filter: {
        postId,
        commentId: { $exists: false },
        ...(search && { content: { $regex: escapeRegex(search), $options: "i" } }),
      },
      populate: AUTHOR_POPULATE,
      projection: { reactions: 0 },
      page,
      limit,
      sort: { createdAt: -1 },
    });
  }

  async getReplies(
    { postId, commentId }: CommentIdParamDto,
    { page, limit, search }: PaginationDto,
    user: HydratedDocument<IUser>,
  ): Promise<IPagination<FlattenMaps<IComment>>> {
    await this.getVisiblePost(postId, user);

    return this.commentRepository.paginate({
      filter: {
        postId,
        commentId,
        ...(search && { content: { $regex: escapeRegex(search), $options: "i" } }),
      },
      populate: AUTHOR_POPULATE,
      projection: { reactions: 0 },
      page,
      limit,
      sort: { createdAt: 1 },
    });
  }

  async getCommentById({ postId, commentId }: CommentIdParamDto, user: HydratedDocument<IUser>) {
    await this.getVisiblePost(postId, user);

    const comment = await this.commentRepository.findOne({
      filter: { _id: commentId, postId },
      populate: AUTHOR_POPULATE,
    });

    if (!comment) throw new NotFoundException("Comment not found");
    return comment;
  }

  // Update

  async updateComment(
    dto: UpdateCommentDto,
    files: Express.Multer.File[] = [],
    { postId, commentId }: CommentIdParamDto,
    user: HydratedDocument<IUser>,
  ) {
    const { content, tags, removeAttachments = [] } = dto;

    const comment = await this.getCommentOfPost(postId, commentId);

    if (comment.createdBy.toString() !== user._id.toString()) {
      throw new ForbiddenException("You are not allowed to update this comment");
    }

    // ── attachments: compute resulting state and validate before any side effect ──
    const current = comment.attachments ?? [];
    const toRemove = new Set(removeAttachments);
    const removedKeys = current.filter((key) => toRemove.has(key));
    const survivors = current.filter((key) => !toRemove.has(key));
    const totalAttachments = survivors.length + files.length;

    if (!(content ?? comment.content) && totalAttachments === 0) {
      throw new BadRequestException("Comment must have either content or at least one attachment");
    }
    if (totalAttachments > this.MAX_ATTACHMENTS) {
      throw new BadRequestException(`Maximum ${this.MAX_ATTACHMENTS} attachments allowed`);
    }

    // ── tags: undefined = untouched, [] = clear, [...] = replace ──
    const mentions = tags === undefined ? undefined : await this.postHelper.resolveMentions(tags);

    // ── upload new files ──
    const post = await this.getVisiblePost(postId, user);
    const newAttachments = files.length
      ? await this.s3.uploadMultipleAssets({ files, path: `posts/${post.folderId}/comments` })
      : [];

    const attachmentsChanged = files.length > 0 || removedKeys.length > 0;

    // ── commit; roll back uploads on any failure ──
    let updatedComment: HydratedDocument<IComment> | null;
    try {
      updatedComment = await this.commentRepository.findOneAndUpdate({
        filter: { _id: commentId, postId, createdBy: user._id },
        update: {
          ...(content !== undefined && { content }),
          ...(mentions !== undefined && { tags: mentions }),
          ...(attachmentsChanged && { attachments: [...survivors, ...newAttachments] }),
          updatedBy: user._id,
          isEdited: true,
        },
      });
    } catch (err) {
      await this.postHelper.safeDeleteAssets(newAttachments);
      throw err;
    }

    if (!updatedComment) {
      await this.postHelper.safeDeleteAssets(newAttachments);
      throw new NotFoundException("Comment not found");
    }

    // ── post-commit side effects must never fail the request ──
    await this.postHelper.safeDeleteAssets(removedKeys);
    await this.postHelper.notifyNewlyTagged(comment.tags as Types.ObjectId[] | undefined, mentions, user, "comment");

    return updatedComment;
  }

  // Reactions

  async reactAtComment(
    { reaction }: ReactAtCommentDto,
    { postId, commentId }: CommentIdParamDto,
    user: HydratedDocument<IUser>,
  ) {
    await this.getVisiblePost(postId, user);
    const comment = await this.getCommentOfPost(postId, commentId);

    const existingReaction = comment.reactions?.find((r) => r.createdBy.toString() === user._id.toString());

    // same reaction again = toggle off
    if (existingReaction?.reactionType === reaction) {
      await this.removeReaction(commentId, user._id, reaction);
    } else {
      // different reaction = swap
      if (existingReaction) {
        await this.removeReaction(commentId, user._id, existingReaction.reactionType);
      }
      await this.addReaction(commentId, user._id, reaction);
    }

    const updatedComment = await this.commentRepository.findById({
      id: commentId,
      projection: { reactionsCount: 1, reactionsBreakdown: 1 },
    });
    if (!updatedComment) throw new NotFoundException("Comment not found");

    return updatedComment;
  }

  // Delete

  /** Comment author, post owner, or admin may delete a comment (replies are removed too). */
  async deleteComment({ postId, commentId }: CommentIdParamDto, user: HydratedDocument<IUser>) {
    const post = await this.getVisiblePost(postId, user);
    const comment = await this.getCommentOfPost(postId, commentId);

    const isAllowed =
      user.role === RoleEnum.Admin ||
      comment.createdBy.toString() === user._id.toString() ||
      post.createdBy.toString() === user._id.toString();
    if (!isAllowed) throw new ForbiddenException("You are not allowed to delete this comment");

    // collect the whole reply tree level by level (BFS)
    const descendants: { _id: Types.ObjectId; attachments?: string[] }[] = [];
    let frontier: Types.ObjectId[] = [comment._id];
    while (frontier.length) {
      const level = (await this.commentRepository.find({
        filter: { postId, commentId: { $in: frontier } },
        projection: { _id: 1, attachments: 1 },
        options: { lean: true },
      })) as unknown as { _id: Types.ObjectId; attachments?: string[] }[];
      descendants.push(...level);
      frontier = level.map((r) => r._id);
    }

    const deleted = await this.commentRepository.findOneAndDelete({ filter: { _id: commentId, postId } });
    if (!deleted) throw new NotFoundException("Comment not found");

    // cascade: replies + counters + assets (best effort)
    try {
      if (descendants.length) {
        await this.commentRepository.deleteMany({ filter: { _id: { $in: descendants.map((r) => r._id) } } });
      }

      await this.postHelper.safeDeleteAssets([
        ...(comment.attachments ?? []),
        ...descendants.flatMap((r) => r.attachments ?? []),
      ]);

      await this.postRepository.updateOne({
        filter: { _id: postId },
        update: { $inc: { commentsCount: -(1 + descendants.length) } },
      });
      if (comment.commentId) {
        await this.commentRepository.updateOne({
          filter: { _id: comment.commentId },
          update: { $inc: { repliesCount: -1 } },
        });
      }
    } catch (err) {
      console.error("Failed to cascade comment deletion:", err);
    }

    return deleted;
  }
}

export const commentService = new CommentService();