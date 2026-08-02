import "server-only";

import { createHash, randomInt, randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { otpCodes } from "@/backend/db/schema";

export const EMAIL_VERIFICATION_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function hashCode(userId: string, code: string) {
  return createHash("sha256").update(`${userId}:signup_verify:${code}`).digest("hex");
}

export async function createEmailVerificationCode(userId: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_MINUTES * 60 * 1000);
  const code = randomInt(100000, 1000000).toString();
  await db.delete(otpCodes).where(and(eq(otpCodes.userId, userId), eq(otpCodes.purpose, "signup_verify"), isNull(otpCodes.consumedAt)));
  const id = randomUUID();
  await db.insert(otpCodes).values({
    id,
    userId,
    codeHash: hashCode(userId, code),
    channel: "email",
    purpose: "signup_verify",
    expiresAt: expiresAt.toISOString(),
    consumedAt: null,
    attemptCount: 0,
    createdAt: now.toISOString(),
  });
  return { id, code, expiresAt };
}

export async function verifyEmailVerificationCode(userId: string, code: string) {
  const [otp] = await db.select().from(otpCodes).where(and(eq(otpCodes.userId, userId), eq(otpCodes.purpose, "signup_verify"), eq(otpCodes.channel, "email"), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date().toISOString()))).orderBy(desc(otpCodes.createdAt)).limit(1);
  if (!otp || otp.attemptCount >= MAX_ATTEMPTS) return { valid: false, exhausted: Boolean(otp && otp.attemptCount >= MAX_ATTEMPTS) };
  if (otp.codeHash !== hashCode(userId, code)) {
    const nextAttempts = otp.attemptCount + 1;
    await db.update(otpCodes).set({ attemptCount: nextAttempts, consumedAt: nextAttempts >= MAX_ATTEMPTS ? new Date().toISOString() : null }).where(eq(otpCodes.id, otp.id));
    return { valid: false, exhausted: nextAttempts >= MAX_ATTEMPTS };
  }
  const now = new Date().toISOString();
  await db.update(otpCodes).set({ consumedAt: now }).where(eq(otpCodes.id, otp.id));
  return { valid: true, exhausted: false };
}
