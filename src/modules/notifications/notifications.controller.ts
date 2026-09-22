import { Router, type Request, type Response } from "express";
import { authentication } from "../../middleware";
import { successResponse } from "../../common/response";
import { notificationsService } from "./notifications.service";

const router = Router();


router.post("/fcm-token",
  authentication(),
  async (req: Request, res: Response) => {
    const { token } = req.body;

    await notificationsService.sendUserFcmToken(
      req.user.id,
      token,
    );

    return successResponse({
      message: "FCM token registered successfully",
      res,
    });
  }
);


router.post("/notifyNewMessage",
  authentication(),
  async (req: Request, res: Response) => {
    const { recipientId, message } = req.body;

    await notificationsService.notifyNewMessage(
      recipientId,
      message,
    );

    return successResponse({
      message: "New message notification sent successfully",
      res,
    });
  }
);





export default router;