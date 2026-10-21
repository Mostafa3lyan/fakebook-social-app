import { Types } from "mongoose";
import { FriendRequestStatusEnum } from "../enums";
import { IUser } from "./user.interface";

export interface IFriendRequest {
  _id: Types.ObjectId;
  sender: Types.ObjectId | IUser;
  receiver: Types.ObjectId | IUser;
  status: FriendRequestStatusEnum;
  createdAt: Date;
  updatedAt: Date;
}
