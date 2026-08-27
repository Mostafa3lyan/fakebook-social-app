import { Router, type Request, type Response } from "express";
import { RoleEnum, TokenTypeEnum } from "../../common/enums";
import { successResponse } from "../../common/response/success.response.js";
import { decodedTypes } from "../../common/types/user.types.js";
// import { localFileUpload } from "../../common/utils/multer";
import { cloudFileUpload, fileFieldValidation } from "../../common/utils/multer";
import { authentication, authorization } from "../../middleware/index";
import { validation } from "../../middleware/validation.middleware";
import userService from "./user.service.js";
import * as validators from "./user.validation.js";

const router = Router();

// User Profile
router.get("/",
  authentication(),
  authorization([RoleEnum.User]),
  async (req: Request, res: Response) => {
    const profile = await userService.profile(req.user);
    return successResponse({
      res,
      data: { profile },
    });
  },
);

// Logout
router.post(
  "/logout",
  authentication(),
  validation(validators.logoutSchema),
  async (req: Request, res: Response) => {
    const status = await userService.logout(req.body, req.user, req.decoded as decodedTypes);
    return successResponse({ res, status });
  },
);

// Rotate Token
router.post(
  "/rotate-token",
  authentication(TokenTypeEnum.refresh),
  async (req: Request, res: Response) => {
    const credentials = await userService.rotateToken(
      req.user,
      req.decoded as decodedTypes,
      `${req.protocol}://${req.host}`,
    );
    return successResponse({
      res,
      status: 201,
      data: { ...credentials },
    });
  },
);

// // Share User Profile
// router.get(
//   "/:userId/share-profile",
//   async (req: Request, res: Response, next: NextFunction) => {
//     if (req?.headers?.authorization) {
//       const { user, decoded } = await this.tokenService.decodeToken({
//         token: req.headers.authorization.split(" ")[1],
//         tokenType: TokenTypeEnum.access,
//       });

//       req.user = user;
//       req.decoded = decoded;
//     }
//     return next();
//   },
//   validation(validators.shareProfile),
//   async (req: Request, res: Response) => {
//     const account = await userService.shareProfile(req.params.userId, req.user);
//     return successResponse({
//       res,
//       data: { account },
//     });
//   },
// );



// add Profile Image
router.patch(
  "/profile-image",
  authentication(),
  // cloudFileUpload({
  //   validation: fileFieldValidation.image,
  // }).single("attachment"),
  // validation(validators.profileImage),
  async (req: Request, res: Response) => {
    const data = await userService.profileImage(
      req.body,
      req.user,
    );
    return successResponse({ res, data });
  },
);

// // remove Profile Image
// router.delete(
//   "/remove-profile-image",
//   authentication(),
//   async (req: Request, res: Response) => {
//     await userService.removeProfileImage(req.user);
//     return successResponse({
//       message: "Profile image removed successfully",
//       res,
//     });
//   },
// );

// // Add Cover Images
// router.patch(
//   "/profile-cover-image",
//   authentication(),
//   localFileUpload({
//     customPath: "users/profile/cover",
//     validation: fileFieldValidation.image,
//     maxSize: 5,
//   }).array("attachments", 5),
//   validation(validators.profileCoverImage),
//   async (req: Request, res: Response) => {
//     const account = await userService.profileCoverImage(req.files as any[], req.user);
//     return successResponse({ res, data: { account } });
//   },
// );

// // Change Password
// router.patch(
//   "/change-password",
//   authentication(),
//   validation(validators.changePasswordSchema),
//   async (req: Request, res: Response) => {
//     const credentials = await userService.changePassword(
//       req.body,
//       req.user,
//       `${req.protocol}://${req.host}`,
//     );
//     return successResponse({
//       res,
//       data: { ...credentials },
//     });
//   },
// );

export default router;