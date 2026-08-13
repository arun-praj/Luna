import { NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { db } from "@/backend/db/client";
import { webauthnChallenges, webauthnCredentials } from "@/backend/db/schema";
import { createBiometricUnlockGrant } from "@/backend/auth/tokens";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { base64UrlToBytes, webAuthnConfig } from "@/backend/auth/webauthn";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const body = await request.json().catch(() => null) as { response?: AuthenticationResponseJSON } | null;
  if (!body?.response || typeof body.response !== "object") return errorResponse("Invalid biometric assertion", 400);
  const now = new Date().toISOString();
  const [challenge] = await db.update(webauthnChallenges).set({ consumedAt: now }).where(and(eq(webauthnChallenges.userId, userId), eq(webauthnChallenges.purpose, "authentication"), isNull(webauthnChallenges.consumedAt), gt(webauthnChallenges.expiresAt, now))).returning({ challenge: webauthnChallenges.challenge });
  if (!challenge) return errorResponse("Biometric challenge expired. Try again.", 400);
  const [stored] = await db.select().from(webauthnCredentials).where(and(eq(webauthnCredentials.userId, userId), eq(webauthnCredentials.credentialId, body.response.id))).limit(1);
  if (!stored) return errorResponse("This biometric credential is not registered", 403);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({ response: body.response, expectedChallenge: challenge.challenge, expectedOrigin: webAuthnConfig(request).origin, expectedRPID: webAuthnConfig(request).rpID, requireUserVerification: true, credential: { id: stored.credentialId, publicKey: base64UrlToBytes(stored.publicKey), counter: stored.signCount } });
  } catch {
    return errorResponse("Biometric assertion could not be verified", 403);
  }
  if (!verification.verified || !verification.authenticationInfo.userVerified) return errorResponse("Biometric assertion could not be verified", 403);
  const [updated] = await db.update(webauthnCredentials).set({ signCount: verification.authenticationInfo.newCounter, lastUsedAt: now }).where(and(eq(webauthnCredentials.id, stored.id), eq(webauthnCredentials.signCount, stored.signCount))).returning({ id: webauthnCredentials.id });
  if (!updated) return errorResponse("Biometric assertion was already used. Try again.", 409);
  const grant = await createBiometricUnlockGrant(userId);
  return NextResponse.json({ accessToken: grant.accessToken, expiresAt: grant.expiresAt });
}
