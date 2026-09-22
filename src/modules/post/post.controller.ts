import { Router, type Request, type Response } from "express";
import { authentication, authorization, validation } from "../../middleware";
import { successResponse } from "../../common/response";
import { postService } from "./post.service";
import { RoleEnum } from "../../common/enums";
import * as validators from "./post.validation.js";
import { cloudFileUpload, fileFieldValidation } from "../../common/utils/multer";

// post.controller.ts

const router = Router();

// Create post
router.post(
  "/",
  authentication(),
  cloudFileUpload({ validation: fileFieldValidation.image }).array("attachments", 10),
  validation(validators.createPostSchema),
  async (req: Request, res: Response) => {
    const post = await postService.createPost({ dto: req.body, files: req.files as Express.Multer.File[], user: req.user });
    return successResponse({ res, status: 201, data: { post } });
  },
);

// List posts (folder / author feed)
router.get(
  "/",
  authentication(),
  async (req: Request, res: Response) => {
    const { posts, meta } = await postService.getPosts({ query: req.query as any });
    return successResponse({ res, data: { posts, meta } });
  },
);

// Get single post
router.get(
  "/:id",
  authentication(),
  async (req: Request, res: Response) => {
    const post = await postService.getPostById({ postId: req.params.id as string });
    return successResponse({ res, data: { post } });
  },
);

// Update post
router.patch(
  "/:id",
  authentication(),
  validation(validators.updatePostSchema),
  async (req: Request, res: Response) => {
    const post = await postService.updatePost({
      postId: req.params.id as string,
      dto: req.body,
      userId: req.user._id,
    });
    return successResponse({ res, data: { post } });
  },
);

// Soft delete
router.delete(
  "/:id",
  authentication(),
  async (req: Request, res: Response) => {
    const post = await postService.softDeletePost({ postId: req.params.id as string, userId: req.user._id });
    return successResponse({ res, data: { post } });
  },
);

// Restore
router.patch(
  "/:id/restore",
  authentication(),
  async (req: Request, res: Response) => {
    const post = await postService.restorePost({ postId: req.params.id as string, userId: req.user._id });
    return successResponse({ res, data: { post } });
  },
);

// Hard delete (admin only)
router.delete(
  "/:id/permanent",
  authentication(),
  authorization([RoleEnum.Admin]),
  async (req: Request, res: Response) => {
    const post = await postService.hardDeletePost({ postId: req.params.id as string });
    return successResponse({ res, data: { post } });
  },
);

export default router;