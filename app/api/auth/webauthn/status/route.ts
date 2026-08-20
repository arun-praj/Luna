import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { users, webauthnCredentials } from "@/backend/db/schema";
import { errorResponse, requireBaseAccessToken } from "@/backend/auth/http";

export async function GET(request: Request) {
  const userId = await requireBaseAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const [user] = await db.select({ enabled: users.biometricLockEnabled }).from(users).where(eq(users.id, userId)).limit(1);
  const [credential] = await db.select({ id: webauthnCredentials.id }).from(webauthnCredentials).where(eq(webauthnCredentials.userId, userId)).limit(1);
  return NextResponse.json({ enabled: Boolean(user?.enabled && credential) });
}
