import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { db } from "../db/client";
import { refreshTokens, users } from "../db/schema";
import { decryptSecret, encryptSecret } from "./crypto";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_ROTATION_GRACE_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  getJwtSecret,
} from "./config";

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
  const sessionFamilyId = randomUUID();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  await db.insert(refreshTokens).values({
    id: randomUUID(), userId, tokenHash: hashToken(refreshToken), deviceLabel, sessionFamilyId,
    issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString(),
  });

  return { userId, accessToken: await createAccessToken(userId), refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export async function rotateRefreshToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const [current] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);
  if (!current || new Date(current.expiresAt).getTime() <= Date.now()) return null;

  if (current.revokedAt) {
    const revokedAt = new Date(current.revokedAt).getTime();
    const withinRotationGrace =
      current.revokedReason === "rotated" &&
      Number.isFinite(revokedAt) &&
      Date.now() - revokedAt <= REFRESH_TOKEN_ROTATION_GRACE_SECONDS * 1000;

    if (withinRotationGrace && current.replacementTokenCiphertext) {
      try {
        return {
          userId: current.userId,
          accessToken: await createAccessToken(current.userId),
          refreshToken: decryptSecret(current.replacementTokenCiphertext),
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        };
      } catch {
        // If the replacement cannot be recovered, fall through to the normal
        // replay response and revoke the session family below.
      }
    }

    // Replay invalidates only this device's session family. A stale refresh
    // token on one device must not sign the user out on every other device.
    const familyFilter = current.sessionFamilyId
      ? and(eq(refreshTokens.userId, current.userId), eq(refreshTokens.sessionFamilyId, current.sessionFamilyId))
      : eq(refreshTokens.id, current.id);
    await db.update(refreshTokens).set({ revokedAt: now(), revokedReason: "reuse_detected" }).where(familyFilter);
    throw new RefreshTokenReuseError("Refresh token reuse detected");
  }

  const nextToken = newOpaqueToken();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  const nextId = randomUUID();

  await db.batch([
    db.update(refreshTokens).set({ revokedAt: issuedAt.toISOString(), revokedReason: "rotated", replacementTokenCiphertext: encryptSecret(nextToken) }).where(and(eq(refreshTokens.id, current.id), isNull(refreshTokens.revokedAt))),
    db.insert(refreshTokens).values({ id: nextId, userId: current.userId, tokenHash: hashToken(nextToken), sessionFamilyId: current.sessionFamilyId ?? current.id, parentTokenId: current.id, deviceLabel: current.deviceLabel, issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString() }),
  ]);

  // If two refresh requests raced, both batches may insert a child, but only
  // the request that won the conditional update owns the replacement stored on
  // the parent. Returning that authoritative replacement keeps both clients
  // on the same session instead of revoking the user on the next refresh.
  const [rotated] = await db
    .select({ replacementTokenCiphertext: refreshTokens.replacementTokenCiphertext })
    .from(refreshTokens)
    .where(eq(refreshTokens.id, current.id))
    .limit(1);

  let refreshToken = nextToken;
  if (rotated?.replacementTokenCiphertext) {
    try {
      refreshToken = decryptSecret(rotated.replacementTokenCiphertext);
    } catch {
      // Keep the token generated by this request as a safe fallback. The
      // encrypted replacement is only a concurrency aid, not token storage.
    }
  }

  return { userId: current.userId, accessToken: await createAccessToken(current.userId), refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
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
