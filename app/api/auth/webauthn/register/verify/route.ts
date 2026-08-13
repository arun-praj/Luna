import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { db } from "@/backend/db/client";
import { users, webauthnChallenges, webauthnCredentials } from "@/backend/db/schema";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { bytesToBase64Url, webAuthnConfig } from "@/backend/auth/webauthn";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const body = await request.json().catch(() => null) as { response?: RegistrationResponseJSON; deviceLabel?: string } | null;
  if (!body?.response || typeof body.response !== "object") return errorResponse("Invalid biometric registration", 400);
  const now = new Date().toISOString();
  const [challenge] = await db.update(webauthnChallenges).set({ consumedAt: now }).where(and(eq(webauthnChallenges.userId, userId), eq(webauthnChallenges.purpose, "registration"), isNull(webauthnChallenges.consumedAt), gt(webauthnChallenges.expiresAt, now))).returning({ challenge: webauthnChallenges.challenge });
  if (!challenge) return errorResponse("Biometric registration expired. Try again.", 400);
  let verification;
  try {
    verification = await verifyRegistrationResponse({ response: body.response, expectedChallenge: challenge.challenge, expectedOrigin: webAuthnConfig(request).origin, expectedRPID: webAuthnConfig(request).rpID, requireUserVerification: true });
  } catch {
    return errorResponse("Biometric registration could not be verified", 400);
  }
  if (!verification.verified) return errorResponse("Biometric registration could not be verified", 400);
  const credential = verification.registrationInfo.credential;
  try {
    await db.batch([
      db.insert(webauthnCredentials).values({ id: randomUUID(), userId, credentialId: credential.id, publicKey: bytesToBase64Url(credential.publicKey), signCount: credential.counter, deviceLabel: body.deviceLabel?.slice(0, 100) ?? "This device", lastUsedAt: now, createdAt: now }),
      db.update(users).set({ biometricLockEnabled: true, updatedAt: now }).where(eq(users.id, userId)),
    ]);
  } catch {
    return errorResponse("Biometric registration could not be saved", 409);
  }
  return NextResponse.json({ enabled: true });
}
