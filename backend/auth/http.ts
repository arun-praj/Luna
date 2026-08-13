import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_TTL_SECONDS } from "./config";
import { verifyAccessTokenDetails } from "./tokens";
import { db } from "../db/client";
import { users, webauthnUnlockGrants } from "../db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";

export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function setRefreshTokenCookie(response: NextResponse, token: string) {
  response.cookies.set(REFRESH_TOKEN_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth", maxAge: REFRESH_TOKEN_TTL_SECONDS });
}

export function clearRefreshTokenCookie(response: NextResponse) {
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth", maxAge: 0 });
}

export async function getRefreshTokenCookie() {
  return (await cookies()).get(REFRESH_TOKEN_COOKIE)?.value;
}

type AccessContext = {
  userId: string;
  unlockGrantId: string | null;
  issuedAt: number | null;
};

const FRESH_REAUTHENTICATION_SECONDS = 5 * 60;

async function resolveBaseAccess(request: Request): Promise<AccessContext | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const details = await verifyAccessTokenDetails(header.slice(7));
  if (!details) return null;
  const [user] = await db.select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, details.userId)).limit(1);
  if (!user?.emailVerifiedAt) return null;
  return { userId: user.id, unlockGrantId: details.unlockGrantId, issuedAt: details.issuedAt };
}

async function getValidUnlockGrant(context: AccessContext) {
  if (!context.unlockGrantId) return null;
  const [grant] = await db.select({ id: webauthnUnlockGrants.id, createdAt: webauthnUnlockGrants.createdAt }).from(webauthnUnlockGrants).where(and(eq(webauthnUnlockGrants.id, context.unlockGrantId), eq(webauthnUnlockGrants.userId, context.userId), isNull(webauthnUnlockGrants.revokedAt), gt(webauthnUnlockGrants.expiresAt, new Date().toISOString()))).limit(1);
  return grant ?? null;
}

/** Validates identity only. This is the narrow base assurance level. */
export async function requireBaseAccessToken(request: Request) {
  return (await resolveBaseAccess(request))?.userId ?? null;
}

/** Validates identity and the server-side biometric unlock grant when enabled. */
export async function requireUnlockedAccessToken(request: Request) {
  const context = await resolveBaseAccess(request);
  if (!context) return null;
  const [user] = await db.select({ biometricLockEnabled: users.biometricLockEnabled }).from(users).where(eq(users.id, context.userId)).limit(1);
  if (!user?.biometricLockEnabled) return context.userId;
  return (await getValidUnlockGrant(context)) ? context.userId : null;
}

/** Requires a recent server-recognized reauthentication for security changes. */
export async function requireFreshReauthentication(request: Request) {
  const context = await resolveBaseAccess(request);
  if (!context) return null;
  const [user] = await db.select({ biometricLockEnabled: users.biometricLockEnabled }).from(users).where(eq(users.id, context.userId)).limit(1);
  if (!user) return null;
  if (!user.biometricLockEnabled) {
    const issuedAt = context.issuedAt ?? 0;
    return Math.floor(Date.now() / 1000) - issuedAt <= FRESH_REAUTHENTICATION_SECONDS ? context.userId : null;
  }
  const grant = await getValidUnlockGrant(context);
  if (!grant) return null;
  const createdAt = new Date(grant.createdAt).getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt <= FRESH_REAUTHENTICATION_SECONDS * 1000 ? context.userId : null;
}

/** Existing private API name now means the unlocked assurance level. */
export async function requireAccessToken(request: Request) {
  return requireUnlockedAccessToken(request);
}
