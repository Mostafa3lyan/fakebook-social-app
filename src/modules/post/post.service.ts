// post.service.ts
import { HydratedDocument, Types } from "mongoose";
import { PostRepository, UserRepository } from "../../DB/repository";
import { NotFoundException } from "../../common/exceptions";
import { notificationsService, NotificationsService, redisService, RedisService, s3Service, S3Service, TokenService } from "../../common/services";
import { CreatePostDto, QueryPostDto, UpdatePostDto } from "./post.validation";
import { randomUUID } from "node:crypto";
import { IUser } from "../../common/interfaces";


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

  async createPost({ dto, files, user }: { dto: CreatePostDto; files: Express.Multer.File[]; user: HydratedDocument<IUser> }) {
    const { content, visibility, taggedUserIds, location } = dto;

    const mentions: Types.ObjectId[] = [];

    if (taggedUserIds?.length) {
      const mentionedAccounts = await this.userRepository.find({
        filter: { _id: { $in: taggedUserIds } },
        options: { lean: true },
      });

      if (mentionedAccounts.length !== taggedUserIds.length) {
        throw new NotFoundException("One or more tagged users not found");
      }

      for (const tag of taggedUserIds) {
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
        taggedUserIds: mentions,
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

  async getPosts({ query }: { query: QueryPostDto }) {
    const { folderId, createdBy, page = 1, limit = 20 } = query;

    const filter: Record<string, unknown> = {};
    if (folderId) filter.folderId = folderId;
    if (createdBy) filter.createdBy = createdBy;

    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.postRepository.find({
        filter,
        sort: { createdAt: -1 },
        limit,
        skip,
        populate: [{ path: "createdBy", select: "firstName lastName profilePicture" }],
        options: { lean: true },
      }),
      this.postRepository.countDocuments({ filter }),
    ]);

    return {
      posts,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPostById({ postId }: { postId: string }) {
    const post = await this.postRepository.findById({
      id: postId,
      populate: [{ path: "createdBy", select: "firstName lastName profilePicture" }],
      options: { lean: true },
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