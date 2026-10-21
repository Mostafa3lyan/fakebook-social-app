import { Model, model, Schema } from "mongoose";
import { FriendRequestStatusEnum } from "../../common/enums";
import { IFriendRequest } from "../../common/interfaces";

const friendRequestSchema = new Schema<IFriendRequest, Model<IFriendRequest>>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(FriendRequestStatusEnum),
      default: FriendRequestStatusEnum.PENDING,
      index: true,
    },
  },
  {
    timestamps: true,
    strict: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, any>) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
    strictQuery: true,
  },
);

// Prevent duplicate requests in same direction
friendRequestSchema.index({ sender: 1, receiver: 1 }, { unique: true });
// Incoming pending requests query index
friendRequestSchema.index({ receiver: 1, status: 1, createdAt: -1 });
// Outgoing pending requests query index
friendRequestSchema.index({ sender: 1, status: 1, createdAt: -1 });

export const FriendRequestModel: Model<IFriendRequest> = model<IFriendRequest>(
  "FriendRequest",
  friendRequestSchema,
);
