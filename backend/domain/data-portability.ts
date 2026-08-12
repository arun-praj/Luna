import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/backend/db/client";
import {
  accounts,
  budgetAllocations,
  budgetCategoryBuckets,
  budgetMoves,
  budgetPeriods,
  budgetTemplates,
  categories,
  dataExports,
  dataImports,
  goals,
  loanInstallments,
  loanPaymentEvents,
  loanRatePeriods,
  loans,
  recurringOccurrences,
  recurringTemplates,
  savingsInstruments,
  savingsInstrumentTypes,
  spendingBudgets,
  transactionHistory,
  transactions,
  userTags,
} from "@/backend/db/schema";

export const PORTABILITY_FORMAT = "luna-financial-data";
export const PORTABILITY_VERSION = 1;
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

type BatchStatement = Parameters<typeof db.batch>[0][number];
type Row = Record<string, unknown>;

function rows(value: unknown, key: string): Row[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${key} data`);
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Invalid ${key} item`);
    return item as Row;
  });
}

function sourceId(row: Row, key: string) {
  if (typeof row.id !== "string" || !row.id) throw new Error(`Invalid ${key} identifier`);
  return row.id;
}

function mapIds(items: Row[], key: string) {
  return new Map(items.map((row) => [sourceId(row, key), randomUUID()]));
}

function mapped(value: unknown, ids: Map<string, string>, fallback = false) {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("Invalid relationship identifier");
  const result = ids.get(value);
  if (result) return result;
  if (fallback) return value;
  throw new Error("The backup contains an incomplete relationship");
}

function mappedShared(value: unknown, ids: Map<string, string>, sharedIds: Set<string>) {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("Invalid relationship identifier");
  const result = ids.get(value);
  if (result) return result;
  if (sharedIds.has(value)) return value;
  throw new Error("The backup contains an incomplete private relationship");
}

function copy(row: Row, fields: string[]) {
  return Object.fromEntries(fields.filter((field) => row[field] !== undefined).map((field) => [field, row[field]]));
}

function remapSplits(value: unknown, categoryIds: Map<string, string>, sharedCategoryIds: Set<string>) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) return "[]";
  return JSON.stringify(parsed.map((split) => {
    if (!split || typeof split !== "object") throw new Error("Invalid transaction split");
    const item = split as Row;
    return { ...item, categoryId: mappedShared(item.categoryId, categoryIds, sharedCategoryIds) };
  }));
}

export async function createPortableExport(userId: string, exportedAt: string) {
  const [userAccounts, userCategories, tags, types, instruments, userGoals, userLoans, budgets, userBudgetTemplates, userBudgetPeriods, userBudgetAllocations, userBudgetBuckets, userBudgetMoves, templates, userTransactions] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(userTags).where(eq(userTags.userId, userId)),
    db.select().from(savingsInstrumentTypes).where(eq(savingsInstrumentTypes.userId, userId)),
    db.select().from(savingsInstruments).where(eq(savingsInstruments.userId, userId)),
    db.select().from(goals).where(eq(goals.userId, userId)),
    db.select().from(loans).where(eq(loans.userId, userId)),
    db.select().from(spendingBudgets).where(eq(spendingBudgets.userId, userId)),
    db.select().from(budgetTemplates).where(eq(budgetTemplates.userId, userId)),
    db.select().from(budgetPeriods).where(eq(budgetPeriods.userId, userId)),
    db.select({ allocation: budgetAllocations }).from(budgetAllocations).innerJoin(budgetPeriods, eq(budgetAllocations.periodId, budgetPeriods.id)).where(eq(budgetPeriods.userId, userId)).then((rows) => rows.map(({ allocation }) => allocation)),
    db.select().from(budgetCategoryBuckets).where(eq(budgetCategoryBuckets.userId, userId)),
    db.select().from(budgetMoves).where(eq(budgetMoves.userId, userId)),
    db.select().from(recurringTemplates).where(eq(recurringTemplates.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
  ]);
  const loanIds = userLoans.map((loan) => loan.id);
  const templateIds = templates.map((template) => template.id);
  const transactionIds = userTransactions.map((transaction) => transaction.id);
  const [rates, installments, payments, occurrences, history] = await Promise.all([
    loanIds.length ? db.select().from(loanRatePeriods).where(inArray(loanRatePeriods.loanId, loanIds)) : [],
    loanIds.length ? db.select().from(loanInstallments).where(inArray(loanInstallments.loanId, loanIds)) : [],
    loanIds.length ? db.select().from(loanPaymentEvents).where(and(eq(loanPaymentEvents.userId, userId), inArray(loanPaymentEvents.loanId, loanIds))) : [],
    templateIds.length ? db.select().from(recurringOccurrences).where(and(eq(recurringOccurrences.userId, userId), inArray(recurringOccurrences.recurringTemplateId, templateIds))) : [],
    transactionIds.length ? db.select().from(transactionHistory).where(inArray(transactionHistory.transactionId, transactionIds)) : [],
  ]);
  return {
    format: PORTABILITY_FORMAT,
    version: PORTABILITY_VERSION,
    exportedAt,
    data: {
      accounts: userAccounts,
      categories: userCategories,
      tags,
      savingsInstrumentTypes: types,
      savingsInstruments: instruments,
      goals: userGoals,
      loans: userLoans,
      loanRatePeriods: rates,
      loanInstallments: installments,
      loanPaymentEvents: payments,
      budgets,
      budgetTemplates: userBudgetTemplates,
      budgetPeriods: userBudgetPeriods,
      budgetAllocations: userBudgetAllocations,
      budgetCategoryBuckets: userBudgetBuckets,
      budgetMoves: userBudgetMoves,
      recurringTemplates: templates,
      transactions: userTransactions,
      recurringOccurrences: occurrences,
      transactionHistory: history,
    },
  };
}

export async function importPortableData(userId: string, payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Choose a valid Luna JSON backup");
  const bundle = payload as Row;
  if (bundle.format !== PORTABILITY_FORMAT || bundle.version !== PORTABILITY_VERSION || !bundle.data || typeof bundle.data !== "object") throw new Error("This file is not a supported Luna backup");
  const data = bundle.data as Row;
  const accountRows = rows(data.accounts, "accounts");
  const categoryRows = rows(data.categories, "categories");
  const tagRows = rows(data.tags, "tags");
  const typeRows = rows(data.savingsInstrumentTypes, "saving instrument types");
  const instrumentRows = rows(data.savingsInstruments, "saving instruments");
  const goalRows = rows(data.goals, "goals");
  const loanRows = rows(data.loans, "loans");
  const rateRows = rows(data.loanRatePeriods, "loan rates");
  const installmentRows = rows(data.loanInstallments, "loan installments");
  const paymentRows = rows(data.loanPaymentEvents, "loan payments");
  const budgetRows = rows(data.budgets ?? [], "budgets");
  const budgetTemplateRows = rows(data.budgetTemplates ?? [], "budget templates");
  const budgetPeriodRows = rows(data.budgetPeriods ?? [], "budget periods");
  const budgetAllocationRows = rows(data.budgetAllocations ?? [], "budget allocations");
  const budgetBucketRows = rows(data.budgetCategoryBuckets ?? [], "budget category buckets");
  const budgetMoveRows = rows(data.budgetMoves ?? [], "budget moves");
  const templateRows = rows(data.recurringTemplates, "recurring templates");
  const transactionRows = rows(data.transactions, "transactions");
  const occurrenceRows = rows(data.recurringOccurrences, "recurring occurrences");
  const historyRows = rows(data.transactionHistory, "transaction history");
  const allRows = [accountRows, categoryRows, tagRows, typeRows, instrumentRows, goalRows, loanRows, rateRows, installmentRows, paymentRows, budgetRows, budgetTemplateRows, budgetPeriodRows, budgetAllocationRows, budgetBucketRows, budgetMoveRows, templateRows, transactionRows, occurrenceRows, historyRows];
  const itemCount = allRows.reduce((total, list) => total + list.length, 0);
  if (itemCount > 250_000) throw new Error("This backup contains too many records");

  const accountIds = mapIds(accountRows, "account");
  const categoryIds = mapIds(categoryRows, "category");
  const typeIds = mapIds(typeRows, "saving instrument type");
  const instrumentIds = mapIds(instrumentRows, "saving instrument");
  const goalIds = mapIds(goalRows, "goal");
  const loanIds = mapIds(loanRows, "loan");
  const installmentIds = mapIds(installmentRows, "loan installment");
  const paymentIds = mapIds(paymentRows, "loan payment");
  const budgetTemplateIds = mapIds(budgetTemplateRows, "budget template");
  const budgetPeriodIds = mapIds(budgetPeriodRows, "budget period");
  const budgetAllocationIds = mapIds(budgetAllocationRows, "budget allocation");
  const budgetMoveIds = mapIds(budgetMoveRows, "budget move");
  const skippedBudgetTemplateIds = new Set<string>();
  const templateIds = mapIds(templateRows, "recurring template");
  const transactionIds = mapIds(transactionRows, "transaction");
  const statements: BatchStatement[] = [];
  const [existingTagRows, sharedCategoryRows, sharedTypeRows, existingBudgetRows, existingBudgetTemplateRows] = await Promise.all([
    db.select({ name: userTags.name }).from(userTags).where(eq(userTags.userId, userId)),
    db.select({ id: categories.id }).from(categories).where(isNull(categories.userId)),
    db.select({ id: savingsInstrumentTypes.id }).from(savingsInstrumentTypes).where(isNull(savingsInstrumentTypes.userId)),
    db.select({ categoryId: spendingBudgets.categoryId, period: spendingBudgets.period }).from(spendingBudgets).where(eq(spendingBudgets.userId, userId)),
    db.select({ categoryId: budgetTemplates.categoryId, period: budgetTemplates.recurrence, kind: budgetTemplates.kind }).from(budgetTemplates).where(eq(budgetTemplates.userId, userId)),
  ]);
  const existingTags = new Set(existingTagRows.map((tag) => tag.name.toLocaleLowerCase()));
  const sharedCategoryIds = new Set(sharedCategoryRows.map((category) => category.id));
  const sharedTypeIds = new Set(sharedTypeRows.map((type) => type.id));
  const existingBudgetScopes = new Set(existingBudgetRows.map((budget) => `${budget.period}:${budget.categoryId ?? "overall"}`));
  for (const budget of existingBudgetTemplateRows) existingBudgetScopes.add(`${budget.period}:${budget.kind}:${budget.categoryId ?? "overall"}`);

  for (const row of accountRows) statements.push(db.insert(accounts).values({ ...copy(row, ["name", "type", "currency", "openingBalance", "currentBalance", "displayOrder", "backgroundColor", "icon", "includeInTotalBalance", "allowNegativeBalance"]), id: mapped(row.id, accountIds), userId, isDefault: false } as typeof accounts.$inferInsert));
  for (const row of categoryRows) statements.push(db.insert(categories).values({ ...copy(row, ["name", "type", "icon", "color"]), id: mapped(row.id, categoryIds), userId } as typeof categories.$inferInsert));
  for (const row of tagRows) { const name = typeof row.name === "string" ? row.name.trim() : ""; if (name && !existingTags.has(name.toLocaleLowerCase())) { existingTags.add(name.toLocaleLowerCase()); statements.push(db.insert(userTags).values({ id: randomUUID(), userId, name, createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString() })); } }
  for (const row of typeRows) statements.push(db.insert(savingsInstrumentTypes).values({ ...copy(row, ["name", "isDefault"]), id: mapped(row.id, typeIds), userId } as typeof savingsInstrumentTypes.$inferInsert));
  for (const row of instrumentRows) statements.push(db.insert(savingsInstruments).values({ ...copy(row, ["name", "description", "currentBalance", "interestRate", "icon", "backgroundColor", "maturityDate"]), id: mapped(row.id, instrumentIds), userId, typeId: mappedShared(row.typeId, typeIds, sharedTypeIds) } as typeof savingsInstruments.$inferInsert));
  for (const row of goalRows) statements.push(db.insert(goals).values({ ...copy(row, ["name", "targetAmount", "allocatedAmount", "monthlyContribution", "status", "targetDate"]), id: mapped(row.id, goalIds), userId, accountId: mapped(row.accountId, accountIds) } as typeof goals.$inferInsert));
  for (const row of loanRows) statements.push(db.insert(loans).values({ ...copy(row, ["name", "counterparty", "direction", "currency", "originalPrincipal", "interestMethod", "paymentFrequency", "scheduledPayment", "termCount", "startDate", "firstDueDate", "nextDueDate", "status", "notes", "createdAt", "updatedAt"]), id: mapped(row.id, loanIds), userId, accountId: mapped(row.accountId, accountIds) } as typeof loans.$inferInsert));
  for (const row of rateRows) statements.push(db.insert(loanRatePeriods).values({ ...copy(row, ["annualRate", "effectiveDate", "createdAt"]), id: randomUUID(), loanId: mapped(row.loanId, loanIds) } as typeof loanRatePeriods.$inferInsert));
  for (const row of installmentRows) statements.push(db.insert(loanInstallments).values({ ...copy(row, ["sequence", "dueDate", "expectedPrincipal", "expectedInterest", "expectedFees", "paidPrincipal", "paidInterest", "paidFees", "status"]), id: mapped(row.id, installmentIds), loanId: mapped(row.loanId, loanIds) } as typeof loanInstallments.$inferInsert));
  for (const row of paymentRows) statements.push(db.insert(loanPaymentEvents).values({ ...copy(row, ["kind", "principal", "interest", "fees", "date", "createdAt"]), id: mapped(row.id, paymentIds), userId, loanId: mapped(row.loanId, loanIds), accountId: mapped(row.accountId, accountIds), installmentId: mapped(row.installmentId, installmentIds), clientGeneratedId: null, reversedEventId: mapped(row.reversedEventId, paymentIds) } as typeof loanPaymentEvents.$inferInsert));
  for (const row of budgetTemplateRows) {
    const categoryId = mappedShared(row.categoryId, categoryIds, sharedCategoryIds);
    const period = typeof row.recurrence === "string" ? row.recurrence : "monthly";
    const kind = row.kind === "savings" ? "savings" : "expense";
    const scope = `${period}:${kind}:${categoryId ?? "overall"}`;
    if (existingBudgetScopes.has(scope)) { skippedBudgetTemplateIds.add(row.id as string); continue; }
    existingBudgetScopes.add(scope);
    statements.push(db.insert(budgetTemplates).values({ ...copy(row, ["name", "recurrence", "kind", "defaultAmount", "rolloverRule", "createdAt", "updatedAt"]), id: mapped(row.id, budgetTemplateIds), userId, categoryId: kind === "savings" ? null : categoryId, kind, clientGeneratedId: null } as typeof budgetTemplates.$inferInsert));
  }
  for (const row of budgetPeriodRows) statements.push(db.insert(budgetPeriods).values({ ...copy(row, ["recurrence", "periodStart", "periodEnd", "totalLimit", "status", "createdAt", "updatedAt"]), id: mapped(row.id, budgetPeriodIds), userId } as typeof budgetPeriods.$inferInsert));
  for (const row of budgetAllocationRows) {
    if (typeof row.templateId === "string" && skippedBudgetTemplateIds.has(row.templateId)) continue;
    const kind = row.kind === "savings" ? "savings" : "expense";
    statements.push(db.insert(budgetAllocations).values({ ...copy(row, ["originalAmount", "adjustedAmount", "rolloverAmount", "createdAt", "updatedAt"]), id: mapped(row.id, budgetAllocationIds), periodId: mapped(row.periodId, budgetPeriodIds), templateId: mapped(row.templateId, budgetTemplateIds), categoryId: kind === "savings" ? null : mappedShared(row.categoryId, categoryIds, sharedCategoryIds), kind } as typeof budgetAllocations.$inferInsert));
  }
  for (const row of budgetBucketRows) statements.push(db.insert(budgetCategoryBuckets).values({ ...copy(row, ["bucket", "createdAt", "updatedAt"]), id: randomUUID(), userId, categoryId: mappedShared(row.categoryId, categoryIds, sharedCategoryIds) } as typeof budgetCategoryBuckets.$inferInsert));
  for (const row of budgetMoveRows) statements.push(db.insert(budgetMoves).values({ ...copy(row, ["amount", "reversedAt", "createdAt"]), id: mapped(row.id, budgetMoveIds), userId, periodId: mapped(row.periodId, budgetPeriodIds), fromAllocationId: mapped(row.fromAllocationId, budgetAllocationIds), toAllocationId: mapped(row.toAllocationId, budgetAllocationIds), reversalOfId: mapped(row.reversalOfId, budgetMoveIds) } as typeof budgetMoves.$inferInsert));
  for (const row of budgetRows) { const categoryId = mappedShared(row.categoryId, categoryIds, sharedCategoryIds); const period = typeof row.period === "string" ? row.period : "monthly"; const scope = `${period}:${categoryId ?? "overall"}`; if (existingBudgetScopes.has(scope)) continue; existingBudgetScopes.add(scope); statements.push(db.insert(spendingBudgets).values({ ...copy(row, ["name", "limitAmount", "period", "createdAt", "updatedAt"]), id: randomUUID(), userId, categoryId, clientGeneratedId: null, createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(), updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString() } as typeof spendingBudgets.$inferInsert)); }
  for (const row of templateRows) statements.push(db.insert(recurringTemplates).values({ ...copy(row, ["type", "amount", "title", "notes", "frequency", "nextDueDate", "endDate", "approvalRequired", "isActive"]), id: mapped(row.id, templateIds), userId, accountId: mapped(row.accountId, accountIds), categoryId: mappedShared(row.categoryId, categoryIds, sharedCategoryIds), transferToAccountId: mapped(row.transferToAccountId, accountIds), savingsInstrumentId: mapped(row.savingsInstrumentId, instrumentIds), goalId: mapped(row.goalId, goalIds) } as typeof recurringTemplates.$inferInsert));
  for (const row of transactionRows) statements.push(db.insert(transactions).values({ ...copy(row, ["type", "amount", "title", "merchantName", "notes", "tags", "isRecurring", "receiptImageUrl", "loanComponent", "date", "transactionAt", "createdAt", "updatedAt"]), id: mapped(row.id, transactionIds), userId, accountId: mapped(row.accountId, accountIds), categoryId: mappedShared(row.categoryId, categoryIds, sharedCategoryIds), splits: remapSplits(row.splits, categoryIds, sharedCategoryIds), recurringTemplateId: mapped(row.recurringTemplateId, templateIds), goalId: mapped(row.goalId, goalIds), savingsInstrumentId: mapped(row.savingsInstrumentId, instrumentIds), transferToAccountId: mapped(row.transferToAccountId, accountIds), loanId: mapped(row.loanId, loanIds), loanPaymentEventId: mapped(row.loanPaymentEventId, paymentIds), syncStatus: "synced", clientGeneratedId: null } as typeof transactions.$inferInsert));
  for (const row of occurrenceRows) statements.push(db.insert(recurringOccurrences).values({ ...copy(row, ["scheduledDate", "status", "createdAt", "updatedAt"]), id: randomUUID(), userId, recurringTemplateId: mapped(row.recurringTemplateId, templateIds), transactionId: mapped(row.transactionId, transactionIds) } as typeof recurringOccurrences.$inferInsert));
  for (const row of historyRows) statements.push(db.insert(transactionHistory).values({ ...copy(row, ["changeType", "oldValues", "newValues", "changedAt"]), id: randomUUID(), transactionId: mapped(row.transactionId, transactionIds), changedBy: userId } as typeof transactionHistory.$inferInsert));
  if (statements.length) await db.batch(statements as [BatchStatement, ...BatchStatement[]]);
  return { itemCount, counts: { accounts: accountRows.length, transactions: transactionRows.length, loans: loanRows.length, goals: goalRows.length, recurringTemplates: templateRows.length, savingsInstruments: instrumentRows.length } };
}

export async function portabilityCounts(userId: string) {
  const [{ count: exportsCount }] = await db.select({ count: sql<number>`count(*)` }).from(dataExports).where(and(eq(dataExports.userId, userId), eq(dataExports.status, "completed")));
  const [{ count: importsCount }] = await db.select({ count: sql<number>`count(*)` }).from(dataImports).where(and(eq(dataImports.userId, userId), eq(dataImports.status, "completed")));
  return { exports: Number(exportsCount), imports: Number(importsCount) };
}
