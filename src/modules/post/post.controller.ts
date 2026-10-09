import { Router, type Request, type Response } from "express";
import { authentication, authorization, validation } from "../../middleware";
import { successResponse } from "../../common/response";
import { postService } from "./post.service";
import { RoleEnum } from "../../common/enums";
import * as validators from "./post.validation";
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
  validation(validators.postParamSchema),
  async (req: Request, res: Response) => {
    const post = await postService.getPostById(req.params as validators.PostIdParamDto, req.user);
    return successResponse({ res, data: { post } });
  },
);

// Share post
router.post(
  "/:postId/share",
  authentication(),
  validation(validators.postParamSchema),
  async (req: Request, res: Response) => {
    const post = await postService.sharePost(req.params as validators.PostIdParamDto, req.user);
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
    const post = await postService.updatePost(
      req.body,
      req.files as Express.Multer.File[],
      req.params as validators.PostIdParamDto,
      req.user,
    );
    return successResponse({ res, data: { post } });
  },
);

// React at post
router.post(
  "/:postId/react",
  authentication(),
  validation(validators.reactAtPostSchema),
  async (req: Request, res: Response) => {
    const post = await postService.reactAtPost(
      req.body,
      req.params as validators.PostIdParamDto,
      req.user,
    );
    return successResponse({ res, data: { post } });
  },
);

// Soft delete (author or admin)
router.delete(
  "/:postId/soft-delete",
  authentication(),
  validation(validators.postParamSchema),
  async (req: Request, res: Response) => {
    const post = await postService.softDeletePost({
      postId: req.params.postId as string,
      user: req.user,
    });
    return successResponse({ res, data: { post } });
  },
);

// Restore (author or admin)
router.patch(
  "/:postId/restore",
  authentication(),
  validation(validators.postParamSchema),
  async (req: Request, res: Response) => {
    const post = await postService.restorePost({
      postId: req.params.postId as string,
      user: req.user,
    });
    return successResponse({ res, data: { post } });
  },
);

// Hard delete (admin only)
router.delete(
  "/:postId",
  authentication(),
  authorization([RoleEnum.Admin]),
  validation(validators.postParamSchema),
  async (req: Request, res: Response) => {
    const post = await postService.hardDeletePost({
      postId: req.params.postId as string,
    });
    return successResponse({ res, data: { post } });
  },
);

export default router;