import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { users, otpCodes } from "@/backend/db/schema";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { createEmailVerificationCode, EMAIL_VERIFICATION_MINUTES } from "@/backend/auth/email-verification";
import { isSmtpConfigured, sendEmailVerificationEmail } from "@/backend/auth/email";
import { checkRateLimit, rateLimitHeaders } from "@/backend/auth/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const verificationLimit = await checkRateLimit(request, "email-verification", { limit: 5, windowMs: 15 * 60 * 1000 }, userId);
  if (!verificationLimit.allowed) return NextResponse.json({ error: "Too many verification requests. Try again later." }, { status: 429, headers: rateLimitHeaders(verificationLimit.retryAfterSeconds) });
  const [user] = await db.select({ id: users.id, email: users.email, emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return errorResponse("Authentication required", 401);
  if (user.emailVerifiedAt) return NextResponse.json({ verified: true, message: "Your email is already verified." });
  if (!isSmtpConfigured()) return errorResponse("Email delivery is not configured yet", 503);
  const verification = await createEmailVerificationCode(user.id);
  try {
    await sendEmailVerificationEmail({ to: user.email, code: verification.code, expiresMinutes: EMAIL_VERIFICATION_MINUTES });
  } catch {
    await db.delete(otpCodes).where(and(eq(otpCodes.id, verification.id), isNull(otpCodes.consumedAt)));
    return errorResponse("Could not send the verification email", 503);
  }
  return NextResponse.json({ verified: false, message: "A new verification code is on its way." });
}
