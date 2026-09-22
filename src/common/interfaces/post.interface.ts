import { Types } from "mongoose";
import { PostVisibility, ReactionType } from "../enums";
import { IUser } from "./user.interface";

export interface IPost {
  folderId: string;
  content?: string | undefined;
  attachments?: string[] | undefined;

  createdBy: Types.ObjectId | IUser;
  updatedBy: Types.ObjectId | IUser;
  
  visibility: PostVisibility;
  taggedUserIds?: Types.ObjectId[] | IUser[] | undefined;

  location?: {
    name: string;
    lat?: number;
    lng?: number;
  } | undefined;

  reactions?: IReaction[];
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
  type: ReactionType;
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

