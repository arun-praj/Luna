import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, isNull, lte, lt, ne, or } from "drizzle-orm";

import { db } from "@/backend/db/client";
import { budgetAllocations, budgetCategoryBuckets, budgetMoves, budgetPeriods, budgetTemplates, categories, transactions } from "@/backend/db/schema";
import { budgetPeriodBounds, budgetSavingsAmount, budgetTransactionAmount, median, periodDayCounts, projectedSpending, safeDailySpending, spentForBudget, withBudgetProgress, type BudgetAllocationKind, type BudgetCategoryBucket, type BudgetPeriod, type BudgetRecommendation, type BudgetReview, type BudgetReviewRow, type BudgetRolloverRule } from "@/lib/budgets";
import { addMoney, normalizeMoney, subtractMoney } from "@/lib/money";

export type BudgetMutationInput = {
  categoryId?: string | null;
  kind?: BudgetAllocationKind;
  limitAmount: number;
  period: BudgetPeriod;
  rolloverRule?: BudgetRolloverRule;
  name?: string;
  clientGeneratedId?: string;
  updatedAt?: string;
};

export class BudgetConflictError extends Error {
  constructor(public readonly budgetId: string) {
    super("A budget already exists for this category and period.");
  }
}

export class BudgetDeleteConflictError extends Error {
  constructor() {
    super("This budget has money-move history. Undo the move or keep the budget to preserve its audit trail.");
  }
}

type BatchStatement = Parameters<typeof db.batch>[0][number];
type BudgetMutationResult = typeof budgetAllocations.$inferSelect & { period: BudgetPeriod; periodId: string };

function executeBatch(statements: BatchStatement[]) {
  return db.batch(statements as [BatchStatement, ...BatchStatement[]]);
}

async function requireExpenseCategory(userId: string, categoryId: string | null) {
  if (!categoryId) return null;
  const [category] = await db.select().from(categories).where(and(eq(categories.id, categoryId), eq(categories.type, "expense"))).limit(1);
  if (!category || (category.userId !== null && category.userId !== userId)) throw new Error("Expense category not found.");
  return category;
}

function templateScope(userId: string, categoryId: string | null, period: BudgetPeriod, kind: BudgetAllocationKind) {
  return and(
    eq(budgetTemplates.userId, userId),
    eq(budgetTemplates.recurrence, period),
    eq(budgetTemplates.kind, kind),
    categoryId === null ? isNull(budgetTemplates.categoryId) : eq(budgetTemplates.categoryId, categoryId),
  );
}

function allocationScope(periodId: string, categoryId: string | null, kind: BudgetAllocationKind) {
  return and(
    eq(budgetAllocations.periodId, periodId),
    eq(budgetAllocations.kind, kind),
    categoryId === null ? isNull(budgetAllocations.categoryId) : eq(budgetAllocations.categoryId, categoryId),
  );
}

async function ensureBudgetPeriod(userId: string, period: BudgetPeriod, today: string) {
  const bounds = budgetPeriodBounds(period, today);
  let [existing] = await db.select().from(budgetPeriods).where(and(
    eq(budgetPeriods.userId, userId), eq(budgetPeriods.recurrence, period), eq(budgetPeriods.periodStart, bounds.start),
  )).limit(1);
  if (existing) return existing;
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  await executeBatch([db.insert(budgetPeriods).values({
    id, userId, recurrence: period, periodStart: bounds.start, periodEnd: bounds.end,
    totalLimit: 0, status: "open", createdAt: timestamp, updatedAt: timestamp,
  }).onConflictDoNothing()]);
  [existing] = await db.select().from(budgetPeriods).where(and(
    eq(budgetPeriods.userId, userId), eq(budgetPeriods.recurrence, period), eq(budgetPeriods.periodStart, bounds.start),
  )).limit(1);
  if (!existing) throw new Error("Unable to create budget period");
  return existing;
}

async function materializeTemplates(userId: string, period: BudgetPeriod, budgetPeriod: typeof budgetPeriods.$inferSelect) {
  const [templates, existingAllocations, previous] = await Promise.all([
    db.select().from(budgetTemplates).where(and(eq(budgetTemplates.userId, userId), eq(budgetTemplates.recurrence, period))),
    db.select({ templateId: budgetAllocations.templateId }).from(budgetAllocations).where(eq(budgetAllocations.periodId, budgetPeriod.id)),
    db.select().from(budgetPeriods).where(and(eq(budgetPeriods.userId, userId), eq(budgetPeriods.recurrence, period), lt(budgetPeriods.periodStart, budgetPeriod.periodStart))).orderBy(desc(budgetPeriods.periodStart)).limit(1),
  ]);
  const existingTemplateIds = new Set(existingAllocations.map((allocation) => allocation.templateId).filter((id): id is string => Boolean(id)));
  const previousPeriod = previous[0];
  const [previousAllocations, previousExpenses] = previousPeriod
    ? await Promise.all([
      db.select().from(budgetAllocations).where(eq(budgetAllocations.periodId, previousPeriod.id)),
      db.select({ type: transactions.type, amount: transactions.amount, categoryId: transactions.categoryId, splits: transactions.splits }).from(transactions).where(and(eq(transactions.userId, userId), gte(transactions.date, previousPeriod.periodStart), lte(transactions.date, previousPeriod.periodEnd))),
    ])
    : [[], []] as Array<never[]>;
  const timestamp = new Date().toISOString();
  const statements: BatchStatement[] = [];
  for (const template of templates) {
    if (existingTemplateIds.has(template.id)) continue;
    const previousAllocation = previousAllocations.find((allocation) => allocation.kind === template.kind && (allocation.templateId === template.id || (allocation.templateId === null && allocation.categoryId === template.categoryId)));
    const previousLimit = previousAllocation ? allocationLimit(previousAllocation) : 0;
    const previousSpent = previousAllocation ? previousAllocation.kind === "savings"
      ? previousExpenses.reduce((total, row) => addMoney(total, budgetSavingsAmount(row)), 0)
      : spentForBudget(previousExpenses, previousAllocation.categoryId) : 0;
    const unused = normalizeMoney(Math.max(previousLimit - previousSpent, 0));
    const rolloverAmount = template.rolloverRule === "uncapped" ? unused : template.rolloverRule === "cap" ? normalizeMoney(Math.min(unused, template.defaultAmount)) : 0;
    statements.push(db.insert(budgetAllocations).values({
      id: randomUUID(), periodId: budgetPeriod.id, templateId: template.id, categoryId: template.categoryId, kind: template.kind,
      originalAmount: template.defaultAmount, adjustedAmount: template.defaultAmount, rolloverAmount,
      createdAt: timestamp, updatedAt: timestamp,
    }).onConflictDoNothing());
    if (template.kind === "expense" && template.categoryId === null) statements.push(db.update(budgetPeriods).set({ totalLimit: normalizeMoney(template.defaultAmount + rolloverAmount), updatedAt: timestamp }).where(eq(budgetPeriods.id, budgetPeriod.id)));
  }
  if (statements.length) await executeBatch(statements);
}

function allocationLimit(allocation: typeof budgetAllocations.$inferSelect) {
  return normalizeMoney(allocation.adjustedAmount + allocation.rolloverAmount);
}

export async function listBudgets(userId: string, period: BudgetPeriod, today = new Date().toISOString().slice(0, 10), materialize = true) {
  const { start, end } = budgetPeriodBounds(period, today);
  const currentPeriod = materialize
    ? await ensureBudgetPeriod(userId, period, today)
    : (await db.select().from(budgetPeriods).where(and(
      eq(budgetPeriods.userId, userId), eq(budgetPeriods.recurrence, period), eq(budgetPeriods.periodStart, start),
    )).limit(1))[0];
  if (!currentPeriod) return [];
  if (materialize) await materializeTemplates(userId, period, currentPeriod);
  const [allocationRows, categoryRows, expenseRows] = await Promise.all([
    db.select({ allocation: budgetAllocations, budgetPeriod: budgetPeriods, template: budgetTemplates })
      .from(budgetAllocations)
      .innerJoin(budgetPeriods, eq(budgetAllocations.periodId, budgetPeriods.id))
      .leftJoin(budgetTemplates, eq(budgetAllocations.templateId, budgetTemplates.id))
      .where(and(eq(budgetPeriods.userId, userId), eq(budgetPeriods.recurrence, period), eq(budgetPeriods.periodStart, start))),
    db.select().from(categories),
    db.select({ type: transactions.type, amount: transactions.amount, categoryId: transactions.categoryId, splits: transactions.splits })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.date, start), lte(transactions.date, end))),
  ]);
  const categoryMap = new Map(categoryRows.filter((category) => category.userId === null || category.userId === userId).map((category) => [category.id, category]));
  return allocationRows.map(({ allocation, budgetPeriod, template }) => {
    const category = allocation.categoryId ? categoryMap.get(allocation.categoryId) ?? null : null;
    const limitAmount = allocationLimit(allocation);
    const spent = allocation.kind === "savings"
      ? expenseRows.reduce((total, row) => addMoney(total, budgetSavingsAmount(row)), 0)
      : spentForBudget(expenseRows, allocation.categoryId);
    const progress = withBudgetProgress(limitAmount, spent);
    return {
      ...allocation,
      ...budgetPeriod,
      id: allocation.id,
      name: allocation.kind === "savings" ? "Savings target" : category ? `${category.name} budget` : "Overall budget",
      originalAmount: normalizeMoney(allocation.originalAmount),
      adjustedAmount: normalizeMoney(allocation.adjustedAmount),
      rolloverAmount: normalizeMoney(allocation.rolloverAmount),
      period: budgetPeriod.recurrence,
      kind: allocation.kind,
      periodStatus: budgetPeriod.status,
      clientGeneratedId: template?.clientGeneratedId ?? null,
      rolloverRule: template?.rolloverRule ?? "none",
      ...progress,
      category: category ? { id: category.id, name: category.name, icon: category.icon, color: category.color } : null,
    };
  }).sort((left, right) => {
    if (!left.categoryId) return -1;
    if (!right.categoryId) return 1;
    return right.percentage - left.percentage || left.name.localeCompare(right.name);
  });
}

export async function previewPreviousBudgetPeriod(userId: string, period: BudgetPeriod, today = new Date().toISOString().slice(0, 10)) {
  const { start } = budgetPeriodBounds(period, today);
  const [previous] = await db.select().from(budgetPeriods).where(and(
    eq(budgetPeriods.userId, userId), eq(budgetPeriods.recurrence, period), lt(budgetPeriods.periodStart, start),
  )).orderBy(desc(budgetPeriods.periodStart)).limit(1);
  if (!previous) return { period, periodStart: null, periodEnd: null, budgets: [] };
  return {
    period,
    periodStart: previous.periodStart,
    periodEnd: previous.periodEnd,
    budgets: await listBudgets(userId, period, previous.periodStart, false),
  };
}

export async function getBudgetDetails(userId: string, id: string) {
  const [currentRow] = await db.select({ allocation: budgetAllocations, period: budgetPeriods })
    .from(budgetAllocations)
    .innerJoin(budgetPeriods, eq(budgetAllocations.periodId, budgetPeriods.id))
    .where(and(eq(budgetAllocations.id, id), eq(budgetPeriods.userId, userId)))
    .limit(1);
  if (!currentRow) return null;

  const currentBudgets = await listBudgets(userId, currentRow.period.recurrence, currentRow.period.periodStart, false);
  const budget = currentBudgets.find((item) => item.id === id);
  if (!budget) return null;

  const previousPeriods = await db.select().from(budgetPeriods)
    .where(and(
      eq(budgetPeriods.userId, userId),
      eq(budgetPeriods.recurrence, currentRow.period.recurrence),
      lt(budgetPeriods.periodStart, currentRow.period.periodStart),
    ))
    .orderBy(desc(budgetPeriods.periodStart))
    .limit(12);
  const historicalBudgets = await Promise.all(previousPeriods.map(async (period) => {
    const periodBudgets = await listBudgets(userId, period.recurrence, period.periodStart, false);
    return periodBudgets.find((item) => item.categoryId === budget.categoryId && item.kind === budget.kind) ?? null;
  }));

  const transactionRows = await db.select({
    id: transactions.id,
    type: transactions.type,
    amount: transactions.amount,
    categoryId: transactions.categoryId,
    splits: transactions.splits,
    title: transactions.title,
    merchantName: transactions.merchantName,
    date: transactions.date,
  }).from(transactions).where(and(
    eq(transactions.userId, userId),
    gte(transactions.date, currentRow.period.periodStart),
    lte(transactions.date, currentRow.period.periodEnd),
  )).orderBy(desc(transactions.date), desc(transactions.createdAt));

  const transactionsForBudget = transactionRows.map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    amount: budget.kind === "savings" ? budgetSavingsAmount(transaction) : budgetTransactionAmount(transaction, budget.categoryId),
    title: transaction.title || transaction.merchantName || "Untitled transaction",
    date: transaction.date,
  })).filter((transaction) => transaction.amount > 0);

  return {
    budget,
    history: historicalBudgets.filter((item): item is NonNullable<typeof item> => Boolean(item)),
    transactions: transactionsForBudget,
  };
}

export async function copyPreviousBudgetPeriod(userId: string, period: BudgetPeriod, today = new Date().toISOString().slice(0, 10)) {
  const bounds = budgetPeriodBounds(period, today);
  const target = await ensureBudgetPeriod(userId, period, today);
  const [previous] = await db.select().from(budgetPeriods).where(and(
    eq(budgetPeriods.userId, userId), eq(budgetPeriods.recurrence, period), lt(budgetPeriods.periodStart, bounds.start),
  )).orderBy(desc(budgetPeriods.periodStart)).limit(1);
  if (!previous) return { copied: 0, periodId: target.id };
  const [sourceAllocations, targetAllocations] = await Promise.all([
    db.select().from(budgetAllocations).where(eq(budgetAllocations.periodId, previous.id)),
    db.select({ categoryId: budgetAllocations.categoryId, kind: budgetAllocations.kind }).from(budgetAllocations).where(eq(budgetAllocations.periodId, target.id)),
  ]);
  const existingScopes = new Set(targetAllocations.map((allocation) => `${allocation.kind}:${allocation.categoryId ?? "overall"}`));
  const timestamp = new Date().toISOString();
  const statements: BatchStatement[] = [];
  let copied = 0;
  for (const source of sourceAllocations) {
    const scope = `${source.kind}:${source.categoryId ?? "overall"}`;
    if (existingScopes.has(scope)) continue;
    existingScopes.add(scope);
    copied += 1;
    statements.push(db.insert(budgetAllocations).values({
      id: randomUUID(), periodId: target.id, templateId: source.templateId, categoryId: source.categoryId, kind: source.kind,
      originalAmount: source.adjustedAmount, adjustedAmount: source.adjustedAmount, rolloverAmount: 0,
      createdAt: timestamp, updatedAt: timestamp,
    }));
    if (source.kind === "expense" && source.categoryId === null) statements.push(db.update(budgetPeriods).set({ totalLimit: source.adjustedAmount, updatedAt: timestamp }).where(eq(budgetPeriods.id, target.id)));
  }
  if (statements.length) await executeBatch(statements);
  return { copied, periodId: target.id };
}

export async function createBudget(userId: string, input: BudgetMutationInput): Promise<BudgetMutationResult> {
  const categoryId = input.kind === "savings" ? null : input.categoryId ?? null;
  const kind = input.kind ?? "expense";
  const category = await requireExpenseCategory(userId, categoryId);
  const [idempotent] = input.clientGeneratedId
    ? await db.select().from(budgetTemplates).where(and(eq(budgetTemplates.clientGeneratedId, input.clientGeneratedId), eq(budgetTemplates.userId, userId))).limit(1)
    : [];
  if (idempotent) {
    const period = await ensureBudgetPeriod(userId, input.period, new Date().toISOString().slice(0, 10));
    const [allocation] = await db.select().from(budgetAllocations).where(and(eq(budgetAllocations.periodId, period.id), eq(budgetAllocations.templateId, idempotent.id))).limit(1);
    if (allocation) return { ...allocation, period: period.recurrence, periodId: period.id };
  }
  const [templateConflict] = await db.select({ id: budgetTemplates.id }).from(budgetTemplates).where(templateScope(userId, categoryId, input.period, kind)).limit(1);
  if (templateConflict) {
    const [allocation] = await db.select({ id: budgetAllocations.id }).from(budgetAllocations).innerJoin(budgetPeriods, eq(budgetAllocations.periodId, budgetPeriods.id)).where(and(eq(budgetAllocations.templateId, templateConflict.id), eq(budgetPeriods.userId, userId))).orderBy(asc(budgetAllocations.createdAt)).limit(1);
    throw new BudgetConflictError(allocation?.id ?? templateConflict.id);
  }
  const today = new Date().toISOString().slice(0, 10);
  const period = await ensureBudgetPeriod(userId, input.period, today);
  const [allocationConflict] = await db.select({ id: budgetAllocations.id }).from(budgetAllocations).where(allocationScope(period.id, categoryId, kind)).limit(1);
  if (allocationConflict) throw new BudgetConflictError(allocationConflict.id);
  const timestamp = input.updatedAt ?? new Date().toISOString();
  const templateId = randomUUID();
  const allocationId = randomUUID();
  const amount = normalizeMoney(input.limitAmount);
  const template = { id: templateId, userId, categoryId, kind, name: input.name?.trim() || (kind === "savings" ? "Savings target" : category ? `${category.name} budget` : "Overall budget"), recurrence: input.period, defaultAmount: amount, rolloverRule: input.rolloverRule ?? "none", clientGeneratedId: input.clientGeneratedId ?? null, createdAt: timestamp, updatedAt: timestamp };
  const allocation = { id: allocationId, periodId: period.id, templateId, categoryId, kind, originalAmount: amount, adjustedAmount: amount, rolloverAmount: 0, createdAt: timestamp, updatedAt: timestamp };
  const statements: BatchStatement[] = [db.insert(budgetTemplates).values(template), db.insert(budgetAllocations).values(allocation)];
  if (kind === "expense" && categoryId === null) statements.push(db.update(budgetPeriods).set({ totalLimit: amount, updatedAt: timestamp }).where(eq(budgetPeriods.id, period.id)));
  await executeBatch(statements);
  return { ...allocation, period: input.period, periodId: period.id };
}

export async function updateBudget(userId: string, id: string, input: Partial<BudgetMutationInput>): Promise<BudgetMutationResult | null> {
  const [currentRow] = await db.select({ allocation: budgetAllocations, period: budgetPeriods, template: budgetTemplates })
    .from(budgetAllocations)
    .innerJoin(budgetPeriods, eq(budgetAllocations.periodId, budgetPeriods.id))
    .leftJoin(budgetTemplates, eq(budgetAllocations.templateId, budgetTemplates.id))
    .where(and(eq(budgetAllocations.id, id), eq(budgetPeriods.userId, userId))).limit(1);
  if (!currentRow) return null;
  const current = currentRow.allocation;
  const period = currentRow.period;
  if (input.updatedAt && input.updatedAt <= current.updatedAt) return { ...current, period: period.recurrence, periodId: period.id };
  if (input.period && input.period !== period.recurrence) throw new Error("A budget's recurrence cannot change after a period is created. Create a new budget instead.");
  const kind = current.kind;
  if (input.kind && input.kind !== kind) throw new Error("A budget's kind cannot change after a period is created.");
  const categoryId = kind === "savings" ? null : input.categoryId === undefined ? current.categoryId : input.categoryId ?? null;
  const category = await requireExpenseCategory(userId, categoryId);
  const [conflict] = await db.select({ id: budgetAllocations.id }).from(budgetAllocations).where(and(allocationScope(period.id, categoryId, kind), ne(budgetAllocations.id, id))).limit(1);
  if (conflict) throw new BudgetConflictError(conflict.id);
  const timestamp = input.updatedAt ?? new Date().toISOString();
  const amount = input.limitAmount === undefined ? normalizeMoney(current.adjustedAmount) : normalizeMoney(input.limitAmount);
  const allocation = { ...current, categoryId, adjustedAmount: amount, updatedAt: timestamp };
  const template = currentRow.template ? { ...currentRow.template, categoryId, name: input.name?.trim() || (kind === "savings" ? "Savings target" : category ? `${category.name} budget` : "Overall budget"), defaultAmount: amount, rolloverRule: input.rolloverRule ?? currentRow.template.rolloverRule, recurrence: period.recurrence, updatedAt: timestamp } : null;
  const statements: BatchStatement[] = [db.update(budgetAllocations).set({ categoryId, adjustedAmount: amount, updatedAt: timestamp }).where(and(eq(budgetAllocations.id, id), eq(budgetAllocations.updatedAt, current.updatedAt)))];
  if (template) statements.push(db.update(budgetTemplates).set({ categoryId: template.categoryId, name: template.name, defaultAmount: template.defaultAmount, rolloverRule: template.rolloverRule, updatedAt: timestamp }).where(eq(budgetTemplates.id, template.id)));
  if (kind === "expense" && categoryId === null) statements.push(db.update(budgetPeriods).set({ totalLimit: amount, updatedAt: timestamp }).where(eq(budgetPeriods.id, period.id)));
  await executeBatch(statements);
  return { ...allocation, period: period.recurrence, periodId: period.id };
}

export async function deleteBudget(userId: string, id: string) {
  const [current] = await db.select({ allocation: budgetAllocations, period: budgetPeriods, template: budgetTemplates })
    .from(budgetAllocations).innerJoin(budgetPeriods, eq(budgetAllocations.periodId, budgetPeriods.id)).leftJoin(budgetTemplates, eq(budgetAllocations.templateId, budgetTemplates.id))
    .where(and(eq(budgetAllocations.id, id), eq(budgetPeriods.userId, userId))).limit(1);
  if (!current) return false;
  const [move] = await db.select({ id: budgetMoves.id }).from(budgetMoves).where(and(
    eq(budgetMoves.userId, userId),
    or(eq(budgetMoves.fromAllocationId, id), eq(budgetMoves.toAllocationId, id)),
  )).limit(1);
  if (move) throw new BudgetDeleteConflictError();
  const statements: BatchStatement[] = [db.delete(budgetAllocations).where(eq(budgetAllocations.id, id))];
  if (current.template) statements.push(db.delete(budgetTemplates).where(eq(budgetTemplates.id, current.template.id)));
  if (current.allocation.kind === "expense" && current.allocation.categoryId === null) statements.push(db.update(budgetPeriods).set({ totalLimit: 0, updatedAt: new Date().toISOString() }).where(eq(budgetPeriods.id, current.period.id)));
  await executeBatch(statements);
  return true;
}

function monthStartShift(value: string, offset: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7) + "-01";
}

function categoryAmounts(row: { type: string; amount: number; categoryId: string | null; splits: string }) {
  if (row.type !== "expense") return [] as Array<{ categoryId: string; amount: number }>;
  try {
    const splits = JSON.parse(row.splits) as Array<{ categoryId?: string; amount?: number }>;
    if (splits.length) return splits.filter((split): split is { categoryId: string; amount: number } => typeof split.categoryId === "string" && Number(split.amount) > 0).map((split) => ({ categoryId: split.categoryId, amount: normalizeMoney(Number(split.amount)) }));
  } catch {
    // Fall through to the transaction category.
  }
  return row.categoryId ? [{ categoryId: row.categoryId, amount: normalizeMoney(row.amount) }] : [];
}

export async function getBudgetCategoryBuckets(userId: string) {
  return db.select({ categoryId: budgetCategoryBuckets.categoryId, bucket: budgetCategoryBuckets.bucket })
    .from(budgetCategoryBuckets)
    .where(eq(budgetCategoryBuckets.userId, userId));
}

export async function saveBudgetCategoryBuckets(userId: string, assignments: Array<{ categoryId: string; bucket: BudgetCategoryBucket | null }>) {
  const categoriesById = new Map((await db.select().from(categories).where(and(eq(categories.type, "expense"), or(eq(categories.userId, userId), isNull(categories.userId))))).map((category) => [category.id, category]));
  const timestamp = new Date().toISOString();
  const current = await db.select().from(budgetCategoryBuckets).where(eq(budgetCategoryBuckets.userId, userId));
  const currentByCategory = new Map(current.map((assignment) => [assignment.categoryId, assignment]));
  const statements: BatchStatement[] = [];
  for (const assignment of assignments) {
    if (!categoriesById.has(assignment.categoryId)) throw new Error("Expense category not found.");
    const existing = currentByCategory.get(assignment.categoryId);
    if (!assignment.bucket) {
      if (existing) statements.push(db.delete(budgetCategoryBuckets).where(eq(budgetCategoryBuckets.id, existing.id)));
    } else if (existing) {
      statements.push(db.update(budgetCategoryBuckets).set({ bucket: assignment.bucket, updatedAt: timestamp }).where(eq(budgetCategoryBuckets.id, existing.id)));
    } else {
      statements.push(db.insert(budgetCategoryBuckets).values({ id: randomUUID(), userId, categoryId: assignment.categoryId, bucket: assignment.bucket, createdAt: timestamp, updatedAt: timestamp }));
    }
  }
  if (statements.length) await executeBatch(statements);
  return getBudgetCategoryBuckets(userId);
}

export async function getBudgetRecommendations(userId: string, period: BudgetPeriod = "monthly", months = 6, today = new Date().toISOString().slice(0, 10)) {
  if (period !== "monthly") throw new Error("Recommendations are available for monthly plans.");
  const count = Math.min(6, Math.max(3, Math.trunc(months)));
  const currentStart = budgetPeriodBounds("monthly", today).start;
  const starts = Array.from({ length: count }, (_, index) => monthStartShift(currentStart, -(count - index)));
  const rangeStart = starts[0];
  const rangeEnd = monthStartShift(currentStart, 0);
  const [rows, categoryRows, assignments] = await Promise.all([
    db.select({ type: transactions.type, amount: transactions.amount, categoryId: transactions.categoryId, splits: transactions.splits, date: transactions.date })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.date, rangeStart), lt(transactions.date, rangeEnd))),
    db.select().from(categories).where(or(eq(categories.userId, userId), isNull(categories.userId))),
    getBudgetCategoryBuckets(userId),
  ]);
  const monthIndex = new Map(starts.map((start, index) => [start.slice(0, 7), index]));
  const byCategory = new Map<string, number[]>(categoryRows.filter((category) => category.type === "expense").map((category) => [category.id, Array(count).fill(0)]));
  const expenseTotals = Array(count).fill(0) as number[];
  const savingsTotals = Array(count).fill(0) as number[];
  for (const row of rows) {
    const index = monthIndex.get(row.date.slice(0, 7));
    if (index === undefined) continue;
    if (row.type === "expense") {
      expenseTotals[index] = addMoney(expenseTotals[index], normalizeMoney(row.amount));
      for (const item of categoryAmounts(row)) {
        const values = byCategory.get(item.categoryId);
        if (values) values[index] = addMoney(values[index], item.amount);
      }
    } else if (row.type === "savings" && row.amount > 0) {
      savingsTotals[index] = addMoney(savingsTotals[index], row.amount);
    }
  }
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.categoryId, assignment.bucket as BudgetCategoryBucket]));
  const categoryMap = new Map(categoryRows.map((category) => [category.id, category]));
  const recommendations: BudgetRecommendation[] = [];
  for (const [categoryId, values] of byCategory) {
    const amount = median(values);
    if (amount <= 0) continue;
    recommendations.push({ categoryId, name: `${categoryMap.get(categoryId)?.name ?? "Category"} budget`, kind: "expense", amount, sampleMonths: count, bucket: assignmentMap.get(categoryId) ?? null });
  }
  return {
    period,
    months: count,
    periodStart: rangeStart,
    periodEnd: monthStartShift(currentStart, -1),
    recommendedOverall: median(expenseTotals),
    recommendedSavings: median(savingsTotals),
    recommendations: recommendations.sort((left, right) => right.amount - left.amount || left.name.localeCompare(right.name)),
  };
}

async function currentPeriodId(userId: string, period: BudgetPeriod, today: string) {
  const bounds = budgetPeriodBounds(period, today);
  const [row] = await db.select({ id: budgetPeriods.id }).from(budgetPeriods).where(and(eq(budgetPeriods.userId, userId), eq(budgetPeriods.recurrence, period), eq(budgetPeriods.periodStart, bounds.start))).limit(1);
  return row?.id ?? null;
}

export async function applyBudgetRecommendations(userId: string, period: BudgetPeriod, today = new Date().toISOString().slice(0, 10)) {
  const recommendations = await getBudgetRecommendations(userId, period, 6, today);
  await listBudgets(userId, period, today);
  const periodId = await currentPeriodId(userId, period, today);
  if (!periodId) throw new Error("Unable to create the budget period.");
  const existing = await db.select().from(budgetAllocations).where(eq(budgetAllocations.periodId, periodId));
  const existingScopes = new Set(existing.map((allocation) => `${allocation.kind}:${allocation.categoryId ?? "overall"}`));
  const timestamp = new Date().toISOString();
  const candidates: BudgetRecommendation[] = [
    { categoryId: null, name: "Overall budget", kind: "expense", amount: recommendations.recommendedOverall, sampleMonths: recommendations.months },
    { categoryId: null, name: "Savings target", kind: "savings", amount: recommendations.recommendedSavings, sampleMonths: recommendations.months },
    ...recommendations.recommendations,
  ];
  const statements: BatchStatement[] = [];
  for (const recommendation of candidates) {
    if (recommendation.amount <= 0) continue;
    const scope = `${recommendation.kind}:${recommendation.categoryId ?? "overall"}`;
    if (existingScopes.has(scope)) continue;
    existingScopes.add(scope);
    const templateId = randomUUID();
    const allocationId = randomUUID();
    statements.push(db.insert(budgetTemplates).values({ id: templateId, userId, categoryId: recommendation.kind === "savings" ? null : recommendation.categoryId, kind: recommendation.kind, name: recommendation.name, recurrence: period, defaultAmount: recommendation.amount, rolloverRule: "none", clientGeneratedId: null, createdAt: timestamp, updatedAt: timestamp }));
    statements.push(db.insert(budgetAllocations).values({ id: allocationId, periodId, templateId, categoryId: recommendation.kind === "savings" ? null : recommendation.categoryId, kind: recommendation.kind, originalAmount: recommendation.amount, adjustedAmount: recommendation.amount, rolloverAmount: 0, createdAt: timestamp, updatedAt: timestamp }));
    if (recommendation.kind === "expense" && recommendation.categoryId === null) statements.push(db.update(budgetPeriods).set({ totalLimit: recommendation.amount, updatedAt: timestamp }).where(eq(budgetPeriods.id, periodId)));
  }
  if (statements.length) await executeBatch(statements);
  return { ...recommendations, budgets: await listBudgets(userId, period, today) };
}

export async function setupFiftyThirtyTwenty(userId: string, totalAmount: number, assignments: Array<{ categoryId: string; bucket: BudgetCategoryBucket }>, today = new Date().toISOString().slice(0, 10)) {
  await saveBudgetCategoryBuckets(userId, assignments);
  const recommendations = await getBudgetRecommendations(userId, "monthly", 6, today);
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.categoryId, assignment.bucket]));
  const recommendationByCategory = new Map(recommendations.recommendations.filter((recommendation) => recommendation.categoryId && assignmentMap.has(recommendation.categoryId)).map((recommendation) => [recommendation.categoryId!, recommendation]));
  const categoryRecommendations = assignments.map((assignment) => recommendationByCategory.get(assignment.categoryId) ?? { categoryId: assignment.categoryId, name: "Category budget", kind: "expense" as const, amount: 0, sampleMonths: recommendations.months, bucket: assignment.bucket });
  const candidates: BudgetRecommendation[] = [
    { categoryId: null, name: "Overall budget", kind: "expense", amount: normalizeMoney(totalAmount * 0.8), sampleMonths: recommendations.months },
    { categoryId: null, name: "Savings target", kind: "savings", amount: normalizeMoney(totalAmount * 0.2), sampleMonths: recommendations.months },
  ];
  for (const bucket of ["needs", "wants"] as const) {
    const target = normalizeMoney(totalAmount * (bucket === "needs" ? 0.5 : 0.3));
    const rows = categoryRecommendations.filter((recommendation) => assignmentMap.get(recommendation.categoryId!) === bucket);
    const historicalTotal = rows.reduce((sum, row) => addMoney(sum, row.amount), 0);
    const fallback = rows.length ? normalizeMoney(target / rows.length) : 0;
    for (const row of rows) candidates.push({ ...row, amount: historicalTotal > 0 ? normalizeMoney(target * row.amount / historicalTotal) : fallback, bucket });
  }
  const applied = await applySpecificBudgetRecommendations(userId, "monthly", candidates, today);
  return { totalAmount: normalizeMoney(totalAmount), needsAmount: normalizeMoney(totalAmount * 0.5), wantsAmount: normalizeMoney(totalAmount * 0.3), savingsAmount: normalizeMoney(totalAmount * 0.2), budgets: applied };
}

async function applySpecificBudgetRecommendations(userId: string, period: BudgetPeriod, candidates: BudgetRecommendation[], today: string) {
  await listBudgets(userId, period, today);
  const periodId = await currentPeriodId(userId, period, today);
  if (!periodId) throw new Error("Unable to create the budget period.");
  const existing = await db.select().from(budgetAllocations).where(eq(budgetAllocations.periodId, periodId));
  const existingScopes = new Set(existing.map((allocation) => `${allocation.kind}:${allocation.categoryId ?? "overall"}`));
  const timestamp = new Date().toISOString();
  const statements: BatchStatement[] = [];
  for (const candidate of candidates) {
    if (candidate.amount <= 0) continue;
    const scope = `${candidate.kind}:${candidate.categoryId ?? "overall"}`;
    if (existingScopes.has(scope)) continue;
    existingScopes.add(scope);
    const templateId = randomUUID();
    statements.push(db.insert(budgetTemplates).values({ id: templateId, userId, categoryId: candidate.kind === "savings" ? null : candidate.categoryId, kind: candidate.kind, name: candidate.name, recurrence: period, defaultAmount: candidate.amount, rolloverRule: "none", clientGeneratedId: null, createdAt: timestamp, updatedAt: timestamp }));
    statements.push(db.insert(budgetAllocations).values({ id: randomUUID(), periodId, templateId, categoryId: candidate.kind === "savings" ? null : candidate.categoryId, kind: candidate.kind, originalAmount: candidate.amount, adjustedAmount: candidate.amount, rolloverAmount: 0, createdAt: timestamp, updatedAt: timestamp }));
    if (candidate.kind === "expense" && candidate.categoryId === null) statements.push(db.update(budgetPeriods).set({ totalLimit: candidate.amount, updatedAt: timestamp }).where(eq(budgetPeriods.id, periodId)));
  }
  if (statements.length) await executeBatch(statements);
  return listBudgets(userId, period, today);
}

export async function getBudgetReview(userId: string, period: BudgetPeriod = "monthly", today = new Date().toISOString().slice(0, 10)): Promise<BudgetReview> {
  const bounds = budgetPeriodBounds(period, today);
  const budgets = await listBudgets(userId, period, today);
  const [transactionsForPeriod, bucketAssignments] = await Promise.all([
    db.select({ type: transactions.type, amount: transactions.amount, categoryId: transactions.categoryId, splits: transactions.splits }).from(transactions).where(and(eq(transactions.userId, userId), gte(transactions.date, bounds.start), lte(transactions.date, bounds.end))),
    getBudgetCategoryBuckets(userId),
  ]);
  const buckets = new Map(bucketAssignments.map((assignment) => [assignment.categoryId, assignment.bucket as BudgetCategoryBucket]));
  const dayCounts = periodDayCounts(bounds.start, bounds.end, today);
  const overall = budgets.find((budget) => budget.kind !== "savings" && !budget.categoryId);
  const savings = budgets.find((budget) => budget.kind === "savings");
  const spent = transactionsForPeriod.reduce((total, row) => row.type === "expense" ? addMoney(total, normalizeMoney(row.amount)) : total, 0);
  const savingsActual = transactionsForPeriod.reduce((total, row) => addMoney(total, budgetSavingsAmount(row)), 0);
  const categoryAllocated = budgets.filter((budget) => budget.kind !== "savings" && budget.categoryId).reduce((total, budget) => addMoney(total, budget.limitAmount), 0);
  const overallPlan = overall?.limitAmount ?? 0;
  const remaining = subtractMoney(overallPlan, spent);
  const projected = projectedSpending(spent, dayCounts.elapsedDays, dayCounts.totalDays);
  const rows: BudgetReviewRow[] = budgets.map((budget) => {
    const isSavings = budget.kind === "savings";
    const projectedAmount = isSavings ? null : projectedSpending(budget.spent, dayCounts.elapsedDays, dayCounts.totalDays);
    const status = budget.percentage >= 100 ? "over" : budget.percentage >= 80 ? "warning" : "on_track";
    return { allocationId: budget.id, categoryId: budget.categoryId, name: budget.name, kind: budget.kind ?? "expense", bucket: budget.categoryId ? buckets.get(budget.categoryId) ?? null : null, planned: budget.limitAmount, spent: isSavings ? savingsActual : budget.spent, variance: subtractMoney(budget.limitAmount, isSavings ? savingsActual : budget.spent), percentage: isSavings ? budget.limitAmount > 0 ? Math.round((savingsActual / budget.limitAmount) * 100) : 0 : budget.percentage, projected: projectedAmount, status };
  });
  return { period, periodStart: bounds.start, periodEnd: bounds.end, ...dayCounts, overallPlan, categoryAllocated, unallocated: subtractMoney(overallPlan, categoryAllocated), spent, remaining, projectedSpending: projected, safeDailySpending: safeDailySpending(remaining, dayCounts.daysRemaining), savingsPlan: savings?.limitAmount ?? 0, savingsActual, rows };
}

export async function listBudgetMoves(userId: string, periodId: string) {
  return db.select().from(budgetMoves).where(and(eq(budgetMoves.userId, userId), eq(budgetMoves.periodId, periodId))).orderBy(desc(budgetMoves.createdAt));
}

function movedAmounts(source: typeof budgetAllocations.$inferSelect, amount: number) {
  const fromRollover = Math.min(source.rolloverAmount, amount);
  return { adjustedAmount: normalizeMoney(source.adjustedAmount - (amount - fromRollover)), rolloverAmount: normalizeMoney(source.rolloverAmount - fromRollover) };
}

export async function moveBudgetMoney(userId: string, input: { fromAllocationId: string; toAllocationId: string; amount: number }) {
  if (input.fromAllocationId === input.toAllocationId) throw new Error("Choose two different categories.");
  const [from] = await db.select({ allocation: budgetAllocations, period: budgetPeriods }).from(budgetAllocations).innerJoin(budgetPeriods, eq(budgetAllocations.periodId, budgetPeriods.id)).where(and(eq(budgetAllocations.id, input.fromAllocationId), eq(budgetPeriods.userId, userId))).limit(1);
  const [to] = await db.select({ allocation: budgetAllocations, period: budgetPeriods }).from(budgetAllocations).innerJoin(budgetPeriods, eq(budgetAllocations.periodId, budgetPeriods.id)).where(and(eq(budgetAllocations.id, input.toAllocationId), eq(budgetPeriods.userId, userId))).limit(1);
  if (!from || !to || from.period.id !== to.period.id || from.allocation.kind !== "expense" || to.allocation.kind !== "expense" || !from.allocation.categoryId || !to.allocation.categoryId) throw new Error("Money can only move between expense categories in the same period.");
  const review = await getBudgetReview(userId, from.period.recurrence, from.period.periodStart);
  const sourceReview = review.rows.find((row) => row.allocationId === from.allocation.id);
  const amount = normalizeMoney(input.amount);
  if (!sourceReview || amount > Math.max(sourceReview.planned - sourceReview.spent, 0)) throw new Error("You can only move unspent money.");
  const sourceNext = movedAmounts(from.allocation, amount);
  const timestamp = new Date().toISOString();
  const statements: BatchStatement[] = [
    db.update(budgetAllocations).set({ adjustedAmount: sourceNext.adjustedAmount, rolloverAmount: sourceNext.rolloverAmount, updatedAt: timestamp }).where(and(eq(budgetAllocations.id, from.allocation.id), eq(budgetAllocations.updatedAt, from.allocation.updatedAt))),
    db.update(budgetAllocations).set({ adjustedAmount: normalizeMoney(to.allocation.adjustedAmount + amount), updatedAt: timestamp }).where(and(eq(budgetAllocations.id, to.allocation.id), eq(budgetAllocations.updatedAt, to.allocation.updatedAt))),
    db.insert(budgetMoves).values({ id: randomUUID(), userId, periodId: from.period.id, fromAllocationId: from.allocation.id, toAllocationId: to.allocation.id, amount, reversalOfId: null, reversedAt: null, createdAt: timestamp }),
  ];
  await executeBatch(statements);
  return { review: await getBudgetReview(userId, from.period.recurrence, from.period.periodStart), moves: await listBudgetMoves(userId, from.period.id) };
}

export async function reverseBudgetMove(userId: string, moveId: string) {
  const [move] = await db.select().from(budgetMoves).where(and(eq(budgetMoves.id, moveId), eq(budgetMoves.userId, userId))).limit(1);
  if (!move) throw new Error("Budget move not found.");
  if (move.reversedAt) throw new Error("This budget move has already been undone.");
  const [source] = await db.select().from(budgetAllocations).where(eq(budgetAllocations.id, move.fromAllocationId)).limit(1);
  const [destination] = await db.select().from(budgetAllocations).where(eq(budgetAllocations.id, move.toAllocationId)).limit(1);
  if (!source || !destination) throw new Error("Budget move allocations are no longer available.");
  const [movePeriod] = await db.select({ recurrence: budgetPeriods.recurrence, periodStart: budgetPeriods.periodStart }).from(budgetPeriods).where(eq(budgetPeriods.id, move.periodId)).limit(1);
  if (!movePeriod) throw new Error("Budget period not found.");
  const review = await getBudgetReview(userId, movePeriod.recurrence, movePeriod.periodStart);
  const destinationReview = review.rows.find((row) => row.allocationId === destination.id);
  if (!destinationReview || move.amount > Math.max(destinationReview.planned - destinationReview.spent, 0)) throw new Error("The moved money has already been spent and cannot be restored.");
  const destinationNext = movedAmounts(destination, move.amount);
  const timestamp = new Date().toISOString();
  const reversalId = randomUUID();
  await executeBatch([
    db.update(budgetAllocations).set({ adjustedAmount: normalizeMoney(source.adjustedAmount + move.amount), updatedAt: timestamp }).where(eq(budgetAllocations.id, source.id)),
    db.update(budgetAllocations).set({ adjustedAmount: destinationNext.adjustedAmount, rolloverAmount: destinationNext.rolloverAmount, updatedAt: timestamp }).where(eq(budgetAllocations.id, destination.id)),
    db.update(budgetMoves).set({ reversedAt: timestamp }).where(and(eq(budgetMoves.id, move.id), isNull(budgetMoves.reversedAt))),
    db.insert(budgetMoves).values({ id: reversalId, userId, periodId: move.periodId, fromAllocationId: move.toAllocationId, toAllocationId: move.fromAllocationId, amount: move.amount, reversalOfId: move.id, reversedAt: null, createdAt: timestamp }),
  ]);
  return { reversalId, moves: await listBudgetMoves(userId, move.periodId) };
}
