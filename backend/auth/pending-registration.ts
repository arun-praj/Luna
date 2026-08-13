import "server-only";

import { createHash, randomInt, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { pendingRegistrations } from "@/backend/db/schema";

export const PENDING_REGISTRATION_MINUTES = 10;
export const PENDING_REGISTRATION_MAX_ATTEMPTS = 5;

export function pendingRegistrationCodeHash(id: string, code: string) {
  return createHash("sha256").update(`${id}:pending-signup:${code}`).digest("hex");
}

export function newVerificationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function pendingRegistrationExpiry(now = new Date()) {
  return new Date(now.getTime() + PENDING_REGISTRATION_MINUTES * 60_000).toISOString();
}

export async function removeExpiredPendingRegistrations(now = new Date()) {
  const result = await db.delete(pendingRegistrations).where(lt(pendingRegistrations.verificationExpiresAt, now.toISOString()));
  return result;
}

export async function recordPendingVerificationFailure(id: string, now = new Date()) {
  const [updated] = await db.update(pendingRegistrations).set({ verificationAttemptCount: sql`${pendingRegistrations.verificationAttemptCount} + 1`, updatedAt: now.toISOString() }).where(and(eq(pendingRegistrations.id, id), gt(pendingRegistrations.verificationExpiresAt, now.toISOString()), lt(pendingRegistrations.verificationAttemptCount, PENDING_REGISTRATION_MAX_ATTEMPTS))).returning({ attempts: pendingRegistrations.verificationAttemptCount });
  return Boolean(updated);
}

export async function claimPendingRegistration(id: string, code: string, now = new Date()) {
  const claimId = randomUUID();
  const [claim] = await db.update(pendingRegistrations).set({ verificationClaimId: claimId, verificationClaimedAt: now.toISOString(), updatedAt: now.toISOString() }).where(and(eq(pendingRegistrations.id, id), eq(pendingRegistrations.verificationCodeHash, pendingRegistrationCodeHash(id, code)), isNull(pendingRegistrations.verificationClaimId), lt(pendingRegistrations.verificationAttemptCount, PENDING_REGISTRATION_MAX_ATTEMPTS), gt(pendingRegistrations.verificationExpiresAt, now.toISOString()))).returning();
  return claim ? { ...claim, claimId } : null;
}
