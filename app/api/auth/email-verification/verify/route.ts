import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/backend/db/client";
import { pendingRegistrations, users } from "@/backend/db/schema";
import { errorResponse, requireAccessToken, setRefreshTokenCookie } from "@/backend/auth/http";
import { createSession, verifyEmailVerificationToken, verifyPendingRegistrationToken } from "@/backend/auth/tokens";
import { verifyEmailVerificationCode } from "@/backend/auth/email-verification";
import { claimPendingRegistration, recordPendingVerificationFailure, PENDING_REGISTRATION_MAX_ATTEMPTS } from "@/backend/auth/pending-registration";
import { toPublicUserProfile } from "@/backend/auth/profile";

export const runtime = "nodejs";

const input = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  pendingToken: z.string().min(20).max(400).optional(),
  verificationToken: z.string().min(20).max(400).optional(),
});

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Enter the 6-digit verification code", 400);
  const now = new Date();

  const pendingId = parsed.data.pendingToken ? await verifyPendingRegistrationToken(parsed.data.pendingToken) : null;
  if (pendingId) {
    const claim = await claimPendingRegistration(pendingId, parsed.data.code, now);
    if (!claim) {
      const [pending] = await db.select({ attempts: pendingRegistrations.verificationAttemptCount }).from(pendingRegistrations).where(eq(pendingRegistrations.id, pendingId)).limit(1);
      if (pending) await recordPendingVerificationFailure(pendingId, now);
      return errorResponse(pending && pending.attempts + 1 >= PENDING_REGISTRATION_MAX_ATTEMPTS ? "That code has expired. Request a new one." : "That code is not correct", 400);
    }
    const timestamp = now.toISOString();
    const user = {
      id: randomUUID(), name: "", email: claim.email, phone: claim.phone, passwordHash: claim.passwordHash, currency: claim.currency,
      hideTotalBalance: false, monthlyReportEnabled: false, onboardingCompleted: false, budgetOnboardingCompleted: false,
      tutorialStartedAt: null, tutorialCompletedAt: null, otpEnabled: false, twoFactorEnabled: false,
      twoFactorSecretEncrypted: null, twoFactorSetupSecretEncrypted: null, twoFactorBackupCodes: null, twoFactorVerifiedAt: null,
      emailVerifiedAt: timestamp, phoneVerifiedAt: null, biometricLockEnabled: false, pwaInstallDismissedAt: null, lastLoginAt: timestamp,
      avatarPreset: "sunrise", createdAt: timestamp, updatedAt: timestamp,
    };
    try {
      await db.batch([
        db.insert(users).values(user),
        db.delete(pendingRegistrations).where(and(eq(pendingRegistrations.id, pendingId), eq(pendingRegistrations.verificationClaimId, claim.claimId))),
      ]);
    } catch {
      await db.update(pendingRegistrations).set({ verificationClaimId: null, verificationClaimedAt: null, updatedAt: timestamp }).where(and(eq(pendingRegistrations.id, pendingId), eq(pendingRegistrations.verificationClaimId, claim.claimId)));
      return errorResponse("That code is not correct", 400);
    }
    const session = await createSession(user.id);
    const response = NextResponse.json({ verified: true, user: toPublicUserProfile(user), accessToken: session.accessToken, expiresIn: session.expiresIn, message: "Email verified." });
    setRefreshTokenCookie(response, session.refreshToken);
    return response;
  }

  const accessUserId = await requireAccessToken(request);
  const tokenUserId = parsed.data.verificationToken
    ? await verifyEmailVerificationToken(parsed.data.verificationToken)
    : parsed.data.pendingToken ? await verifyEmailVerificationToken(parsed.data.pendingToken) : null;
  const userId = accessUserId ?? tokenUserId;
  if (!userId) return errorResponse("This verification link is invalid or has expired", 400);
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return errorResponse("This verification link is invalid or has expired", 400);
  if (user.emailVerifiedAt) return NextResponse.json({ verified: true, message: "Your email is already verified." });
  const result = await verifyEmailVerificationCode(userId, parsed.data.code);
  if (!result.valid) return errorResponse(result.exhausted ? "That code has expired. Request a new one." : "That code is not correct", 400);
  const timestamp = now.toISOString();
  await db.update(users).set({ emailVerifiedAt: timestamp, updatedAt: timestamp }).where(and(eq(users.id, userId), isNull(users.emailVerifiedAt)));
  const session = await createSession(userId);
  const response = NextResponse.json({ verified: true, user: toPublicUserProfile({ ...user, emailVerifiedAt: timestamp }), accessToken: session.accessToken, expiresIn: session.expiresIn, message: "Email verified." });
  setRefreshTokenCookie(response, session.refreshToken);
  return response;
}
