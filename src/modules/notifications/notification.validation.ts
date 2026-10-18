import { z } from "zod";
import { id } from "../../common/validation";

export const fcmTokenSchema = {
body: z.object({
    token: z.string().min(1, "token is required"),
}),
};

export const notifyNewMessageSchema = {
body: z.object({
    recipientId: id,
    message: z.string().min(1, "message is required").max(500),
}),
};