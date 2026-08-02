import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_TTL_SECONDS } from "./config";
import { verifyAccessToken } from "./tokens";

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
  return verifyAccessToken(header.slice(7));
}
