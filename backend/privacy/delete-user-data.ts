import "server-only";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { accountDeletionRequests, accounts, budgetAllocations, budgetCategoryBuckets, budgetIncomeSources, budgetMoves, budgetPeriods, budgetTemplates, categories, goals, homeAlerts, loanInstallments, loanPaymentEvents, loanRatePeriods, loans, notificationDeliveries, notificationSettings, otpCodes, passwordResetTokens, pendingRegistrations, recurringOccurrences, recurringTemplates, refreshTokens, savingsInstrumentTypes, savingsInstruments, spendingBudgets, storageUsage, storedObjects, transactionHistory, transactions, userTags, users, webauthnChallenges, webauthnCredentials, webauthnUnlockGrants } from "@/backend/db/schema";
import { deleteUserUploadObjects, type AccountDeletionStorage } from "@/backend/privacy/delete-user-data-helpers";

type BatchStatement = Parameters<typeof db.batch>[0][number];
type DatabaseLike = Pick<typeof db, "delete" | "select" | "update" | "batch">;

export const accountDeletionTableOrder = [
  "transaction_history",
  "transactions",
  "recurring_occurrences",
  "recurring_templates",
  "loan_payment_events",
  "loan_installments",
  "loan_rate_periods",
  "loans",
  "savings_instruments",
  "savings_instrument_types",
  "budget_templates",
  "budget_moves",
  "budget_allocations",
  "budget_category_buckets",
  "budget_periods",
  "budget_income_sources",
  "spending_budgets",
  "home_alerts",
  "goals",
  "user_tags",
  "notification_deliveries",
  "notification_settings",
  "otp_codes",
  "pending_registrations",
  "password_reset_tokens",
  "webauthn_challenges",
  "webauthn_credentials",
  "webauthn_unlock_grants",
  "stored_objects",
  "storage_usage",
  "refresh_tokens",
  "accounts",
  "categories",
  "users",
] as const;

type DeleteUserDataOptions = {
  storage?: AccountDeletionStorage;
  deletionRequestId?: string;
};

/** Deletes user-owned application data in dependency order. Audit rows are intentionally preserved. */
export async function deleteUserData(executor: DatabaseLike, userId: string, options: DeleteUserDataOptions = {}) {
  // R2 deletes are idempotent. Run them first so a storage failure cannot remove
  // the database user while leaving the deletion request impossible to retry.
  if (options.storage) await deleteUserUploadObjects(options.storage, userId);

  const statements: BatchStatement[] = [
    executor.delete(transactionHistory).where(eq(transactionHistory.changedBy, userId)),
    executor.delete(transactions).where(eq(transactions.userId, userId)),
    executor.delete(recurringOccurrences).where(eq(recurringOccurrences.userId, userId)),
    executor.delete(recurringTemplates).where(eq(recurringTemplates.userId, userId)),
    // Loan payment events and all loan children must be removed before loans;
    // loans must be removed before their restrictive account foreign key.
    executor.delete(loanPaymentEvents).where(eq(loanPaymentEvents.userId, userId)),
    executor.delete(loanInstallments).where(inArray(loanInstallments.loanId, executor.select({ id: loans.id }).from(loans).where(eq(loans.userId, userId)))),
    executor.delete(loanRatePeriods).where(inArray(loanRatePeriods.loanId, executor.select({ id: loans.id }).from(loans).where(eq(loans.userId, userId)))),
    executor.delete(loans).where(eq(loans.userId, userId)),
    executor.delete(savingsInstruments).where(eq(savingsInstruments.userId, userId)),
    executor.delete(savingsInstrumentTypes).where(eq(savingsInstrumentTypes.userId, userId)),
    executor.delete(budgetTemplates).where(eq(budgetTemplates.userId, userId)),
    executor.delete(budgetMoves).where(eq(budgetMoves.userId, userId)),
    executor.delete(budgetAllocations).where(inArray(budgetAllocations.periodId, executor.select({ id: budgetPeriods.id }).from(budgetPeriods).where(eq(budgetPeriods.userId, userId)))),
    executor.delete(budgetCategoryBuckets).where(eq(budgetCategoryBuckets.userId, userId)),
    executor.delete(budgetPeriods).where(eq(budgetPeriods.userId, userId)),
    executor.delete(budgetIncomeSources).where(eq(budgetIncomeSources.userId, userId)),
    executor.delete(spendingBudgets).where(eq(spendingBudgets.userId, userId)),
    executor.delete(homeAlerts).where(eq(homeAlerts.userId, userId)),
    executor.delete(goals).where(eq(goals.userId, userId)),
    executor.delete(userTags).where(eq(userTags.userId, userId)),
    executor.delete(notificationDeliveries).where(eq(notificationDeliveries.userId, userId)),
    executor.delete(notificationSettings).where(eq(notificationSettings.userId, userId)),
    executor.delete(otpCodes).where(eq(otpCodes.userId, userId)),
    executor.delete(pendingRegistrations).where(eq(pendingRegistrations.email, executor.select({ email: users.email }).from(users).where(eq(users.id, userId)))),
    executor.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId)),
    executor.delete(webauthnChallenges).where(eq(webauthnChallenges.userId, userId)),
    executor.delete(webauthnCredentials).where(eq(webauthnCredentials.userId, userId)),
    executor.delete(webauthnUnlockGrants).where(eq(webauthnUnlockGrants.userId, userId)),
    executor.delete(storedObjects).where(eq(storedObjects.userId, userId)),
    executor.delete(storageUsage).where(eq(storageUsage.userId, userId)),
    executor.delete(refreshTokens).where(eq(refreshTokens.userId, userId)),
    executor.delete(accounts).where(eq(accounts.userId, userId)),
    executor.delete(categories).where(eq(categories.userId, userId)),
    executor.delete(users).where(eq(users.id, userId)),
  ];
  if (options.deletionRequestId) {
    statements.push(executor.update(accountDeletionRequests).set({ status: "completed", executedAt: new Date().toISOString(), userId: null }).where(eq(accountDeletionRequests.id, options.deletionRequestId)));
  }
  await executor.batch(statements as [BatchStatement, ...BatchStatement[]]);
}
