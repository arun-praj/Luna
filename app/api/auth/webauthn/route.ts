import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { users, webauthnChallenges, webauthnCredentials, webauthnUnlockGrants } from "@/backend/db/schema";
import { errorResponse, requireFreshReauthentication } from "@/backend/auth/http";

export const runtime = "nodejs";
export async function DELETE(request: Request) {
  const userId = await requireFreshReauthentication(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const now = new Date().toISOString();
  await db.batch([
    db.update(users).set({ biometricLockEnabled: false, updatedAt: now }).where(eq(users.id, userId)),
    db.delete(webauthnCredentials).where(eq(webauthnCredentials.userId, userId)),
    db.delete(webauthnChallenges).where(eq(webauthnChallenges.userId, userId)),
    db.update(webauthnUnlockGrants).set({ revokedAt: now }).where(and(eq(webauthnUnlockGrants.userId, userId), isNull(webauthnUnlockGrants.revokedAt))),
  ]);
  return NextResponse.json({ enabled: false });
}
