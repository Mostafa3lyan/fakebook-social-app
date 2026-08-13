import { Router, type Request, type Response } from "express";
import { BadRequestException } from "../../common/exceptions/index";
import { IUser } from "../../common/interfaces";
import { successResponse } from "../../common/response";
import { authentication, validation } from "../../middleware";
import { ILoginResponse } from "./auth.entity";
import authService from "./auth.service";
import * as validators from "./auth.validation.js";

const router = Router();

// login
router.post(
  "/login",
  validation(validators.loginSchema),
  async (req: Request, res: Response) => {
    const data = await authService.login(req.body, `${req.protocol}://${req.host}`);
    return successResponse<ILoginResponse>({ res, data });
  },
);

// signup
router.post(
  "/signup",
  validation(validators.signupSchema),
  async (req: Request, res: Response) => {
    const data = await authService.signup(req.body);
    return successResponse<IUser>({ res, status: 201, data });
  },
);

// confirm email
router.patch(
  "/confirm-email",
  validation(validators.emailOtpSchema),
  async (req: Request, res: Response) => {
    await authService.confirmEmail(req.body);
    return successResponse({
      message: "Email confirmed successfully",
      res,
    });
  },
);

// resend confirm email
router.patch(
  "/resend-confirm-email",
  validation(validators.emailSchema),
  async (req: Request, res: Response) => {
    await authService.reSendConfirmEmail(req.body);
    return successResponse({
      message: "We have sent you another otp",
      res,
    });
  },
);

// forgot password
router.post(
  "/forgot-password",
  validation(validators.forgotPasswordSchema),
  async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body);
    return successResponse({
      message: "If this email exists, a reset link or code has been sent",
      res,
    });
  },
);

// verify otp (method: otp)
router.post(
  "/verify-otp",
  validation(validators.emailOtpSchema),
  async (req: Request, res: Response) => {
    await authService.verifyOtp(req.body);
    return successResponse({
      message: "OTP verified successfully",
      res,
    });
  },
);

// verify magic link (method: magic-link)
router.get(
  "/verify-link",
  async (req: Request, res: Response) => {
    const token = req.query.token;
    if (typeof token !== "string") {
      throw new BadRequestException("Invalid or missing token");
    }
    await authService.verifyMagicLink(token);
    return successResponse({
      message: "Email verified successfully",
      res,
    });
  },
);

// reset password (shared)
router.patch(
  "/reset-password",
  validation(validators.resetPasswordSchema),
  async (req: Request, res: Response) => {
    const account = await authService.resetPassword(req.body);
    return successResponse({
      message: "Password reset successfully",
      res,
      data: { user: account },
    });
  },
);

// signup with gmail
router.post("/signup/gmail", async (req: Request, res: Response) => {
  const { message, status, credentials } = await authService.signupWithGmail(
    req.body.idToken,
    `${req.protocol}://${req.host}`,
  );
  return successResponse({
    message,
    status,
    res,
    data: { ...credentials },
  });
});

// login confirm (2fa)
router.post(
  "/login-confirm",
  validation(validators.emailOtpSchema),
  async (req: Request, res: Response) => {
    const credentials = await authService.loginConfirm(
      req.body,
      `${req.protocol}://${req.host}`,
    );
    return successResponse({
      message: "logged in successfully",
      res,
      data: { ...credentials },
    });
  },
);

// request 2fa code
router.patch("/request-2fa", authentication(), async (req: Request, res: Response) => {
  await authService.requestTwoFactorAuth(req.user);
  return successResponse({
    message: "2fa code sent successfully",
    res,
  });
});

// verify 2fa code and enable 2fa
router.patch(
  "/enable-2fa",
  authentication(),
  validation(validators.otpSchema),
  async (req: Request, res: Response) => {
    await authService.enableTwoFactorAuth(req.user, req.body);
    return successResponse({
      message: "2fa enabled successfully",
      res,
    });
  },
);

export default router;