import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { db } from "@/backend/db/client";
import { accountInput, budgetInput, categoryInput, goalInput, instrumentTypeInput, loanInput, loanPaymentInput, loanRateInput, positiveMoneyInput, recurringTemplateInput, savingsInstrumentInput, tagInput, transactionInput, transactionSplitInput } from "@/backend/domain/validation";
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
export const MAX_IMPORT_RECORDS = 25_000;
export const IMPORT_BATCH_SIZE = 100;

export class PortabilityLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortabilityLimitError";
  }
}

type BatchStatement = Parameters<typeof db.batch>[0][number];
type Row = Record<string, unknown>;

type ImportTable =
  | "accounts" | "categories" | "userTags" | "savingsInstrumentTypes" | "savingsInstruments"
  | "goals" | "loans" | "loanRatePeriods" | "loanInstallments" | "loanPaymentEvents"
  | "budgetTemplates" | "budgetPeriods" | "budgetAllocations" | "budgetCategoryBuckets"
  | "budgetMoves" | "spendingBudgets" | "recurringTemplates" | "transactions"
  | "recurringOccurrences" | "transactionHistory";

class ImportBatchWriter {
  private pending: BatchStatement[] = [];

  async add(statement: BatchStatement) {
    this.pending.push(statement);
    if (this.pending.length >= IMPORT_BATCH_SIZE) await this.flush();
  }

  async flush() {
    if (!this.pending.length) return;
    const pending = this.pending;
    this.pending = [];
    await db.batch(pending as [BatchStatement, ...BatchStatement[]]);
  }
}

class ImportedIds {
  private readonly values = new Map<ImportTable, Set<string>>();

  add(table: ImportTable, id: string) {
    const ids = this.values.get(table) ?? new Set<string>();
    ids.add(id);
    this.values.set(table, ids);
  }

  get(table: ImportTable) {
    return this.values.get(table) ?? new Set<string>();
  }
}

const importDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const importTimestamp = z.string().datetime({ offset: true });
const nonNegativeFinite = z.number().finite().nonnegative();
const importedLoanInstallment = z.object({
  id: z.string().uuid(), loanId: z.string().uuid(), sequence: z.number().int().positive(), dueDate: importDate,
  expectedPrincipal: nonNegativeFinite, expectedInterest: nonNegativeFinite, expectedFees: nonNegativeFinite,
  paidPrincipal: nonNegativeFinite, paidInterest: nonNegativeFinite, paidFees: nonNegativeFinite,
  status: z.enum(["pending", "partial", "paid", "skipped"]),
});
const importedBudgetTemplate = z.object({ name: z.string().trim().min(1).max(100), recurrence: z.enum(["weekly", "monthly", "yearly"]), kind: z.enum(["expense", "savings"]), defaultAmount: positiveMoneyInput, rolloverRule: z.enum(["none", "cap", "uncapped"]) });
const importedBudgetPeriod = z.object({ recurrence: z.enum(["weekly", "monthly", "yearly"]), periodStart: importDate, periodEnd: importDate, totalLimit: nonNegativeFinite, status: z.enum(["open", "closed", "archived"]) });
const importedBudgetAllocation = z.object({ originalAmount: nonNegativeFinite, adjustedAmount: nonNegativeFinite, rolloverAmount: nonNegativeFinite, kind: z.enum(["expense", "savings"]) });
const importedBudgetBucket = z.object({ bucket: z.enum(["needs", "wants"]) });
const importedBudgetMove = z.object({ amount: positiveMoneyInput, reversedAt: importTimestamp.nullable().optional() });
const importedHistory = z.object({ changeType: z.enum(["created", "updated", "deleted"]), oldValues: z.string().nullable().optional(), newValues: z.string().nullable().optional(), changedAt: importTimestamp });
const importedAccountState = z.object({ currentBalance: z.number().finite() });
const importedGoalState = z.object({ allocatedAmount: nonNegativeFinite });
const importedTransactionState = z.object({ loanComponent: z.enum(["disbursement", "principal", "interest", "fee"]).nullable().optional() });

function validateRow(schema: z.ZodType, row: Row, key: string) {
  const result = schema.safeParse(row);
  if (!result.success) throw new Error(`Invalid ${key}: ${result.error.issues[0]?.message ?? "unsupported fields"}`);
}

function validateTransactionRow(row: Row) {
  let splits: unknown = row.splits;
  let tags: unknown = row.tags;
  try { if (typeof splits === "string") splits = JSON.parse(splits); } catch { throw new Error("Invalid transaction splits"); }
  try { if (typeof tags === "string") tags = JSON.parse(tags); } catch { throw new Error("Invalid transaction tags"); }
  validateRow(transactionInput, { ...row, categoryId: row.categoryId ?? null, splits, tags, receiptImageUrl: row.receiptImageUrl ?? null, recurringTemplateId: row.recurringTemplateId ?? null, goalId: row.goalId ?? null, savingsInstrumentId: row.savingsInstrumentId ?? null, transferToAccountId: row.transferToAccountId ?? null, transactionAt: row.transactionAt || undefined, clientGeneratedId: row.clientGeneratedId ?? undefined }, "transaction");
  validateRow(importedTransactionState, row, "transaction");
}

function validateLoanRow(row: Row) {
  validateRow(loanInput, { ...row, principal: row.originalPrincipal, setupMode: "existing", cashAccountId: row.accountId, scheduledPayment: row.scheduledPayment ?? null, paymentFrequency: row.paymentFrequency ?? null, firstDueDate: row.firstDueDate ?? null, notes: row.notes ?? null, annualRate: row.annualRate ?? null }, "loan");
}

function transactionTags(value: unknown) {
  let parsed: unknown = value;
  try { if (typeof parsed === "string") parsed = JSON.parse(parsed); } catch { throw new Error("Invalid transaction tags"); }
  const result = z.array(z.string().trim().min(1).max(50)).max(30).safeParse(parsed);
  if (!result.success) throw new Error("Invalid transaction tags");
  return result.data;
}

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
  const result = new Map<string, string>();
  for (const row of items) {
    const id = sourceId(row, key);
    if (result.has(id)) throw new Error(`Duplicate ${key} identifier`);
    result.set(id, randomUUID());
  }
  return result;
}

function mapped(value: unknown, ids: Map<string, string>, fallback = false) {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("Invalid relationship identifier");
  const result = ids.get(value);
  if (result) return result;
  if (fallback) return value;
  throw new Error("The backup contains an incomplete relationship");
}

function requiredMapped(value: unknown, ids: Map<string, string>, fallback = false) {
  const result = mapped(value, ids, fallback);
  if (!result) throw new Error("Invalid required relationship identifier");
  return result;
}

function mappedShared(value: unknown, ids: Map<string, string>, sharedIds: Set<string>) {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("Invalid relationship identifier");
  const result = ids.get(value);
  if (result) return result;
  if (sharedIds.has(value)) return value;
  throw new Error("The backup contains an incomplete private relationship");
}

function validatePortableRows(
  rowsByTable: {
    accountRows: Row[]; categoryRows: Row[]; tagRows: Row[]; typeRows: Row[]; instrumentRows: Row[]; goalRows: Row[];
    loanRows: Row[]; rateRows: Row[]; installmentRows: Row[]; paymentRows: Row[]; budgetRows: Row[]; budgetTemplateRows: Row[];
    budgetPeriodRows: Row[]; budgetAllocationRows: Row[]; budgetBucketRows: Row[]; budgetMoveRows: Row[]; templateRows: Row[];
    transactionRows: Row[]; occurrenceRows: Row[]; historyRows: Row[];
  },
  ids: { accountIds: Map<string, string>; categoryIds: Map<string, string>; typeIds: Map<string, string>; instrumentIds: Map<string, string>; goalIds: Map<string, string>; loanIds: Map<string, string>; installmentIds: Map<string, string>; paymentIds: Map<string, string>; budgetTemplateIds: Map<string, string>; budgetPeriodIds: Map<string, string>; budgetAllocationIds: Map<string, string>; budgetMoveIds: Map<string, string>; templateIds: Map<string, string>; transactionIds: Map<string, string> },
  sharedCategoryIds: Set<string>,
  sharedTypeIds: Set<string>,
) {
  const { accountRows, categoryRows, tagRows, typeRows, instrumentRows, goalRows, loanRows, rateRows, installmentRows, paymentRows, budgetRows, budgetTemplateRows, budgetPeriodRows, budgetAllocationRows, budgetBucketRows, budgetMoveRows, templateRows, transactionRows, occurrenceRows, historyRows } = rowsByTable;
  for (const row of accountRows) { sourceId(row, "account"); validateRow(accountInput, row, "account"); validateRow(importedAccountState, row, "account"); }
  for (const row of categoryRows) { sourceId(row, "category"); validateRow(categoryInput, row, "category"); }
  for (const row of tagRows) { sourceId(row, "tag"); validateRow(tagInput, row, "tag"); }
  for (const row of typeRows) { sourceId(row, "saving instrument type"); validateRow(instrumentTypeInput, row, "saving instrument type"); }
  for (const row of instrumentRows) { sourceId(row, "saving instrument"); validateRow(savingsInstrumentInput, row, "saving instrument"); mappedShared(row.typeId, ids.typeIds, sharedTypeIds); }
  for (const row of goalRows) { sourceId(row, "goal"); validateRow(goalInput, row, "goal"); validateRow(importedGoalState, row, "goal"); mapped(row.accountId, ids.accountIds); }
  for (const row of loanRows) { sourceId(row, "loan"); validateLoanRow(row); mapped(row.accountId, ids.accountIds); }
  for (const row of rateRows) { sourceId(row, "loan rate"); validateRow(loanRateInput, row, "loan rate"); mapped(row.loanId, ids.loanIds); }
  for (const row of installmentRows) { sourceId(row, "loan installment"); validateRow(importedLoanInstallment, row, "loan installment"); mapped(row.loanId, ids.loanIds); }
  for (const row of paymentRows) { sourceId(row, "loan payment"); validateRow(loanPaymentInput, { ...row, installmentId: row.installmentId ?? null, clientGeneratedId: row.clientGeneratedId ?? undefined }, "loan payment"); mapped(row.loanId, ids.loanIds); mapped(row.accountId, ids.accountIds); mapped(row.installmentId, ids.installmentIds); mapped(row.reversedEventId, ids.paymentIds); }
  for (const row of budgetRows) { sourceId(row, "budget"); validateRow(budgetInput, { categoryId: row.categoryId ?? null, name: row.name, limitAmount: row.limitAmount, period: row.period }, "budget"); mappedShared(row.categoryId, ids.categoryIds, sharedCategoryIds); }
  for (const row of budgetTemplateRows) { sourceId(row, "budget template"); validateRow(importedBudgetTemplate, row, "budget template"); if (row.kind === "savings" && row.categoryId != null) throw new Error("Savings budget templates cannot reference a category"); mappedShared(row.categoryId, ids.categoryIds, sharedCategoryIds); }
  for (const row of budgetPeriodRows) { sourceId(row, "budget period"); validateRow(importedBudgetPeriod, row, "budget period"); }
  for (const row of budgetAllocationRows) { sourceId(row, "budget allocation"); validateRow(importedBudgetAllocation, row, "budget allocation"); mapped(row.periodId, ids.budgetPeriodIds); mapped(row.templateId, ids.budgetTemplateIds, true); if (row.kind === "savings" && row.categoryId != null) throw new Error("Savings budget allocations cannot reference a category"); mappedShared(row.categoryId, ids.categoryIds, sharedCategoryIds); }
  for (const row of budgetBucketRows) { sourceId(row, "budget category bucket"); validateRow(importedBudgetBucket, row, "budget category bucket"); mappedShared(row.categoryId, ids.categoryIds, sharedCategoryIds); }
  for (const row of budgetMoveRows) { sourceId(row, "budget move"); validateRow(importedBudgetMove, row, "budget move"); mapped(row.periodId, ids.budgetPeriodIds); mapped(row.fromAllocationId, ids.budgetAllocationIds); mapped(row.toAllocationId, ids.budgetAllocationIds); mapped(row.reversalOfId, ids.budgetMoveIds, true); }
  for (const row of templateRows) { sourceId(row, "recurring template"); validateRow(recurringTemplateInput, row, "recurring template"); mapped(row.accountId, ids.accountIds); mappedShared(row.categoryId, ids.categoryIds, sharedCategoryIds); mapped(row.transferToAccountId, ids.accountIds); mapped(row.savingsInstrumentId, ids.instrumentIds); mapped(row.goalId, ids.goalIds); }
  for (const row of transactionRows) { sourceId(row, "transaction"); validateTransactionRow(row); mapped(row.accountId, ids.accountIds); mappedShared(row.categoryId, ids.categoryIds, sharedCategoryIds); mapped(row.recurringTemplateId, ids.templateIds); mapped(row.goalId, ids.goalIds); mapped(row.savingsInstrumentId, ids.instrumentIds); mapped(row.transferToAccountId, ids.accountIds); mapped(row.loanId, ids.loanIds); mapped(row.loanPaymentEventId, ids.paymentIds); }
  for (const row of occurrenceRows) { sourceId(row, "recurring occurrence"); mapped(row.recurringTemplateId, ids.templateIds); mapped(row.transactionId, ids.transactionIds); }
  for (const row of historyRows) { sourceId(row, "transaction history"); validateRow(importedHistory, row, "transaction history"); mapped(row.transactionId, ids.transactionIds); }
}

async function rollbackImportedData(ids: ImportedIds) {
  const statements: BatchStatement[] = [];
  const addDeletes = (table: Parameters<typeof db.delete>[0], column: AnySQLiteColumn, tableKey: ImportTable) => {
    const values = [...ids.get(tableKey)];
    for (let index = 0; index < values.length; index += 80) statements.push(db.delete(table).where(inArray(column, values.slice(index, index + 80))));
  };
  addDeletes(transactionHistory, transactionHistory.id, "transactionHistory");
  addDeletes(recurringOccurrences, recurringOccurrences.id, "recurringOccurrences");
  addDeletes(transactions, transactions.id, "transactions");
  addDeletes(loanPaymentEvents, loanPaymentEvents.id, "loanPaymentEvents");
  addDeletes(loanInstallments, loanInstallments.id, "loanInstallments");
  addDeletes(loanRatePeriods, loanRatePeriods.id, "loanRatePeriods");
  addDeletes(loans, loans.id, "loans");
  addDeletes(recurringTemplates, recurringTemplates.id, "recurringTemplates");
  addDeletes(budgetMoves, budgetMoves.id, "budgetMoves");
  addDeletes(budgetAllocations, budgetAllocations.id, "budgetAllocations");
  addDeletes(budgetCategoryBuckets, budgetCategoryBuckets.id, "budgetCategoryBuckets");
  addDeletes(budgetPeriods, budgetPeriods.id, "budgetPeriods");
  addDeletes(budgetTemplates, budgetTemplates.id, "budgetTemplates");
  addDeletes(spendingBudgets, spendingBudgets.id, "spendingBudgets");
  addDeletes(savingsInstruments, savingsInstruments.id, "savingsInstruments");
  addDeletes(savingsInstrumentTypes, savingsInstrumentTypes.id, "savingsInstrumentTypes");
  addDeletes(goals, goals.id, "goals");
  addDeletes(categories, categories.id, "categories");
  addDeletes(userTags, userTags.id, "userTags");
  addDeletes(accounts, accounts.id, "accounts");
  for (let index = 0; index < statements.length; index += IMPORT_BATCH_SIZE) {
    const batch = statements.slice(index, index + IMPORT_BATCH_SIZE);
    await db.batch(batch as [BatchStatement, ...BatchStatement[]]);
  }
}

function copy(row: Row, fields: string[]) {
  return Object.fromEntries(fields.filter((field) => row[field] !== undefined).map((field) => [field, row[field]]));
}

function remapSplits(value: unknown, categoryIds: Map<string, string>, sharedCategoryIds: Set<string>) {
  let parsed: unknown = value;
  try { if (typeof parsed === "string") parsed = JSON.parse(parsed); } catch { throw new Error("Invalid transaction splits"); }
  if (!Array.isArray(parsed)) return "[]";
  return JSON.stringify(parsed.map((split) => {
    if (!split || typeof split !== "object") throw new Error("Invalid transaction split");
    const item = split as Row;
    const validated = transactionSplitInput.safeParse(item);
    if (!validated.success) throw new Error("Invalid transaction split");
    return { categoryId: mappedShared(validated.data.categoryId, categoryIds, sharedCategoryIds), amount: validated.data.amount, note: validated.data.note ?? null };
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
  if (itemCount > MAX_IMPORT_RECORDS) throw new PortabilityLimitError(`This backup contains too many records. Imports are limited to ${MAX_IMPORT_RECORDS.toLocaleString()} records.`);

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
  validatePortableRows({ accountRows, categoryRows, tagRows, typeRows, instrumentRows, goalRows, loanRows, rateRows, installmentRows, paymentRows, budgetRows, budgetTemplateRows, budgetPeriodRows, budgetAllocationRows, budgetBucketRows, budgetMoveRows, templateRows, transactionRows, occurrenceRows, historyRows }, { accountIds, categoryIds, typeIds, instrumentIds, goalIds, loanIds, installmentIds, paymentIds, budgetTemplateIds, budgetPeriodIds, budgetAllocationIds, budgetMoveIds, templateIds, transactionIds }, sharedCategoryIds, sharedTypeIds);

  const writer = new ImportBatchWriter();
  const importedIds = new ImportedIds();
  const add = async (table: ImportTable, id: string, statement: BatchStatement) => { importedIds.add(table, id); await writer.add(statement); };
  try {
    for (const row of accountRows) { const id = requiredMapped(row.id, accountIds); await add("accounts", id, db.insert(accounts).values({ ...copy(row, ["name", "type", "currency", "openingBalance", "currentBalance", "displayOrder", "backgroundColor", "icon", "includeInTotalBalance", "allowNegativeBalance"]), id, userId, isDefault: false } as typeof accounts.$inferInsert)); }
    for (const row of categoryRows) { const id = requiredMapped(row.id, categoryIds); await add("categories", id, db.insert(categories).values({ ...copy(row, ["name", "type", "icon", "color"]), id, userId } as typeof categories.$inferInsert)); }
    for (const row of tagRows) { const name = typeof row.name === "string" ? row.name.trim() : ""; if (name && !existingTags.has(name.toLocaleLowerCase())) { existingTags.add(name.toLocaleLowerCase()); const id = randomUUID(); await add("userTags", id, db.insert(userTags).values({ id, userId, name, createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString() })); } }
    for (const row of typeRows) { const id = requiredMapped(row.id, typeIds); await add("savingsInstrumentTypes", id, db.insert(savingsInstrumentTypes).values({ ...copy(row, ["name", "isDefault"]), id, userId } as typeof savingsInstrumentTypes.$inferInsert)); }
    for (const row of instrumentRows) { const id = requiredMapped(row.id, instrumentIds); await add("savingsInstruments", id, db.insert(savingsInstruments).values({ ...copy(row, ["name", "description", "currentBalance", "interestRate", "icon", "backgroundColor", "maturityDate"]), id, userId, typeId: mappedShared(row.typeId, typeIds, sharedTypeIds) } as typeof savingsInstruments.$inferInsert)); }
    for (const row of goalRows) { const id = requiredMapped(row.id, goalIds); await add("goals", id, db.insert(goals).values({ ...copy(row, ["name", "targetAmount", "allocatedAmount", "monthlyContribution", "status", "targetDate"]), id, userId, accountId: mapped(row.accountId, accountIds) } as typeof goals.$inferInsert)); }
    for (const row of loanRows) { const id = requiredMapped(row.id, loanIds); await add("loans", id, db.insert(loans).values({ ...copy(row, ["name", "counterparty", "direction", "currency", "originalPrincipal", "interestMethod", "paymentFrequency", "scheduledPayment", "termCount", "startDate", "firstDueDate", "nextDueDate", "status", "notes", "createdAt", "updatedAt"]), id, userId, accountId: mapped(row.accountId, accountIds) } as typeof loans.$inferInsert)); }
    for (const row of rateRows) { const id = randomUUID(); await add("loanRatePeriods", id, db.insert(loanRatePeriods).values({ ...copy(row, ["annualRate", "effectiveDate", "createdAt"]), id, loanId: mapped(row.loanId, loanIds) } as typeof loanRatePeriods.$inferInsert)); }
    for (const row of installmentRows) { const id = requiredMapped(row.id, installmentIds); await add("loanInstallments", id, db.insert(loanInstallments).values({ ...copy(row, ["sequence", "dueDate", "expectedPrincipal", "expectedInterest", "expectedFees", "paidPrincipal", "paidInterest", "paidFees", "status"]), id, loanId: mapped(row.loanId, loanIds) } as typeof loanInstallments.$inferInsert)); }
    for (const row of paymentRows) { const id = requiredMapped(row.id, paymentIds); await add("loanPaymentEvents", id, db.insert(loanPaymentEvents).values({ ...copy(row, ["kind", "principal", "interest", "fees", "date", "createdAt"]), id, userId, loanId: mapped(row.loanId, loanIds), accountId: mapped(row.accountId, accountIds), installmentId: mapped(row.installmentId, installmentIds), clientGeneratedId: null, reversedEventId: mapped(row.reversedEventId, paymentIds) } as typeof loanPaymentEvents.$inferInsert)); }
    for (const row of budgetTemplateRows) { const categoryId = mappedShared(row.categoryId, categoryIds, sharedCategoryIds); const period = row.recurrence as string; const kind = row.kind as "expense" | "savings"; const scope = `${period}:${kind}:${categoryId ?? "overall"}`; if (existingBudgetScopes.has(scope)) { skippedBudgetTemplateIds.add(row.id as string); continue; } existingBudgetScopes.add(scope); const id = requiredMapped(row.id, budgetTemplateIds); await add("budgetTemplates", id, db.insert(budgetTemplates).values({ ...copy(row, ["name", "recurrence", "kind", "defaultAmount", "rolloverRule", "createdAt", "updatedAt"]), id, userId, categoryId: kind === "savings" ? null : categoryId, kind, clientGeneratedId: null } as typeof budgetTemplates.$inferInsert)); }
    for (const row of budgetPeriodRows) { const id = requiredMapped(row.id, budgetPeriodIds); await add("budgetPeriods", id, db.insert(budgetPeriods).values({ ...copy(row, ["recurrence", "periodStart", "periodEnd", "totalLimit", "status", "createdAt", "updatedAt"]), id, userId } as typeof budgetPeriods.$inferInsert)); }
    for (const row of budgetAllocationRows) { if (typeof row.templateId === "string" && skippedBudgetTemplateIds.has(row.templateId)) continue; const kind = row.kind as "expense" | "savings"; const id = requiredMapped(row.id, budgetAllocationIds); await add("budgetAllocations", id, db.insert(budgetAllocations).values({ ...copy(row, ["originalAmount", "adjustedAmount", "rolloverAmount", "createdAt", "updatedAt"]), id, periodId: mapped(row.periodId, budgetPeriodIds), templateId: mapped(row.templateId, budgetTemplateIds), categoryId: kind === "savings" ? null : mappedShared(row.categoryId, categoryIds, sharedCategoryIds), kind } as typeof budgetAllocations.$inferInsert)); }
    for (const row of budgetBucketRows) { const id = randomUUID(); await add("budgetCategoryBuckets", id, db.insert(budgetCategoryBuckets).values({ ...copy(row, ["bucket", "createdAt", "updatedAt"]), id, userId, categoryId: mappedShared(row.categoryId, categoryIds, sharedCategoryIds) } as typeof budgetCategoryBuckets.$inferInsert)); }
    for (const row of budgetMoveRows) { const id = requiredMapped(row.id, budgetMoveIds); await add("budgetMoves", id, db.insert(budgetMoves).values({ ...copy(row, ["amount", "reversedAt", "createdAt"]), id, userId, periodId: mapped(row.periodId, budgetPeriodIds), fromAllocationId: mapped(row.fromAllocationId, budgetAllocationIds), toAllocationId: mapped(row.toAllocationId, budgetAllocationIds), reversalOfId: mapped(row.reversalOfId, budgetMoveIds) } as typeof budgetMoves.$inferInsert)); }
    for (const row of budgetRows) { const categoryId = mappedShared(row.categoryId, categoryIds, sharedCategoryIds); const period = row.period as string; const scope = `${period}:${categoryId ?? "overall"}`; if (existingBudgetScopes.has(scope)) continue; existingBudgetScopes.add(scope); const id = randomUUID(); await add("spendingBudgets", id, db.insert(spendingBudgets).values({ ...copy(row, ["name", "limitAmount", "period", "createdAt", "updatedAt"]), id, userId, categoryId, clientGeneratedId: null, createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(), updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString() } as typeof spendingBudgets.$inferInsert)); }
    for (const row of templateRows) { const id = requiredMapped(row.id, templateIds); await add("recurringTemplates", id, db.insert(recurringTemplates).values({ ...copy(row, ["type", "amount", "title", "notes", "frequency", "nextDueDate", "endDate", "approvalRequired", "isActive"]), id, userId, accountId: mapped(row.accountId, accountIds), categoryId: mappedShared(row.categoryId, categoryIds, sharedCategoryIds), transferToAccountId: mapped(row.transferToAccountId, accountIds), savingsInstrumentId: mapped(row.savingsInstrumentId, instrumentIds), goalId: mapped(row.goalId, goalIds) } as typeof recurringTemplates.$inferInsert)); }
    for (const row of transactionRows) { const id = requiredMapped(row.id, transactionIds); await add("transactions", id, db.insert(transactions).values({ ...copy(row, ["type", "amount", "title", "merchantName", "notes", "isRecurring", "receiptImageUrl", "loanComponent", "date", "transactionAt", "createdAt", "updatedAt"]), id, userId, accountId: mapped(row.accountId, accountIds), categoryId: mappedShared(row.categoryId, categoryIds, sharedCategoryIds), splits: remapSplits(row.splits, categoryIds, sharedCategoryIds), tags: JSON.stringify(transactionTags(row.tags)), recurringTemplateId: mapped(row.recurringTemplateId, templateIds), goalId: mapped(row.goalId, goalIds), savingsInstrumentId: mapped(row.savingsInstrumentId, instrumentIds), transferToAccountId: mapped(row.transferToAccountId, accountIds), loanId: mapped(row.loanId, loanIds), loanPaymentEventId: mapped(row.loanPaymentEventId, paymentIds), syncStatus: "synced", clientGeneratedId: null } as typeof transactions.$inferInsert)); }
    for (const row of occurrenceRows) { const id = randomUUID(); await add("recurringOccurrences", id, db.insert(recurringOccurrences).values({ ...copy(row, ["scheduledDate", "status", "createdAt", "updatedAt"]), id, userId, recurringTemplateId: mapped(row.recurringTemplateId, templateIds), transactionId: mapped(row.transactionId, transactionIds) } as typeof recurringOccurrences.$inferInsert)); }
    for (const row of historyRows) { const id = randomUUID(); await add("transactionHistory", id, db.insert(transactionHistory).values({ ...copy(row, ["changeType", "oldValues", "newValues", "changedAt"]), id, transactionId: mapped(row.transactionId, transactionIds), changedBy: userId } as typeof transactionHistory.$inferInsert)); }
    await writer.flush();
  } catch (error) {
    try { await rollbackImportedData(importedIds); } catch (rollbackError) { console.error("Portability import rollback failed", rollbackError); }
    throw error;
  }
  return { itemCount, counts: { accounts: accountRows.length, transactions: transactionRows.length, loans: loanRows.length, goals: goalRows.length, recurringTemplates: templateRows.length, savingsInstruments: instrumentRows.length } };
}

export async function portabilityCounts(userId: string) {
  const [{ count: exportsCount }] = await db.select({ count: sql<number>`count(*)` }).from(dataExports).where(and(eq(dataExports.userId, userId), eq(dataExports.status, "completed")));
  const [{ count: importsCount }] = await db.select({ count: sql<number>`count(*)` }).from(dataImports).where(and(eq(dataImports.userId, userId), eq(dataImports.status, "completed")));
  return { exports: Number(exportsCount), imports: Number(importsCount) };
}
