import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/backend/db/client";
import { pendingRegistrations, users } from "@/backend/db/schema";
import { createEmailVerificationToken, createPendingRegistrationToken } from "@/backend/auth/tokens";
import { errorResponse } from "@/backend/auth/http";
import { hashPassword, verifyPassword } from "@/backend/auth/password";
import { signupInput } from "@/backend/auth/validation";
import { newVerificationCode, pendingRegistrationCodeHash, pendingRegistrationExpiry, removeExpiredPendingRegistrations, PENDING_REGISTRATION_MINUTES } from "@/backend/auth/pending-registration";
import { checkRateLimit, rateLimitHeaders } from "@/backend/auth/rate-limit";
import { deliverVerificationEmail, issueUserEmailVerification } from "@/backend/auth/verification-delivery";
import { verificationEmailResponse } from "@/backend/auth/email-delivery-policy";
import { canRecoverUnverifiedSignup } from "@/backend/auth/signup-recovery";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = signupInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid signup details", 400);
  const signupLimit = await checkRateLimit(request, "signup-ip", { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!signupLimit.allowed) return NextResponse.json({ error: "Too many signup attempts. Try again later." }, { status: 429, headers: rateLimitHeaders(signupLimit.retryAfterSeconds) });
  if (parsed.data.otpEnabled) return errorResponse("OTP delivery is not configured yet", 501);

  const now = new Date();
  await removeExpiredPendingRegistrations(now);
  const [existingUser, existingPending] = await Promise.all([
    db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1),
    db.select().from(pendingRegistrations).where(and(eq(pendingRegistrations.email, parsed.data.email), gt(pendingRegistrations.verificationExpiresAt, now.toISOString()))).limit(1),
  ]);

  const [user] = existingUser;
  if (user) {
    // A correctly-authenticated but unverified account can recover through
    // the same OTP screen. Verified accounts and incorrect passwords retain
    // the generic duplicate response.
    if (canRecoverUnverifiedSignup(user, await verifyPassword(parsed.data.password, user.passwordHash))) {
      const verificationLimit = await checkRateLimit(request, "email-verification", { limit: 5, windowMs: 15 * 60 * 1000 }, user.id);
      if (!verificationLimit.allowed) return NextResponse.json({ error: "Too many verification requests. Try again later." }, { status: 429, headers: rateLimitHeaders(verificationLimit.retryAfterSeconds) });
      const verification = await issueUserEmailVerification({ id: user.id, email: user.email });
      return NextResponse.json({ emailVerificationRequired: true, verificationToken: await createEmailVerificationToken(user.id), ...verificationEmailResponse(verification.delivery), message: "Please verify your email before signing in." }, { status: 202 });
    }
    return errorResponse("Unable to create account with those details", 409);
  }

  const [pendingExisting] = existingPending;
  if (pendingExisting) {
    if (!(await verifyPassword(parsed.data.password, pendingExisting.passwordHash))) return errorResponse("Unable to create account with those details", 409);
    const pendingVerificationLimit = await checkRateLimit(request, "pending-email-verification", { limit: 5, windowMs: 15 * 60 * 1000 }, pendingExisting.id);
    if (!pendingVerificationLimit.allowed) return NextResponse.json({ error: "Too many verification requests. Try again later." }, { status: 429, headers: rateLimitHeaders(pendingVerificationLimit.retryAfterSeconds) });
    const code = newVerificationCode();
    const timestamp = now.toISOString();
    const [updatedPending] = await db.update(pendingRegistrations).set({
      verificationCodeHash: pendingRegistrationCodeHash(pendingExisting.id, code),
      verificationAttemptCount: 0,
      verificationExpiresAt: pendingRegistrationExpiry(now),
      verificationClaimedAt: null,
      verificationClaimId: null,
      updatedAt: timestamp,
    }).where(and(eq(pendingRegistrations.id, pendingExisting.id), isNull(pendingRegistrations.verificationClaimId))).returning({ id: pendingRegistrations.id, email: pendingRegistrations.email });
    if (!updatedPending) return errorResponse("Unable to create account with those details", 409);
    const delivery = await deliverVerificationEmail({ to: updatedPending.email, code, expiresMinutes: PENDING_REGISTRATION_MINUTES });
    return NextResponse.json({ emailVerificationRequired: true, pendingToken: await createPendingRegistrationToken(updatedPending.id), ...verificationEmailResponse(delivery), message: "Please verify your email before signing in." }, { status: 202 });
  }

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
  try {
    await db.insert(pendingRegistrations).values(pending);
  } catch {
    return errorResponse("Unable to create account with those details", 409);
  }

  const delivery = await deliverVerificationEmail({ to: pending.email, code, expiresMinutes: PENDING_REGISTRATION_MINUTES });
  return NextResponse.json({ pendingToken: await createPendingRegistrationToken(id), emailVerificationRequired: true, ...verificationEmailResponse(delivery) }, { status: 201 });
}
