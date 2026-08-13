import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/backend/db/client";
import { pendingRegistrations, users, otpCodes } from "@/backend/db/schema";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { verifyEmailVerificationToken, verifyPendingRegistrationToken } from "@/backend/auth/tokens";
import { createEmailVerificationCode, EMAIL_VERIFICATION_MINUTES } from "@/backend/auth/email-verification";
import { isSmtpConfigured, sendEmailVerificationEmail } from "@/backend/auth/email";
import { checkRateLimit, rateLimitHeaders } from "@/backend/auth/rate-limit";
import { newVerificationCode, pendingRegistrationCodeHash, pendingRegistrationExpiry } from "@/backend/auth/pending-registration";

export const runtime = "nodejs";
const input = z.object({ pendingToken: z.string().min(20).max(400).optional(), verificationToken: z.string().min(20).max(400).optional() });

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return errorResponse("Unable to send a verification email", 400);
  const pendingId = parsed.data.pendingToken ? await verifyPendingRegistrationToken(parsed.data.pendingToken) : null;
  if (pendingId) {
    const limit = await checkRateLimit(request, "pending-email-verification", { limit: 5, windowMs: 15 * 60 * 1000 }, pendingId);
    if (!limit.allowed) return NextResponse.json({ error: "Too many verification requests. Try again later." }, { status: 429, headers: rateLimitHeaders(limit.retryAfterSeconds) });
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
    return NextResponse.json({ verified: false, message: "A new verification code is on its way." });
  }

  const accessUserId = await requireAccessToken(request);
  const tokenUserId = parsed.data.verificationToken
    ? await verifyEmailVerificationToken(parsed.data.verificationToken)
    : parsed.data.pendingToken ? await verifyEmailVerificationToken(parsed.data.pendingToken) : null;
  const userId = accessUserId ?? tokenUserId;
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
