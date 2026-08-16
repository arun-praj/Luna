import { getRequestExecutionContext } from "vinext/shims/request-context";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { otpCodes } from "@/backend/db/schema";
import { createEmailVerificationCode, EMAIL_VERIFICATION_MINUTES } from "@/backend/auth/email-verification";
import { isSmtpConfigured, sendEmailVerificationEmail } from "@/backend/auth/email";
import { executeVerificationEmailDelivery, type VerificationEmailDeliveryStatus } from "@/backend/auth/email-delivery-policy";

type Cleanup = () => Promise<unknown>;

export async function deliverVerificationEmail({
  to,
  code,
  expiresMinutes = EMAIL_VERIFICATION_MINUTES,
  onFailure,
}: {
  to: string;
  code: string;
  expiresMinutes?: number;
  onFailure?: Cleanup;
}): Promise<VerificationEmailDeliveryStatus> {
  if (!isSmtpConfigured()) {
    if (onFailure) {
      try {
        await onFailure();
      } catch {
        // The code is no longer usable and scheduled maintenance remains the
        // fallback if storage cleanup is temporarily unavailable.
      }
    }
    return "unavailable";
  }

  const send = () => sendEmailVerificationEmail({ to, code, expiresMinutes });
  return executeVerificationEmailDelivery({ send, context: getRequestExecutionContext(), onFailure });
}

export async function issueUserEmailVerification(user: { id: string; email: string }) {
  const verification = await createEmailVerificationCode(user.id);
  const delivery = await deliverVerificationEmail({
    to: user.email,
    code: verification.code,
    onFailure: async () => {
      await db
        .delete(otpCodes)
        .where(and(eq(otpCodes.id, verification.id), isNull(otpCodes.consumedAt)));
    },
  });
  return { ...verification, delivery };
}
