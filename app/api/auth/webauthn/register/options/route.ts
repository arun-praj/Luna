import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { db } from "@/backend/db/client";
import { users, webauthnChallenges, webauthnCredentials } from "@/backend/db/schema";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { webAuthnConfig } from "@/backend/auth/webauthn";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const [user] = await db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return errorResponse("Authentication required", 401);
  const existing = await db.select({ credentialId: webauthnCredentials.credentialId }).from(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));
  const options = await generateRegistrationOptions({ rpName: "Luna", rpID: webAuthnConfig(request).rpID, userName: user.email, userID: new TextEncoder().encode(user.id), userDisplayName: user.name || user.email, timeout: 60_000, attestationType: "none", authenticatorSelection: { residentKey: "preferred", userVerification: "required" }, excludeCredentials: existing.map((credential) => ({ id: credential.credentialId })) });
  const now = new Date();
  await db.delete(webauthnChallenges).where(and(eq(webauthnChallenges.userId, userId), eq(webauthnChallenges.purpose, "registration"), isNull(webauthnChallenges.consumedAt)));
  await db.insert(webauthnChallenges).values({ id: randomUUID(), userId, challenge: options.challenge, purpose: "registration", expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(), consumedAt: null, createdAt: now.toISOString() });
  return NextResponse.json(options);
}
