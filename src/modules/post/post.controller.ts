import { Router, type Request, type Response } from "express";
import { authentication, authorization, validation } from "../../middleware";
import { successResponse } from "../../common/response";
import { postService } from "./post.service";
import { RoleEnum } from "../../common/enums";
import * as validators from "./post.validation.js";
import { cloudFileUpload, fileFieldValidation } from "../../common/utils/multer";
import { PaginationDto, paginationValidationSchema } from "../../common/validation";

// post.controller.ts

const router = Router();

// Create post
router.post(
  "/",
  authentication(),
  cloudFileUpload({ validation: fileFieldValidation.image }).array("attachments", 10),
  validation(validators.createPostSchema),
  async (req: Request, res: Response) => {
    const post = await postService.createPost(req.body, req.files as Express.Multer.File[], req.user);
    return successResponse({ res, status: 201, data: { post } });
  },
);

// List posts (folder / author feed)
router.get(
  "/",
  authentication(),
  validation(paginationValidationSchema),
  async (req: Request, res: Response) => {
    const posts = await postService.getPosts(req.query as PaginationDto, req.user);
    return successResponse({ res, data: { posts } });
  },
);

// Get single post
router.get(
  "/:postId",
  authentication(),
  async (req: Request, res: Response) => {
    const post = await postService.getPostById(req.params as validators.PostIdParamDto, req.user);
    return successResponse({ res, data: { post } });
  },
);

// Update post
router.patch(
  "/:postId",
  authentication(),
  cloudFileUpload({ validation: fileFieldValidation.image }).array("attachments", 10),
  validation(validators.updatePostSchema),
  async (req: Request, res: Response) => {
    const post = await postService.updatePost(req.body, req.files as Express.Multer.File[], req.params as validators.PostIdParamDto, req.user);
    return successResponse({ res, data: { post } });
  },
);

// React at post
router.post(
  "/:postId/react",
  authentication(),
  validation(validators.reactAtPostSchema),
  async (req: Request, res: Response) => {
    const post = await postService.reactAtPost(req.body, req.params as validators.PostIdParamDto, req.user);
    return successResponse({ res, data: { post } });
  }
);

// Soft delete
router.delete(
  "/:postId",
  authentication(),
  async (req: Request, res: Response) => {
    const post = await postService.softDeletePost({ postId: req.params.id as string, userId: req.user._id });
    return successResponse({ res, data: { post } });
  },
);

// Restore
router.patch(
  "/:postId/restore",
  authentication(),
  async (req: Request, res: Response) => {
    const post = await postService.restorePost({ postId: req.params.id as string, userId: req.user._id });
    return successResponse({ res, data: { post } });
  },
);

// Hard delete (admin only)
router.delete(
  "/:postId/permanent",
  authentication(),
  authorization([RoleEnum.Admin]),
  async (req: Request, res: Response) => {
    const post = await postService.hardDeletePost({ postId: req.params.postId as string });
    return successResponse({ res, data: { post } });
  },
);

export default router;