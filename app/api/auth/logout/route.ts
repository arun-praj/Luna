import { NextResponse } from "next/server";
import { clearRefreshTokenCookie, getRefreshTokenCookie } from "@/backend/auth/http";
import { revokeRefreshToken } from "@/backend/auth/tokens";

export const runtime = "nodejs";

export async function POST() {
  const rawToken = await getRefreshTokenCookie();
  if (rawToken) await revokeRefreshToken(rawToken);
  const response = NextResponse.json({ success: true });
  clearRefreshTokenCookie(response);
  return response;
}
