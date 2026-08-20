import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/backend/db/client";
import { pendingRegistrations, users, otpCodes } from "@/backend/db/schema";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { verifyEmailVerificationToken, verifyPendingRegistrationToken } from "@/backend/auth/tokens";
import { createEmailVerificationCode, EMAIL_VERIFICATION_MINUTES } from "@/backend/auth/email-verification";
import { isSmtpConfigured, sendEmailVerificationEmail } from "@/backend/auth/email";
import { checkRateLimit, peekRateLimit, rateLimitHeaders, verificationResendCooldownSeconds } from "@/backend/auth/rate-limit";
import { newVerificationCode, pendingRegistrationCodeHash, pendingRegistrationExpiry } from "@/backend/auth/pending-registration";

export const runtime = "nodejs";
const input = z.object({ pendingToken: z.string().min(20).max(400).optional(), verificationToken: z.string().min(20).max(400).optional() });
const RESEND_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };

function resendRateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Please wait before requesting another verification code.", retryAfterSeconds },
    { status: 429, headers: rateLimitHeaders(retryAfterSeconds) },
  );
}

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return errorResponse("Unable to send a verification email", 400);
  const pendingId = parsed.data.pendingToken ? await verifyPendingRegistrationToken(parsed.data.pendingToken) : null;
  if (pendingId) {
    const cooldown = await peekRateLimit(request, "pending-email-verification", { ...RESEND_LIMIT, cooldownSeconds: verificationResendCooldownSeconds }, pendingId);
    if (!cooldown.allowed) return resendRateLimitResponse(cooldown.retryAfterSeconds);
    const limit = await checkRateLimit(request, "pending-email-verification", RESEND_LIMIT, pendingId);
    if (!limit.allowed) return resendRateLimitResponse(limit.retryAfterSeconds);
    const [pending] = await db.select().from(pendingRegistrations).where(eq(pendingRegistrations.id, pendingId)).limit(1);
    if (!pending || new Date(pending.verificationExpiresAt).getTime() <= Date.now()) return errorResponse("This verification link is invalid or has expired", 400);
    if (!isSmtpConfigured()) return errorResponse("Email delivery is not configured yet", 503);
    const code = newVerificationCode();
    const timestamp = new Date().toISOString();
    await db.update(pendingRegistrations).set({ verificationCodeHash: pendingRegistrationCodeHash(pendingId, code), verificationAttemptCount: 0, verificationExpiresAt: pendingRegistrationExpiry(), verificationClaimedAt: null, verificationClaimId: null, updatedAt: timestamp }).where(and(eq(pendingRegistrations.id, pendingId), isNull(pendingRegistrations.verificationClaimId)));
    try {
      await sendEmailVerificationEmail({ to: pending.email, code, expiresMinutes: 10 });
    } catch {
      return errorResponse("Could not send the verification email", 503);
    }
    return NextResponse.json({ verified: false, message: "A new verification code is on its way.", resendAfterSeconds: verificationResendCooldownSeconds(limit.attempts) }, { headers: rateLimitHeaders(verificationResendCooldownSeconds(limit.attempts)) });
  }

  const accessUserId = await requireAccessToken(request);
  const tokenUserId = parsed.data.verificationToken
    ? await verifyEmailVerificationToken(parsed.data.verificationToken)
    : parsed.data.pendingToken ? await verifyEmailVerificationToken(parsed.data.pendingToken) : null;
  const userId = accessUserId ?? tokenUserId;
  if (!userId) return errorResponse("Authentication required", 401);
  const cooldown = await peekRateLimit(request, "email-verification", { ...RESEND_LIMIT, cooldownSeconds: verificationResendCooldownSeconds }, userId);
  if (!cooldown.allowed) return resendRateLimitResponse(cooldown.retryAfterSeconds);
  const verificationLimit = await checkRateLimit(request, "email-verification", RESEND_LIMIT, userId);
  if (!verificationLimit.allowed) return resendRateLimitResponse(verificationLimit.retryAfterSeconds);
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
  const resendAfterSeconds = verificationResendCooldownSeconds(verificationLimit.attempts);
  return NextResponse.json({ verified: false, message: "A new verification code is on its way.", resendAfterSeconds }, { headers: rateLimitHeaders(resendAfterSeconds) });
}
