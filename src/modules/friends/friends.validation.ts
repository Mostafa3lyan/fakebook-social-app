import { z } from "zod";
import { objectId } from "../../common/validation";

export const receiverParamSchema = {
  params: z.strictObject({
    receiverId: objectId,
  }),
};

export const requestIdParamSchema = {
  params: z.strictObject({
    requestId: objectId,
  }),
};

export const friendIdParamSchema = {
  params: z.strictObject({
    friendId: objectId,
  }),
};

export const targetUserParamSchema = {
  params: z.strictObject({
    targetUserId: objectId,
  }),
};

export type ReceiverParamDto = z.infer<typeof receiverParamSchema.params>;
export type RequestIdParamDto = z.infer<typeof requestIdParamSchema.params>;
export type FriendIdParamDto = z.infer<typeof friendIdParamSchema.params>;
export type TargetUserParamDto = z.infer<typeof targetUserParamSchema.params>;
