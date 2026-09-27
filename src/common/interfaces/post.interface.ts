import { Types } from "mongoose";
import { PostVisibilityEnum, ReactionTypeEnum } from "../enums";
import { IUser } from "./user.interface";

export interface IPost {
  folderId: string;
  content?: string | undefined;
  attachments?: string[] | undefined;

  createdBy: Types.ObjectId | IUser;
  updatedBy: Types.ObjectId | IUser;

  visibility: PostVisibilityEnum;
  tags?: Types.ObjectId[] | IUser[] | undefined;

  location?: {
    name: string;
    lat?: number;
    lng?: number;
  } | undefined;

  reactions?: IReaction[];
  reactionsCount: number;
  reactionsBreakdown: Map<ReactionTypeEnum, number>;
  comments?: IComment[];
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
  _id: Types.ObjectId;
  createdBy: Types.ObjectId | IUser;
  content: string;
  reactions?: IReaction[];
  replies?: IComment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ISharedPost {
  originalPostId: Types.ObjectId;
  originalAuthorId: Types.ObjectId | IUser;
}

