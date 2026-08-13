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

export async function requireAccessToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const details = await verifyAccessTokenDetails(header.slice(7));
  if (!details) return null;
  const [user] = await db.select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt, biometricLockEnabled: users.biometricLockEnabled }).from(users).where(eq(users.id, details.userId)).limit(1);
  if (!user?.emailVerifiedAt) return null;
  if (user.biometricLockEnabled && !details.unlockGrantId) {
    const pathname = new URL(request.url).pathname;
    if (!(pathname === "/api/auth/webauthn" || pathname.startsWith("/api/auth/webauthn/")) && pathname !== "/api/auth/me") return null;
  }
  if (user.biometricLockEnabled && details.unlockGrantId) {
    const [grant] = await db.select({ id: webauthnUnlockGrants.id }).from(webauthnUnlockGrants).where(and(eq(webauthnUnlockGrants.id, details.unlockGrantId), eq(webauthnUnlockGrants.userId, user.id), isNull(webauthnUnlockGrants.revokedAt), gt(webauthnUnlockGrants.expiresAt, new Date().toISOString()))).limit(1);
    if (!grant) return null;
  }
  return user.id;
}
