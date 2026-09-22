// post.validation.ts
import { z } from "zod";
import { PostVisibility } from "../../common/enums";
import { file, objectId } from "../../common/validation";
import { fileFieldValidation } from "../../common/utils/multer";

const locationSchema = z.object({
  name: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const createPostBody = z
  .object({
    content: z.string().max(63206).trim().optional(),
    attachments: z.array(file(fileFieldValidation.image)).max(10).optional(),
    visibility: z.enum(PostVisibility).default(PostVisibility.PUBLIC),
    taggedUserIds: z.array(objectId).max(50).optional(),
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

    if (data.taggedUserIds?.length) {
      const uniqueTaggedUserIds = new Set(data.taggedUserIds.map((id) => id.toString()));
      if (uniqueTaggedUserIds.size !== data.taggedUserIds.length) {
        ctx.addIssue({
          code: "custom",
          message: "Tagged user IDs must be unique",
          path: ["taggedUserIds"],
        });
      }
    }
    
  });

const updatePostBody = z
  .object({
    content: z.string().max(63206).trim(),
    attachments: z.array(file(fileFieldValidation.image)).max(10),
    visibility: z.enum(PostVisibility).default(PostVisibility.PUBLIC),
    taggedUserIds: z.array(objectId).max(50),
    location: locationSchema,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

const postIdParams = z.object({
  id: objectId,
});

const queryPostQuery = z.object({
  folderId: objectId,
  createdBy: objectId,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const createPostSchema = { body: createPostBody };
export const updatePostSchema = { params: postIdParams, body: updatePostBody };
export const postIdParamSchema = { params: postIdParams };
export const queryPostSchema = { query: queryPostQuery };

// ── DTOs, inferred directly from the schemas above ──
export type CreatePostDto = z.infer<typeof createPostBody>;
export type UpdatePostDto = z.infer<typeof updatePostBody>;
export type PostIdParamDto = z.infer<typeof postIdParams>;
export type QueryPostDto = z.infer<typeof queryPostQuery>;
export type LocationDto = z.infer<typeof locationSchema>;