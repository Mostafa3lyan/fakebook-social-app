import { Router, Response, NextFunction } from "express";
import { TokenTypeEnum } from "../../common/enums/security.enum.js";
import { decodeToken, localFileUpload } from "../../common/utils/index.js";
import { fileFieldValidation } from "../../common/utils/multer/validation.multer.js";
import { authentication } from "../../middleware/index.js";
import { validation } from "../../middleware/validation.middleware.js";
import { successResponse } from "./../../common/utils/response/index.js";
import {
  changePassword,
  logout,
  profile,
  profileCoverImage,
  profileImage,
  removeProfileImage,
  rotateToken,
  shareProfile
} from "./user.service.js";
import * as validators from "./user.validation.js";

export class UserController {
  router = Router();

  constructor() {
    this.initializeRoutes();
  }

  initializeRoutes() {
    // User Profile
    this.router.get(
      "/",
      authentication(),
      async (req: any, res: Response, next: NextFunction) => {
        try {
          const user = await profile(req.user);
          return successResponse({
            res,
            data: { user },
          });
        } catch (err) {
          next(err);
        }
      },
    );

    // Logout
    this.router.post("/logout", authentication(), async (req: any, res: Response, next: NextFunction) => {
      try {
        const status = await logout(req.body, req.user, req.decoded);
        return successResponse({ res, status });
      } catch (err) {
        next(err);
      }
    });

    // Share User Profile
    this.router.get(
      "/:userId/share-profile",
      async (req: any, res: Response, next: NextFunction) => {
        try {
          if (req?.headers?.authorization) {
            const { user, decoded } = await decodeToken({
              token: req.headers.authorization.split(" ")[1],
              tokenType: TokenTypeEnum.access,
            });

            req.user = user;
            req.decoded = decoded;
          }
          return next();
        } catch (err) {
          next(err);
        }
      },
      validation(validators.shareProfile),
      async (req: any, res: Response, next: NextFunction) => {
        try {
          const account = await shareProfile(req.params.userId, req.user);
          return successResponse({
            res,
            data: { account },
          });
        } catch (err) {
          next(err);
        }
      },
    );

    // Rotate Token
    this.router.post(
      "/rotate-token",
      authentication(TokenTypeEnum.refresh),
      async (req: any, res: Response, next: NextFunction) => {
        try {
          const credentials = await rotateToken(
            req.user,
            req.decoded,
            `${req.protocol}://${req.host}`,
          );
          return successResponse({
            res,
            status: 201,
            data: { ...credentials },
          });
        } catch (err) {
          next(err);
        }
      },
    );

    // add Profile Image
    this.router.patch(
      "/profile-image",
      authentication(),
      localFileUpload({
        customPath: "users/profile",
        validation: fileFieldValidation.image,
        maxSize: 5,
      }).single("attachment"),
      validation(validators.profileImage),
      async (req: any, res: Response, next: NextFunction) => {
        try {
          const account = await profileImage(req.file, req.user);
          return successResponse({ res, data: { account } });
        } catch (err) {
          next(err);
        }
      },
    );

    // remove Profile Image
    this.router.delete(
      "/remove-profile-image",
      authentication(),
      async (req: any, res: Response, next: NextFunction) => {
        try {
          await removeProfileImage(req.user);
          return successResponse({
            message: "Profile image removed successfully",
            res,
          });
        } catch (err) {
          next(err);
        }
      },
    );

    // Add Cover Images
    this.router.patch(
      "/profile-cover-image",
      authentication(),
      localFileUpload({
        customPath: "users/profile/cover",
        validation: fileFieldValidation.image,
        maxSize: 5,
      }).array("attachments", 5),
      validation(validators.profileCoverImage),
      async (req: any, res: Response, next: NextFunction) => {
        try {
          const account = await profileCoverImage(req.files as any[], req.user);
          return successResponse({ res, data: { account } });
        } catch (err) {
          next(err);
        }
      },
    );

    // Change Password
    this.router.patch(
      "/change-password",
      authentication(),
      validation(validators.changePasswordSchema),
      async (req: any, res: Response, next: NextFunction) => {
        try {
          const credentials = await changePassword(
            req.body,
            req.user,
            `${req.protocol}://${req.host}`,
          );
          return successResponse({
            res,
            data: { ...credentials },
          });
        } catch (err) {
          next(err);
        }
      },
    );
  }
}

export const userController = new UserController();
export default userController.router;
