import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/backend/db/client";
import { users } from "@/backend/db/schema";
import { verifyPassword } from "@/backend/auth/password";
import { createSession, createTwoFactorChallengeToken } from "@/backend/auth/tokens";
import { errorResponse, setRefreshTokenCookie } from "@/backend/auth/http";
import { toPublicUserProfile } from "@/backend/auth/profile";
import { loginInput } from "@/backend/auth/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = loginInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid login details", 400);
  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return errorResponse("Invalid email or password", 401);
  if (user.twoFactorEnabled) {
    return NextResponse.json({ twoFactorRequired: true, challengeToken: await createTwoFactorChallengeToken(user.id) });
  }

  const lastLoginAt = new Date().toISOString();
  await db.update(users).set({ lastLoginAt, updatedAt: lastLoginAt }).where(eq(users.id, user.id));
  user.lastLoginAt = lastLoginAt;
  let session;
  try {
    session = await createSession(user.id, parsed.data.deviceLabel);
  } catch {
    return errorResponse("Unable to start a login session", 500);
  }
  const refreshedUser = { ...user, lastLoginAt };
  const response = NextResponse.json({ user: toPublicUserProfile(refreshedUser), accessToken: session.accessToken, expiresIn: session.expiresIn });
  setRefreshTokenCookie(response, session.refreshToken);
  return response;
}
