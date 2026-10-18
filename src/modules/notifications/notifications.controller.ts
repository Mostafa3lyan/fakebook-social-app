import { Router, type Request, type Response } from "express";
import { RoleEnum } from "../../common/enums";
import { successResponse } from "../../common/response";
import { notificationsService } from "../../common/services";
import { authentication, authorization, validation } from "../../middleware";
import * as validators from "./notification.validation";
const router = Router();


router.post(
  "/fcm-token",
  authentication(),
  validation(validators.fcmTokenSchema),
  async (req: Request, res: Response) => {
    const { token } = req.body;

    await notificationsService.sendUserFcmToken(
      req.user._id.toString(),
      token,
    );

    return successResponse({
      message: "FCM token registered successfully",
      res,
    });
  },
);

router.post(
  "/notifyNewMessage",
  authentication(),
  authorization([RoleEnum.Admin]),
  validation(validators.notifyNewMessageSchema),
  async (req: Request, res: Response) => {
    const { recipientId, message } = req.body;

    await notificationsService.notifyNewMessage({
      recipientId,
      message,
    });

    return successResponse({
      message: "New message notification sent successfully",
      res,
    });
  },
);

export default router;