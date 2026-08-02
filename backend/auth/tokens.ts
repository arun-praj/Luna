import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { db } from "../db/client";
import { refreshTokens, users } from "../db/schema";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS, getJwtSecret } from "./config";

export class RefreshTokenReuseError extends Error {}

export async function createTwoFactorChallengeToken(userId: string) {
  return new SignJWT({ type: "two_factor_challenge" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("budget-api")
    .setAudience("budget-app")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getJwtSecret());
}

export async function verifyTwoFactorChallengeToken(token: string) {
  try {
    const result = await jwtVerify(token, getJwtSecret(), {
      issuer: "budget-api",
      audience: "budget-app",
    });
    return result.payload.type === "two_factor_challenge" && result.payload.sub ? result.payload.sub : null;
  } catch {
    return null;
  }
}

const now = () => new Date().toISOString();
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newOpaqueToken = () => randomBytes(48).toString("base64url");

export async function createAccessToken(userId: string) {
  return new SignJWT({ type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("budget-api")
    .setAudience("budget-app")
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(token: string) {
  try {
    const result = await jwtVerify(token, getJwtSecret(), {
      issuer: "budget-api",
      audience: "budget-app",
    });
    return result.payload.type === "access" && result.payload.sub ? result.payload.sub : null;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, deviceLabel?: string) {
  const refreshToken = newOpaqueToken();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  await db.insert(refreshTokens).values({
    id: randomUUID(), userId, tokenHash: hashToken(refreshToken), deviceLabel,
    issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  });

  return { userId, accessToken: await createAccessToken(userId), refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export async function rotateRefreshToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const [current] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);
  if (!current || new Date(current.expiresAt).getTime() <= Date.now()) return null;

  if (current.revokedAt) {
    await db.update(refreshTokens).set({ revokedAt: now(), revokedReason: "reuse_detected" }).where(eq(refreshTokens.userId, current.userId));
    throw new RefreshTokenReuseError("Refresh token reuse detected");
  }

  const nextToken = newOpaqueToken();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  const nextId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.update(refreshTokens).set({ revokedAt: issuedAt.toISOString(), revokedReason: "rotated" }).where(and(eq(refreshTokens.id, current.id), isNull(refreshTokens.revokedAt)));
    await tx.insert(refreshTokens).values({ id: nextId, userId: current.userId, tokenHash: hashToken(nextToken), parentTokenId: current.id, deviceLabel: current.deviceLabel, issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString() });
  });

  return { userId: current.userId, accessToken: await createAccessToken(current.userId), refreshToken: nextToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export async function revokeRefreshToken(rawToken: string) {
  await db.update(refreshTokens).set({ revokedAt: now(), revokedReason: "logout" }).where(and(eq(refreshTokens.tokenHash, hashToken(rawToken)), isNull(refreshTokens.revokedAt)));
}

export async function revokeAllSessions(userId: string, reason: "logout" | "admin" = "admin") {
  await db.update(refreshTokens).set({ revokedAt: now(), revokedReason: reason }).where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

export async function getUserById(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user;
}
