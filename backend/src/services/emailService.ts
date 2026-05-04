import { Resend } from "resend";
import { env } from "../config/env.js";

const FORGOT_PASSWORD_MESSAGE =
  "If an account exists for that email, we sent instructions to reset your password.";

export function forgotPasswordPublicMessage(): string {
  return FORGOT_PASSWORD_MESSAGE;
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn(
      "[email] RESEND_API_KEY is not set; skipping password reset email",
    );
    return;
  }

  if (!env.EMAIL_FROM) {
    console.warn(
      "[email] EMAIL_FROM is not set; skipping password reset email",
    );
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "Reset your Trailread password",
    text: `Reset your password by visiting:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Reset your password by clicking the link below.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });

  if (error) {
    console.error("[email] Resend error:", error);
    throw new Error("Failed to send email");
  }
}
