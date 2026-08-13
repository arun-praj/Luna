import { createHash, randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/backend/db/client";
import { passwordResetTokens, users } from "@/backend/db/schema";
import { errorResponse } from "@/backend/auth/http";
import { hashPassword } from "@/backend/auth/password";
import { revokeAllSessions } from "@/backend/auth/tokens";

export const runtime = "nodejs";
const input = z.object({ token: z.string().min(20).max(200), password: z.string().min(8).max(128) });

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Choose a password with at least 8 characters", 400);
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const now = new Date().toISOString();
  const claimId = randomUUID();
  // Claim is the single-winner boundary. A replay or concurrent request gets
  // no user update permission because it cannot obtain this conditional row.
  const [claim] = await db.update(passwordResetTokens).set({ claimId, claimedAt: now }).where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt), isNull(passwordResetTokens.claimId), gt(passwordResetTokens.expiresAt, now))).returning({ id: passwordResetTokens.id, userId: passwordResetTokens.userId });
  if (!claim) return errorResponse("This password reset link is invalid or has expired", 400);

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(parsed.data.password);
  } catch {
    await db.update(passwordResetTokens).set({ claimId: null, claimedAt: null }).where(and(eq(passwordResetTokens.id, claim.id), eq(passwordResetTokens.claimId, claimId), isNull(passwordResetTokens.usedAt)));
    return errorResponse("Unable to update password", 500);
  }

  const updated = await db.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, claim.userId)).returning({ id: users.id });
  if (!updated.length) {
    await db.update(passwordResetTokens).set({ claimId: null, claimedAt: null }).where(and(eq(passwordResetTokens.id, claim.id), eq(passwordResetTokens.claimId, claimId), isNull(passwordResetTokens.usedAt)));
    return errorResponse("This password reset link is invalid or has expired", 400);
  }
  // Finalization is also conditional. If a Worker fails after the password
  // write, the claimed token remains unusable and cannot replay the change;
  // scheduled cleanup removes it later.
  const [finalized] = await db.update(passwordResetTokens).set({ usedAt: now, finalizedAt: now }).where(and(eq(passwordResetTokens.id, claim.id), eq(passwordResetTokens.claimId, claimId), isNull(passwordResetTokens.usedAt))).returning({ id: passwordResetTokens.id });
  if (!finalized) return errorResponse("Unable to finish password reset. Request a new link.", 500);
  await revokeAllSessions(claim.userId);
  return NextResponse.json({ message: "Password updated. You can now log in." });
}
