// post.validation.ts
import { z } from "zod";
import { file, id, objectId } from "../../common/validation";
import { fileFieldValidation } from "../../common/utils/multer";
import { PostVisibilityEnum, ReactionTypeEnum } from "../../common/enums";

const locationSchema = z.object({
  name: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// shared — reused by both updatePostSchema.params and postIdParamSchema.params
const postIdParams = z.object({
  id: objectId,
});

export const createPostSchema = {
  body: z
    .object({
      content: z.string().max(63206).trim().optional(),
      attachments: z.array(file(fileFieldValidation.image)).max(10).optional(),
      visibility: z.enum(PostVisibilityEnum).default(PostVisibilityEnum.PUBLIC),
      tags: z.array(objectId).max(50).optional(),
      location: locationSchema.optional(),
    })
    .superRefine((data, ctx) => {
      if (!data.content && (!data.attachments || data.attachments.length === 0)) {
        ctx.addIssue({
          code: "custom",
          message: "Post must have either content or at least one attachment",
          path: ["content"],
        });
      }

      if (data.tags?.length) {
        const uniqueTags = new Set(data.tags.map((id) => id.toString()));
        if (uniqueTags.size !== data.tags.length) {
          ctx.addIssue({
            code: "custom",
            message: "Tagged user IDs must be unique",
            path: ["tags"],
          });
        }
      }
    }),
};

export const updatePostSchema = {
  params: z.object({
    id: objectId,
  }),
  body: z.object({
    content: z.string().max(63206).trim(),
    attachments: z.array(file(fileFieldValidation.image)).max(10),
    visibility: z.enum(PostVisibilityEnum).default(PostVisibilityEnum.PUBLIC),
    tags: z.array(objectId).max(50),
    location: locationSchema,
  }),
};

export const reactAtPostSchema = {
  params: z.object({
    id: id,
  }),
  body: z.strictObject({
    reaction: z.enum(ReactionTypeEnum).default(ReactionTypeEnum.LIKE),
  }),
};

export const postIdParamSchema = {
  params: postIdParams,
};

export const queryPostSchema = {
  query: z.object({
    createdBy: objectId,
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

// ── DTOs, inferred directly from the schemas above ──
export type CreatePostDto = z.infer<typeof createPostSchema.body>;
export type UpdatePostDto = z.infer<typeof updatePostSchema.body>;
export type UpdatePostParamsDto = z.infer<typeof updatePostSchema.params>;
export type ReactAtPostDto = z.infer<typeof reactAtPostSchema.body>;
export type ReactAtPostParamsDto = z.infer<typeof reactAtPostSchema.params>;
export type PostIdParamDto = z.infer<typeof postIdParamSchema.params>;
export type QueryPostDto = z.infer<typeof queryPostSchema.query>;
export type LocationDto = z.infer<typeof locationSchema>;