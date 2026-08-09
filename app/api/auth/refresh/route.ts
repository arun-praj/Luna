import { NextResponse } from "next/server";
import { clearRefreshTokenCookie, errorResponse, getRefreshTokenCookie, setRefreshTokenCookie } from "@/backend/auth/http";
import { RefreshTokenReuseError, getUserById, rotateRefreshToken } from "@/backend/auth/tokens";
import { toPublicUserProfile } from "@/backend/auth/profile";

export const runtime = "nodejs";

export async function POST() {
  const rawToken = await getRefreshTokenCookie();
  if (!rawToken) return errorResponse("Refresh token is required", 401);
  try {
    const session = await rotateRefreshToken(rawToken);
    if (!session) return errorResponse("Session expired", 401);
    const user = await getUserById(session.userId);
    if (!user) return errorResponse("User not found", 401);
    const response = NextResponse.json({ user: toPublicUserProfile(user), accessToken: session.accessToken, expiresIn: session.expiresIn });
    setRefreshTokenCookie(response, session.refreshToken);
    return response;
  } catch (error) {
    const response = error instanceof RefreshTokenReuseError
      ? errorResponse("Session revoked", 401)
      : errorResponse("Unable to refresh session", 500);
    // Preserve the refresh cookie on transient Worker, database, or crypto
    // failures. Only a definitive revoked/replayed session should be cleared.
    if (error instanceof RefreshTokenReuseError) clearRefreshTokenCookie(response);
    return response;
  }
}
