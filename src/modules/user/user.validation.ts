import { z } from "zod";
import { LogoutEnum } from "../../common/enums";
import { fileFieldValidation } from "../../common/utils/multer";
import { file, id, password } from "../../common/validation";

// Schemas
export const logoutSchema = {
  // Defaults to a single-session logout so an empty body is valid.
  body: z.object({
    flag: z.enum(LogoutEnum).default(LogoutEnum.current),
  }),
};

export const shareProfile = {
  params: z.object({ userId: id }),
};

export const profileImage = {
  file: file(fileFieldValidation.image),
};

export const profileCoverImage = {
  files: z.array(file(fileFieldValidation.image)).min(1).max(5),
};

export const profileAttachments = {
  files: z.object({
    firstAttachment: z.array(file(fileFieldValidation.image)).length(1),
    secondAttachment: z.array(file(fileFieldValidation.image)).min(1).max(5),
  }),
};

export const changePasswordSchema = {
  body: z
    .object({
      oldPassword: password,
      newPassword: password,
      confirmNewPassword: z.string("confirm password is required"),
    })
    .refine((data) => data.newPassword !== data.oldPassword, {
      message: "New password must be different from the old password",
      path: ["newPassword"],
    })
    .refine((data) => data.newPassword === data.confirmNewPassword, {
      message: "Confirm password does not match",
      path: ["confirmNewPassword"],
    }),
};

// Inferred types
export type LogoutDto = z.infer<typeof logoutSchema.body>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema.body>;
