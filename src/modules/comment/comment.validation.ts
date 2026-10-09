// comment.validation.ts
import { z } from "zod";
import { ReactionTypeEnum } from "../../common/enums";
import { fileFieldValidation } from "../../common/utils/multer";
import { file, id, objectId } from "../../common/validation";

// parses JSON-encoded arrays coming from multipart/form-data
const jsonArrayField = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.preprocess((val) => {
    if (typeof val !== "string") return val;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }, z.array(itemSchema));

// shared params
export const postIdParamSchema = z.object({
  postId: id,
});

export const commentIdParamSchema = z.object({
  postId: id,
  commentId: id,
});

const commentBody = z
  .object({
    content: z.string().max(8000).trim().optional(),
    attachments: z.array(file(fileFieldValidation.image)).max(10).optional(),
    removeAttachments: jsonArrayField(z.string()).optional(),
    tags: jsonArrayField(objectId).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tags?.length) {
      const uniqueTags = new Set(data.tags.map((id) => id.toString()));
      if (uniqueTags.size !== data.tags.length) {
        ctx.addIssue({ code: "custom", message: "Tagged user IDs must be unique", path: ["tags"] });
      }
    }
  });

const requireContentOrAttachment = (data: z.infer<typeof commentBody>, ctx: z.RefinementCtx) => {
  if (!data.content && (!data.attachments || data.attachments.length === 0)) {
    ctx.addIssue({
      code: "custom",
      message: "Comment must have either content or at least one attachment",
      path: ["content"],
    });
  }
};

export const createCommentSchema = {
  params: postIdParamSchema,
  body: commentBody.superRefine(requireContentOrAttachment),
};

export const replyOnCommentSchema = {
  params: commentIdParamSchema,
  body: commentBody.superRefine(requireContentOrAttachment),
};

export const getCommentsSchema = {
  params: postIdParamSchema,
};

export const commentIdSchema = {
  params: commentIdParamSchema,
};

export const updateCommentSchema = {
  params: commentIdParamSchema,
  body: commentBody,
};

export const reactAtCommentSchema = {
  params: commentIdParamSchema,
  body: z.strictObject({
    reaction: z.enum(ReactionTypeEnum),
  }),
};

// ── DTOs, inferred directly from the schemas above ──
export type PostIdParamDto = z.infer<typeof postIdParamSchema>;
export type CommentIdParamDto = z.infer<typeof commentIdParamSchema>;
export type CreateCommentDto = z.infer<typeof createCommentSchema.body>;
export type UpdateCommentDto = z.infer<typeof updateCommentSchema.body>;
export type ReactAtCommentDto = z.infer<typeof reactAtCommentSchema.body>;