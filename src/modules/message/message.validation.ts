import Joi from "joi";
import { generalValidationFields } from "../../common/utils/validation.js";
import { fileFieldValidation } from "../../common/utils/index.js";

export const sendMessageSchema = {
  params: Joi.object().keys({
    receiverId: generalValidationFields.id.required(),
  }).required(),
  body: Joi.object().keys({
    content: Joi.string().min(2).max(1000)
  }),
  files: Joi.array().items(generalValidationFields.file(fileFieldValidation.image)).min(0).max(2),
};

export const getMessagesSchema = {
  params: Joi.object().keys({
    messageId: generalValidationFields.id.required(),
  }).required(),
};
