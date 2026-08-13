import { Router, Response, NextFunction } from "express";
import {
  BadRequestException,
  successResponse,
} from "./../../common/utils/response/index.js";
import {
  deleteMessage,
  getAllMessages,
  getMessage,
  sendMessage,
} from "./message.service.js";
import {
  decodeToken,
  fileFieldValidation,
  localFileUpload,
} from "../../common/utils/index.js";
import { validation } from "../../middleware/validation.middleware.js";
import * as validators from "./message.validation.js";
import { TokenTypeEnum } from "../../common/enums/security.enum.js";
import { authentication } from "../../middleware/auth.middleware.js";

export class MessageController {
  router = Router({ caseSensitive: true, strict: true });

  constructor() {
    this.initializeRoutes();
  }

  initializeRoutes() {
    // send message
    this.router.post(
      "/:receiverId",
      async (req: any, res: Response, next: NextFunction) => {
        try {
          if (req.headers.authorization) {
            const { user, decoded } = await decodeToken({
              token: req.headers.authorization.split(" ")[1],
              tokenType: TokenTypeEnum.access,
            });

            req.user = user;
            req.decoded = decoded;
          }
          next();
        } catch (err) {
          next(err);
        }
      },
      localFileUpload({
        validation: fileFieldValidation.image,
        customPath: "Messages",
        maxSize: 1,
      }).array("attachments", 2),
      validation(validators.sendMessageSchema),
      async (req: any, res: Response, next: NextFunction) => {
        try {
          if (!req.body?.content && !req.files?.length) {
            throw BadRequestException({
              message:
                "At least one of content or attachments is required to send a message",
              extra: {
                key: "body",
                path: ["content"],
                message: "content is required",
              },
            });
          }
          const message = await sendMessage(
            req.params.receiverId,
            req.body,
            req.files as any[],
            req.user,
          );

          return successResponse({ res, status: 201, data: message });
        } catch (err) {
          next(err);
        }
      },
    );

    // get message
    this.router.get(
      "/:messageId",
      authentication(),
      validation(validators.getMessagesSchema),
      async (req: any, res: Response, next: NextFunction) => {
        try {
          const message = await getMessage(req.params.messageId, req.user);
          return successResponse({ res, data: message });
        } catch (err) {
          next(err);
        }
      },
    );

    // get all messages
    this.router.get("/", authentication(), async (req: any, res: Response, next: NextFunction) => {
      try {
        const message = await getAllMessages(req.user);
        return successResponse({ res, data: message });
      } catch (err) {
        next(err);
      }
    });

    // delete message
    this.router.delete(
      "/:messageId",
      authentication(),
      validation(validators.getMessagesSchema),
      async (req: any, res: Response, next: NextFunction) => {
        try {
          const message = await deleteMessage(req.params.messageId, req.user);
          return successResponse({ res, data: message });
        } catch (err) {
          next(err);
        }
      },
    );
  }
}

export const messageController = new MessageController();
export default messageController.router;
