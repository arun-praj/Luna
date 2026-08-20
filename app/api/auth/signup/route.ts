import { randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/backend/db/client";
import { pendingRegistrations, users } from "@/backend/db/schema";
import { createPendingRegistrationToken } from "@/backend/auth/tokens";
import { errorResponse } from "@/backend/auth/http";
import { hashPassword } from "@/backend/auth/password";
import { signupInput } from "@/backend/auth/validation";
import { isSmtpConfigured, sendEmailVerificationEmail } from "@/backend/auth/email";
import { newVerificationCode, pendingRegistrationCodeHash, pendingRegistrationExpiry, removeExpiredPendingRegistrations, PENDING_REGISTRATION_MINUTES } from "@/backend/auth/pending-registration";
import { checkRateLimit, rateLimitHeaders } from "@/backend/auth/rate-limit";


export async function POST(request: Request) {
  const parsed = signupInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid signup details", 400);
  const signupLimit = await checkRateLimit(request, "signup-ip", { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!signupLimit.allowed) return NextResponse.json({ error: "Too many signup attempts. Try again later." }, { status: 429, headers: rateLimitHeaders(signupLimit.retryAfterSeconds) });
  if (parsed.data.otpEnabled) return errorResponse("OTP delivery is not configured yet", 501);

  const now = new Date();
  await removeExpiredPendingRegistrations(now);
  const [existingUser, existingPending] = await Promise.all([
    db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1),
    db.select({ id: pendingRegistrations.id }).from(pendingRegistrations).where(and(eq(pendingRegistrations.email, parsed.data.email), gt(pendingRegistrations.verificationExpiresAt, now.toISOString()))).limit(1),
  ]);
  // Keep account existence and pending-registration state intentionally
  // indistinguishable to callers. No normal session is issued here.
  if (existingUser.length || existingPending.length) return errorResponse("Unable to create account with those details", 409);

  const id = randomUUID();
  const code = newVerificationCode();
  const timestamp = now.toISOString();
  const pending = {
    id,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    passwordHash: await hashPassword(parsed.data.password),
    currency: parsed.data.currency,
    verificationCodeHash: pendingRegistrationCodeHash(id, code),
    verificationAttemptCount: 0,
    verificationExpiresAt: pendingRegistrationExpiry(now),
    verificationClaimedAt: null,
    verificationClaimId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.insert(pendingRegistrations).values(pending);

  let verificationEmailSent = false;
  if (isSmtpConfigured()) {
    try {
      await sendEmailVerificationEmail({ to: pending.email, code, expiresMinutes: PENDING_REGISTRATION_MINUTES });
      verificationEmailSent = true;
    } catch {
      // Keep the pending record. It contains only a password hash and a
      // hashed code; the user may retry delivery without creating duplicates.
    }
  }

  return NextResponse.json({ pendingToken: await createPendingRegistrationToken(id), emailVerificationRequired: true, verificationEmailSent }, { status: 201 });
}
