import { z } from "zod";
import { LogoutEnum } from "../../common/enums";

export const logoutSchema = {
  // Defaults to a single-session logout so an empty body is valid.
  body: z.object({
    flag: z.enum(LogoutEnum).default(LogoutEnum.current),
  }),
};

// import Joi from "joi";
// import { generalValidationFields } from "../../common/utils/index.js";
// import { fileFieldValidation } from "../../common/utils/multer/validation.multer.js";

// export const shareProfile = {
//   params: Joi.object()
//     .keys({
//       userId: generalValidationFields.id.required(),
//     })
//     .required(),
// };

// export const profileImage = {
//   file: generalValidationFields.file(fileFieldValidation.image).required(),
// };

// export const profileCoverImage = {
//   files: Joi.array()
//     .items(generalValidationFields.file(fileFieldValidation.image).required())
//     .min(1)
//     .max(5)
//     .required(),
// };

// export const profileAttachments = {
//   files: Joi.object()
//     .keys({
//       firstAttachment: Joi.array()
//         .items(
//           generalValidationFields.file(fileFieldValidation.image).required(),
//         )
//         .length(1)
//         .required(),
//       secondAttachment: Joi.array()
//         .items(
//           generalValidationFields.file(fileFieldValidation.image).required(),
//         )
//         .min(1)
//         .max(5)
//         .required(),
//     })
//     .required(),
// };

// export const changePasswordSchema = {
//   body: Joi.object()
//     .keys({
//       oldPassword: generalValidationFields.password.required(),
//       newPassword: generalValidationFields.password.not(Joi.ref("oldPassword")).required(),
//       confirmNewPassword: generalValidationFields
//         .confirmPassword("newPassword")
//         .required()
//         .messages({ "any.only": "Confirm password does not match" }),
//     })
//     .required(),
// };
