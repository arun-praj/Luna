import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/backend/db/client";
import { users } from "@/backend/db/schema";
import { errorResponse, setRefreshTokenCookie } from "@/backend/auth/http";
import { decryptSecret } from "@/backend/auth/crypto";
import { verifyTotp } from "@/backend/auth/totp";
import { consumeBackupCode, parseBackupCodeHashes } from "@/backend/auth/two-factor";
import { checkRateLimit, rateLimitHeaders } from "@/backend/auth/rate-limit";
import { consumeTwoFactorChallenge, createSession, recordTwoFactorChallengeAttempt, verifyTwoFactorChallengeToken } from "@/backend/auth/tokens";
import { toPublicUserProfile } from "@/backend/auth/profile";


const input = z.object({ challengeToken: z.string().min(20), code: z.string().trim().min(6).max(20), deviceLabel: z.string().trim().max(100).optional() });

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Enter your authenticator or backup code", 400);
  const ipLimit = await checkRateLimit(request, "login-2fa-ip", { limit: 50, windowMs: 15 * 60 * 1000, keyBy: "ip" });
  if (!ipLimit.allowed) return NextResponse.json({ error: "Too many verification attempts. Try again later." }, { status: 429, headers: rateLimitHeaders(ipLimit.retryAfterSeconds) });
  const challenge = await verifyTwoFactorChallengeToken(parsed.data.challengeToken);
  if (!challenge || !(await recordTwoFactorChallengeAttempt(challenge.challengeId))) return errorResponse("Your verification session expired or has too many attempts. Log in again", 401);
  const userId = challenge.userId;
  const userLimit = await checkRateLimit(request, "login-2fa-user", { limit: 15, windowMs: 15 * 60 * 1000, keyBy: "identifier" }, userId);
  if (!userLimit.allowed) return NextResponse.json({ error: "Too many verification attempts. Try again later." }, { status: 429, headers: rateLimitHeaders(userLimit.retryAfterSeconds) });
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.emailVerifiedAt) return errorResponse("Please verify your email before signing in", 403);
  if (!user.twoFactorEnabled || !user.twoFactorSecretEncrypted) return errorResponse("Authenticator protection is not enabled", 401);
  let secret: string;
  try {
    secret = decryptSecret(user.twoFactorSecretEncrypted);
  } catch {
    return errorResponse("Authenticator configuration is unavailable", 500);
  }
  const validTotp = verifyTotp(secret, user.email, parsed.data.code);
  const hashes = parseBackupCodeHashes(user.twoFactorBackupCodes);
  const backup = validTotp ? { matched: true, remaining: hashes } : await consumeBackupCode(parsed.data.code, hashes);
  if (!backup.matched) return errorResponse("That code is not valid", 401);
  if (!(await consumeTwoFactorChallenge(challenge.challengeId))) return errorResponse("Your verification session has already been used. Log in again", 401);
  const lastLoginAt = new Date().toISOString();
  await db.update(users).set({ lastLoginAt, twoFactorBackupCodes: JSON.stringify(backup.remaining), updatedAt: lastLoginAt }).where(eq(users.id, user.id));
  const session = await createSession(user.id, parsed.data.deviceLabel);
  const response = NextResponse.json({ user: toPublicUserProfile({ ...user, lastLoginAt }), accessToken: session.accessToken, expiresIn: session.expiresIn });
  setRefreshTokenCookie(response, session.refreshToken);
  return response;
}
