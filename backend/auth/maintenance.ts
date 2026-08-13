import "server-only";

import { and, isNull, isNotNull, lt, or } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { otpCodes, passwordResetTokens, pendingRegistrations } from "@/backend/db/schema";

export async function runScheduledAuthMaintenance(now = new Date()) {
  const timestamp = now.toISOString();
  const resetRetention = new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString();
  const abandonedClaimCutoff = new Date(now.getTime() - 10 * 60_000).toISOString();
  await Promise.all([
    db.delete(pendingRegistrations).where(lt(pendingRegistrations.verificationExpiresAt, timestamp)),
    db.update(passwordResetTokens).set({ claimId: null, claimedAt: null }).where(and(isNotNull(passwordResetTokens.claimId), isNotNull(passwordResetTokens.claimedAt), isNull(passwordResetTokens.usedAt), lt(passwordResetTokens.claimedAt, abandonedClaimCutoff))),
    db.delete(passwordResetTokens).where(or(lt(passwordResetTokens.expiresAt, timestamp), lt(passwordResetTokens.finalizedAt, resetRetention))),
    db.delete(otpCodes).where(lt(otpCodes.expiresAt, timestamp)),
  ]);
}
