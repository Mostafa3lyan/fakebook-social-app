import { z } from "zod";
import { GenderEnum } from "../../common/enums";
import { dateOfBirth, email, name, otp, password, phone } from "../../common/validation";

// Schemas
export const loginSchema = {
  body: z.object({
    email,
    password,
    fcmToken: z.string().optional(),
  }),
}
export const signupSchema = {
  body: loginSchema.body
    .extend({
      firstName: name("First name"),
      lastName: name("Last name"),
      phone,
      dateOfBirth,
      confirmPassword: z.string("confirm password is required"),
      gender: z.enum(GenderEnum, { error: "gender is required", }),
    })
    .refine(
      (data) => data.password === data.confirmPassword,
      { message: "Confirm password does not match password", path: ["confirmPassword"] }
    ),

  // query: z.strictObject({
  //   lang: z.enum(["ar", "en"]),
  // }),
};

export const forgotPasswordSchema = {
  body: z.object({
    email,
    method: z.enum(["otp", "link"]).default("otp"),
  }),
};

export const otpSchema = {
  body: z.object({ otp }),
};

export const gmailSchema = {
  body: z.object({ idToken: z.string("idToken is required").min(1) }),
};

export const emailOtpSchema = {
  body: z.object({ email, otp }),
};

export const emailSchema = {
  body: z.object({ email }),
};

export const resetPasswordSchema = {
  body: loginSchema.body
    .extend({
      confirmPassword: z.string(),
    })
    .refine(
      (data) => data.password === data.confirmPassword,
      { message: "Confirm password does not match", path: ["confirmPassword"] }
    ),
};

// Inferred types
export type LoginDto = z.infer<typeof loginSchema.body>
export type SignupDto = z.infer<typeof signupSchema.body>
export type ForgotDto = z.infer<typeof forgotPasswordSchema.body>;
export type OtpDto = z.infer<typeof otpSchema.body>;
export type EmailOtpDto = z.infer<typeof emailOtpSchema.body>;
export type EmailDto = z.infer<typeof emailSchema.body>;
export type ResetDto = z.infer<typeof resetPasswordSchema.body>;