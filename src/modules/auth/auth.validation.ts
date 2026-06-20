import { z } from "zod";

// Reusable primitives

const email = z.email("invalid email address");
const password = z.string("password is required").min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,30}$/);
const otp = z.string("otp is required").length(6).regex(/^\d+$/);

// Schemas

export const loginSchema = {
  body: z.object({
    email,
    password,
  }),
}
export const signupSchema = {
  body: loginSchema.body
    .extend({
      fullName: z.string("fullname is required").min(2).max(64),
      phone: z.string("phone is required").regex(/^(?:\+20|0)?1[0125]\d{8}$/),
      confirmPassword: z.string("confirm password is required"),
      role: z.enum(["user", "admin"]).default("user"),
      gender: z.enum(["male", "female"]),
    })
    .refine(
      (data) => data.password === data.confirmPassword,
      { message: "Confirm password does not match password", path: ["confirmPassword"] }
    ),

  query: z.strictObject({
    lang: z.enum(["ar", "en"]),
  }),
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
export type ForgotDto = z.infer<typeof forgotPasswordSchema>;
export type OtpDto = z.infer<typeof otpSchema>;
export type EmailOtpDto = z.infer<typeof emailOtpSchema>;
export type EmailDto = z.infer<typeof emailSchema>;
export type ResetDto = z.infer<typeof resetPasswordSchema>;