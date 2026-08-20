import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { db } from "@/backend/db/client";
import { webauthnChallenges, webauthnCredentials } from "@/backend/db/schema";
import { errorResponse, requireBaseAccessToken } from "@/backend/auth/http";
import { webAuthnConfig } from "@/backend/auth/webauthn";

export async function POST(request: Request) {
  const userId = await requireBaseAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const credentials = await db.select({ credentialId: webauthnCredentials.credentialId }).from(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));
  if (!credentials.length) return errorResponse("No biometric credential is registered on this device", 403);
  const options = await generateAuthenticationOptions({ rpID: webAuthnConfig(request).rpID, allowCredentials: credentials.map((credential) => ({ id: credential.credentialId })), userVerification: "required", timeout: 60_000 });
  const now = new Date();
  await db.delete(webauthnChallenges).where(and(eq(webauthnChallenges.userId, userId), eq(webauthnChallenges.purpose, "authentication"), isNull(webauthnChallenges.consumedAt)));
  await db.insert(webauthnChallenges).values({ id: randomUUID(), userId, challenge: options.challenge, purpose: "authentication", expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(), consumedAt: null, createdAt: now.toISOString() });
  return NextResponse.json(options);
}
