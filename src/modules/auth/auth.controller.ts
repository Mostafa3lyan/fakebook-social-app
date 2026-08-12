import { Router, type NextFunction, type Request, type Response } from "express";
import { successResponse } from "../../common/response";
import { ILoginResponse, ISignupResponse } from "./auth.entity";
import authService from "./auth.service";
import * as validators from "./auth.validation.js";
import { validation } from "../../middleware";

const router = Router();

router.post(
  "/login",
  validation(validators.loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
      const data = await authService.login(req.body, `${req.protocol}://${req.host}`);
      return successResponse<ILoginResponse>({ res, data });
  },
);

router.post(
  "/signup",
  validation(validators.signupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
      const data = await authService.signup(req.body);
      return successResponse<ISignupResponse>({ res, status: 201, data });
  },
);

router.patch(
  "/confirm-email",
  validation(validators.emailOtpSchema),
  async (req: Request, res: Response, next: NextFunction) => {
      await authService.confirmEmail(req.body);
      return successResponse({
        message: "Email confirmed successfully",
        res,
      });
  },
);

router.patch(
  "/resend-confirm-email",
  validation(validators.emailSchema),
  async (req: Request, res: Response, next: NextFunction) => {
      await authService.reSendConfirmEmail(req.body);
      return successResponse({
        message: "We have sent you another otp",
        res,
      });
  },
);

export default router;