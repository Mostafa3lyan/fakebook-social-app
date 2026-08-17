import { z } from "zod";
import { calculateAge } from "../../common/utils";
import { GenderEnum } from "../../common/enums";

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
      firstName: z
        .string()
        .trim()
        .min(1, "First name is required")
        .max(50, "First name is too long")
        .regex(/^[\p{L}'-]+$/u, "First name must be one word"),
      lastName: z
        .string()
        .trim()
        .min(1, "Last name is required")
        .max(50, "Last name is too long")
        .regex(/^[\p{L}'-]+$/u, "Last name must be one word"),
      phone: z.string("phone is required").regex(/^(?:\+20|0)?1[0125]\d{8}$/),
      dateOfBirth: z.coerce
        .date({ error: "date of birth is required or invalid" })
        .refine((d) => d <= new Date(), { message: "Date of birth cannot be in the future" })
        .refine((d) => d >= new Date("1900-01-01"), { message: "Date of birth is not valid" })
        .refine((d) => calculateAge(d) >= 13, { message: `You must be at least ${13} years old` }),
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