import { Router } from "express";
import { type Request, type Response, type NextFunction } from "express";
import authService from "./auth.service";
import { successResponse } from "../../common/response";
import { ILoginResponse, ISignupResponse } from "./auth.entity";
// import { confirmEmail, enableTwoFactorAuth, forgotPassword, login, loginConfirm, requestTwoFactorAuth, reSendConfirmEmail, resetPassword, signup, signupWithGmail, verifyMagicLink, verifyOtp } from "./auth.service.js";
// import { successResponse } from "./../../common/utils/response/success.response.js";
// import * as validators from "./auth.validation.js";
// import { validation } from "../../middleware/validation.middleware.js";
// import { authentication } from './../../middleware/index.js';

// export class AuthController {
const router = Router();
  

router.post("/login", (req: Request, res: Response, next: NextFunction) => {
  const data = authService.login(req.body);
  return successResponse<ILoginResponse>({
    res,
    data,
  });
})


router.post("/signup", (req: Request, res: Response, next: NextFunction) => {
  const data = authService.signup(req.body);
  return successResponse<ISignupResponse>({
    res,
    status: 201,
    data,
  });
})

//   constructor() {
//     this.initializeRoutes();
//   }

//   initializeRoutes() {
//     this.router.post("/signup", validation(validators.signupSchema), async (req, res, next) => {
//       try {
//         const user = await signup(req.body);
//         return successResponse({
//           message: "signed up successfully",
//           status: 201,
//           res,
//           data: { user },
//         });
//       } catch (err) {
//         next(err);
//       }
//     });

//     this.router.patch(
//       "/confirm-email",
//       validation(validators.emailOtpSchema),
//       async (req, res, next) => {
//         try {
//           await confirmEmail(req.body);
//           return successResponse({
//             message: "Email confirmed successfully",
//             res,
//           });
//         } catch (err) {
//           next(err);
//         }
//       },
//     );

//     this.router.patch(
//       "/resend-confirm-email",
//       validation(validators.emailSchema),
//       async (req, res, next) => {
//         try {
//           await reSendConfirmEmail(req.body);
//           return successResponse({
//             message: "We have sent you another otp",
//             res,
//           });
//         } catch (err) {
//           next(err);
//         }
//       },
//     );

//     this.router.post(
//       "/forgot-password",
//       validation(validators.forgotPasswordSchema),
//       async (req, res, next) => {
//         try {
//           await forgotPassword(req.body);
//           return successResponse({
//             message: "If this email exists, a reset link or code has been sent",
//             res,
//           });
//         } catch (err) {
//           next(err);
//         }
//       },
//     );

//     this.router.post(
//       "/verify-otp",
//       validation(validators.emailOtpSchema),
//       async (req, res, next) => {
//         try {
//           await verifyOtp(req.body);
//           return successResponse({
//             message: "OTP verified successfully",
//             res,
//           });
//         } catch (err) {
//           next(err);
//         }
//       },
//     );

//     this.router.get(
//       "/verify-link",
//       async (req: any, res, next) => {
//         try {
//           await verifyMagicLink(req.query.token);
//           return successResponse({
//             message: "Email verified successfully",
//             res,
//           });
//         } catch (err) {
//           next(err);
//         }
//       },
//     );

//     this.router.patch(
//       "/reset-password",
//       validation(validators.resetPasswordSchema),
//       async (req, res, next) => {
//         try {
//           const account = await resetPassword(req.body);
//           return successResponse({
//             message: "Password reset successfully",
//             res,
//             data: { user: account },
//           });
//         } catch (err) {
//           next(err);
//         }
//       },
//     );

//     this.router.post("/signup/gmail", async (req, res, next) => {
//       try {
//         const { message, status, credentials } = await signupWithGmail(
//           req.body.idToken,
//           `${req.protocol}://${req.host}`,
//         );
//         return successResponse({
//           message,
//           status,
//           res,
//           data: { ...credentials },
//         });
//       } catch (err) {
//         next(err);
//       }
//     });

//     this.router.post(
//       "/login",
//       validation(validators.loginSchema),
//       async (req, res, next) => {
//         try {
//           const result = await login(req.body, `${req.protocol}://${req.host}`);

//           if (result && 'twoFactorRequired' in result && result.twoFactorRequired) {
//             return successResponse({
//               res,
//               status: 200,
//               message: "2FA code sent to your email. Please verify to continue.",
//             });
//           }

//           return successResponse({
//             message: "Logged in successfully",
//             res,
//             data: { ...result },
//           });
//         } catch (err) {
//           next(err);
//         }
//       },
//     );

//     this.router.post(
//       "/login-confirm",
//       validation(validators.emailOtpSchema),
//       async (req, res, next) => {
//         try {
//           const credentials = await loginConfirm(
//             req.body,
//             `${req.protocol}://${req.host}`,
//           );
//           return successResponse({
//             message: "logged in successfully",
//             res,
//             data: { ...credentials },
//           });
//         } catch (err) {
//           next(err);
//         }
//       },
//     );

//     this.router.patch("/request-2fa", authentication(), async (req: any, res, next) => {
//       try {
//         await requestTwoFactorAuth(req.user);
//         return successResponse({
//           message: "2fa code sent successfully",
//           res,
//         });
//       } catch (err) {
//         next(err);
//       }
//     });

//     this.router.patch(
//       "/enable-2fa",
//       authentication(),
//       validation(validators.otpSchema),
//       async (req: any, res, next) => {
//         try {
//           await enableTwoFactorAuth(req.user, req.body);
//           return successResponse({
//             message: "2fa enabled successfully",
//             res,
//           });
//         } catch (err) {
//           next(err);
//         }
//       },
//     );
//   }
// }

// export const authController = new AuthController();
export default router;