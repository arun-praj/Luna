import { createHash } from "node:crypto";
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
  const [resetToken] = await db.select().from(passwordResetTokens).where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date().toISOString()))).limit(1);
  if (!resetToken) return errorResponse("This password reset link is invalid or has expired", 400);

  const now = new Date().toISOString();
  await db.batch([
    db.update(users).set({ passwordHash: await hashPassword(parsed.data.password), updatedAt: now }).where(eq(users.id, resetToken.userId)),
    db.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.id, resetToken.id)),
  ]);
  await revokeAllSessions(resetToken.userId);
  return NextResponse.json({ message: "Password updated. You can now log in." });
}
