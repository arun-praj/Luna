import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { accounts, categories, goals, notificationSettings, otpCodes, passwordResetTokens, recurringTemplates, refreshTokens, savingsInstrumentTypes, savingsInstruments, spendingBudgets, transactionHistory, transactions, userTags, users, webauthnCredentials } from "@/backend/db/schema";

type DatabaseLike = Pick<typeof db, "delete">;

/** Deletes user-owned application data in dependency order. Audit rows are intentionally preserved. */
export async function deleteUserData(executor: DatabaseLike, userId: string) {
  await executor.delete(transactionHistory).where(eq(transactionHistory.changedBy, userId));
  await executor.delete(transactions).where(eq(transactions.userId, userId));
  await executor.delete(recurringTemplates).where(eq(recurringTemplates.userId, userId));
  await executor.delete(savingsInstruments).where(eq(savingsInstruments.userId, userId));
  await executor.delete(savingsInstrumentTypes).where(eq(savingsInstrumentTypes.userId, userId));
  await executor.delete(spendingBudgets).where(eq(spendingBudgets.userId, userId));
  await executor.delete(goals).where(eq(goals.userId, userId));
  await executor.delete(userTags).where(eq(userTags.userId, userId));
  await executor.delete(notificationSettings).where(eq(notificationSettings.userId, userId));
  await executor.delete(otpCodes).where(eq(otpCodes.userId, userId));
  await executor.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  await executor.delete(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));
  await executor.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  await executor.delete(accounts).where(eq(accounts.userId, userId));
  await executor.delete(categories).where(eq(categories.userId, userId));
  await executor.delete(users).where(eq(users.id, userId));
}
