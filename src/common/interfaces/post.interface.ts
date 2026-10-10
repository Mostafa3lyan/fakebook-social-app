import { Types } from "mongoose";
import { PostVisibilityEnum, ReactionTypeEnum } from "../enums";
import { IUser } from "./user.interface";

export interface IPost {
  _id?: Types.ObjectId;
  folderId: string;
  content?: string | undefined;
  attachments?: string[] | undefined;

  createdBy: Types.ObjectId | IUser;
  updatedBy: Types.ObjectId | IUser;

  visibility: PostVisibilityEnum;
  tags?: Types.ObjectId[] | IUser[] | undefined;

  location?: {
    name: string;
    lat?: number | undefined;
    lng?: number | undefined;
  } | undefined;

  reactions?: IReaction[];
  reactionsCount: number;
  reactionsBreakdown: Map<ReactionTypeEnum, number>;
  commentsCount: number;
  sharedFrom?: ISharedPost;
  shareCount: number;
  isEdited: boolean;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  restoredAt?: Date;
}

export interface IReaction {
  createdBy: Types.ObjectId | IUser;
  reactionType: ReactionTypeEnum;
  createdAt: Date;
}

export interface IComment {
  postId: Types.ObjectId | IPost;
  commentId?: Types.ObjectId | IComment | undefined;

  content?: string | undefined;
  attachments?: string[] | undefined;

  createdBy: Types.ObjectId | IUser;
  updatedBy?: Types.ObjectId | IUser;

  tags?: Types.ObjectId[] | IUser[] | undefined;

  reactions?: IReaction[];
  reactionsCount: number;
  reactionsBreakdown: Map<ReactionTypeEnum, number>;

  repliesCount: number;
  isEdited: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface ISharedPost {
  originalPostId: Types.ObjectId | IPost;
  originalAuthorId: Types.ObjectId | IUser;
}

