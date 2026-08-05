import { EventEmitter } from "node:events";
import { sendEmail } from "./send.email.js";
import { emailTemplate } from "./template.email.js";

export const emailEmitter = new EventEmitter();

interface SendOtpEmailParams {
  to: string;
  title?: string;
  subject?: string;
  code: string | number;
}

emailEmitter.on(
  "sendOtpEmail",
  async ({
    to,
    title = "email address",
    subject = "verify your email",
    code,
  }: SendOtpEmailParams) => {
    try {
      await sendEmail({
        to,
        subject,
        html: emailTemplate(code, to, title, subject),
      });
    } catch (error) {
      console.log(`failed to send email ${error}`);
    }
  },
);
