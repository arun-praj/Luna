import { createHash, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/backend/db/client";
import { passwordResetTokens, refreshTokens, users, webauthnUnlockGrants } from "@/backend/db/schema";
import { errorResponse } from "@/backend/auth/http";
import { hashPassword } from "@/backend/auth/password";

export const runtime = "nodejs";
const input = z.object({ token: z.string().min(20).max(200), password: z.string().min(8).max(128) });

function addResetCommitGuard(statements: Array<Parameters<typeof db.batch>[0][number]>, tokenId: string) {
  statements.push(db.insert(passwordResetTokens).select(db.select({
    id: passwordResetTokens.id,
    userId: passwordResetTokens.userId,
    tokenHash: passwordResetTokens.tokenHash,
    expiresAt: passwordResetTokens.expiresAt,
    usedAt: passwordResetTokens.usedAt,
    claimId: passwordResetTokens.claimId,
    claimedAt: passwordResetTokens.claimedAt,
    finalizedAt: passwordResetTokens.finalizedAt,
    createdAt: passwordResetTokens.createdAt,
  }).from(passwordResetTokens).where(and(
    eq(passwordResetTokens.id, tokenId),
    sql`changes() <> 1`,
  ))));
}

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Choose a password with at least 8 characters", 400);
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const lookupAt = new Date().toISOString();
  const [candidate] = await db.select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId }).from(passwordResetTokens).where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt), isNull(passwordResetTokens.claimId), gt(passwordResetTokens.expiresAt, lookupAt))).limit(1);
  if (!candidate) return errorResponse("This password reset link is invalid or has expired", 400);

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(parsed.data.password);
  } catch {
    return errorResponse("Unable to update password", 500);
  }

  const commitAt = new Date().toISOString();
  const claimId = randomUUID();
  // The conditional user update and token finalization, including the claim,
  // run in one D1 transaction. A concurrent request that loses the token
  // condition rolls the whole batch back.
  const statements: Array<Parameters<typeof db.batch>[0][number]> = [
    db.update(users).set({ passwordHash, updatedAt: commitAt }).where(and(
      eq(users.id, candidate.userId),
      sql`EXISTS (SELECT 1 FROM password_reset_tokens WHERE id = ${candidate.id} AND token_hash = ${tokenHash} AND used_at IS NULL AND claim_id IS NULL AND expires_at > ${commitAt})`,
    )),
  ];
  addResetCommitGuard(statements, candidate.id);
  statements.push(
    db.update(passwordResetTokens).set({ claimId, claimedAt: commitAt, usedAt: commitAt, finalizedAt: commitAt }).where(and(eq(passwordResetTokens.id, candidate.id), eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt), isNull(passwordResetTokens.claimId), gt(passwordResetTokens.expiresAt, commitAt))),
  );
  addResetCommitGuard(statements, candidate.id);
  statements.push(
    db.update(refreshTokens).set({ revokedAt: commitAt, revokedReason: "admin" }).where(and(eq(refreshTokens.userId, candidate.userId), isNull(refreshTokens.revokedAt))),
    db.update(webauthnUnlockGrants).set({ revokedAt: commitAt }).where(and(eq(webauthnUnlockGrants.userId, candidate.userId), isNull(webauthnUnlockGrants.revokedAt))),
  );
  try {
    await db.batch(statements as [typeof statements[number], ...typeof statements[number][]]);
  } catch {
    const [state] = await db.select({ usedAt: passwordResetTokens.usedAt, claimId: passwordResetTokens.claimId }).from(passwordResetTokens).where(eq(passwordResetTokens.id, candidate.id)).limit(1).catch(() => []);
    if (state?.usedAt || state?.claimId) return errorResponse("This password reset link is invalid or has expired", 400);
    return errorResponse("Unable to finish password reset. Please retry.", 500);
  }
  return NextResponse.json({ message: "Password updated. You can now log in." });
}
