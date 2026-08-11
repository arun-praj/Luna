import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, isNull, lte, lt, ne } from "drizzle-orm";

import { db } from "@/backend/db/client";
import { budgetAllocations, budgetPeriods, budgetTemplates, categories, transactions } from "@/backend/db/schema";
import { budgetPeriodBounds, spentForBudget, withBudgetProgress, type BudgetPeriod, type BudgetRolloverRule } from "@/lib/budgets";
import { normalizeMoney } from "@/lib/money";

export type BudgetMutationInput = {
  categoryId?: string | null;
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

function templateScope(userId: string, categoryId: string | null, period: BudgetPeriod) {
  return and(
    eq(budgetTemplates.userId, userId),
    eq(budgetTemplates.recurrence, period),
    categoryId === null ? isNull(budgetTemplates.categoryId) : eq(budgetTemplates.categoryId, categoryId),
  );
}

function allocationScope(periodId: string, categoryId: string | null) {
  return and(
    eq(budgetAllocations.periodId, periodId),
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
    const previousAllocation = previousAllocations.find((allocation) => allocation.templateId === template.id || (allocation.templateId === null && allocation.categoryId === template.categoryId));
    const previousLimit = previousAllocation ? allocationLimit(previousAllocation) : 0;
    const previousSpent = previousAllocation ? spentForBudget(previousExpenses, previousAllocation.categoryId) : 0;
    const unused = normalizeMoney(Math.max(previousLimit - previousSpent, 0));
    const rolloverAmount = template.rolloverRule === "uncapped" ? unused : template.rolloverRule === "cap" ? normalizeMoney(Math.min(unused, template.defaultAmount)) : 0;
    statements.push(db.insert(budgetAllocations).values({
      id: randomUUID(), periodId: budgetPeriod.id, templateId: template.id, categoryId: template.categoryId,
      originalAmount: template.defaultAmount, adjustedAmount: template.defaultAmount, rolloverAmount,
      createdAt: timestamp, updatedAt: timestamp,
    }).onConflictDoNothing());
    if (template.categoryId === null) statements.push(db.update(budgetPeriods).set({ totalLimit: normalizeMoney(template.defaultAmount + rolloverAmount), updatedAt: timestamp }).where(eq(budgetPeriods.id, budgetPeriod.id)));
  }
  if (statements.length) await executeBatch(statements);
}

function allocationLimit(allocation: typeof budgetAllocations.$inferSelect) {
  return normalizeMoney(allocation.adjustedAmount + allocation.rolloverAmount);
}

export async function listBudgets(userId: string, period: BudgetPeriod, today = new Date().toISOString().slice(0, 10)) {
  const { start, end } = budgetPeriodBounds(period, today);
  const currentPeriod = await ensureBudgetPeriod(userId, period, today);
  await materializeTemplates(userId, period, currentPeriod);
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
    const spent = spentForBudget(expenseRows, allocation.categoryId);
    const progress = withBudgetProgress(limitAmount, spent);
    return {
      ...allocation,
      ...budgetPeriod,
      id: allocation.id,
      name: category ? `${category.name} budget` : "Overall budget",
      originalAmount: normalizeMoney(allocation.originalAmount),
      adjustedAmount: normalizeMoney(allocation.adjustedAmount),
      rolloverAmount: normalizeMoney(allocation.rolloverAmount),
      period: budgetPeriod.recurrence,
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

export async function copyPreviousBudgetPeriod(userId: string, period: BudgetPeriod, today = new Date().toISOString().slice(0, 10)) {
  const bounds = budgetPeriodBounds(period, today);
  const target = await ensureBudgetPeriod(userId, period, today);
  const [previous] = await db.select().from(budgetPeriods).where(and(
    eq(budgetPeriods.userId, userId), eq(budgetPeriods.recurrence, period), lt(budgetPeriods.periodStart, bounds.start),
  )).orderBy(desc(budgetPeriods.periodStart)).limit(1);
  if (!previous) return { copied: 0, periodId: target.id };
  const [sourceAllocations, targetAllocations] = await Promise.all([
    db.select().from(budgetAllocations).where(eq(budgetAllocations.periodId, previous.id)),
    db.select({ categoryId: budgetAllocations.categoryId }).from(budgetAllocations).where(eq(budgetAllocations.periodId, target.id)),
  ]);
  const existingScopes = new Set(targetAllocations.map((allocation) => allocation.categoryId ?? "overall"));
  const timestamp = new Date().toISOString();
  const statements: BatchStatement[] = [];
  let copied = 0;
  for (const source of sourceAllocations) {
    const scope = source.categoryId ?? "overall";
    if (existingScopes.has(scope)) continue;
    existingScopes.add(scope);
    copied += 1;
    statements.push(db.insert(budgetAllocations).values({
      id: randomUUID(), periodId: target.id, templateId: source.templateId, categoryId: source.categoryId,
      originalAmount: source.adjustedAmount, adjustedAmount: source.adjustedAmount, rolloverAmount: 0,
      createdAt: timestamp, updatedAt: timestamp,
    }));
    if (source.categoryId === null) statements.push(db.update(budgetPeriods).set({ totalLimit: source.adjustedAmount, updatedAt: timestamp }).where(eq(budgetPeriods.id, target.id)));
  }
  if (statements.length) await executeBatch(statements);
  return { copied, periodId: target.id };
}

export async function createBudget(userId: string, input: BudgetMutationInput): Promise<BudgetMutationResult> {
  const categoryId = input.categoryId ?? null;
  const category = await requireExpenseCategory(userId, categoryId);
  const [idempotent] = input.clientGeneratedId
    ? await db.select().from(budgetTemplates).where(and(eq(budgetTemplates.clientGeneratedId, input.clientGeneratedId), eq(budgetTemplates.userId, userId))).limit(1)
    : [];
  if (idempotent) {
    const period = await ensureBudgetPeriod(userId, input.period, new Date().toISOString().slice(0, 10));
    const [allocation] = await db.select().from(budgetAllocations).where(and(eq(budgetAllocations.periodId, period.id), eq(budgetAllocations.templateId, idempotent.id))).limit(1);
    if (allocation) return { ...allocation, period: period.recurrence, periodId: period.id };
  }
  const [templateConflict] = await db.select({ id: budgetTemplates.id }).from(budgetTemplates).where(templateScope(userId, categoryId, input.period)).limit(1);
  if (templateConflict) {
    const [allocation] = await db.select({ id: budgetAllocations.id }).from(budgetAllocations).innerJoin(budgetPeriods, eq(budgetAllocations.periodId, budgetPeriods.id)).where(and(eq(budgetAllocations.templateId, templateConflict.id), eq(budgetPeriods.userId, userId))).orderBy(asc(budgetAllocations.createdAt)).limit(1);
    throw new BudgetConflictError(allocation?.id ?? templateConflict.id);
  }
  const today = new Date().toISOString().slice(0, 10);
  const period = await ensureBudgetPeriod(userId, input.period, today);
  const [allocationConflict] = await db.select({ id: budgetAllocations.id }).from(budgetAllocations).where(allocationScope(period.id, categoryId)).limit(1);
  if (allocationConflict) throw new BudgetConflictError(allocationConflict.id);
  const timestamp = input.updatedAt ?? new Date().toISOString();
  const templateId = randomUUID();
  const allocationId = randomUUID();
  const amount = normalizeMoney(input.limitAmount);
  const template = { id: templateId, userId, categoryId, name: input.name?.trim() || (category ? `${category.name} budget` : "Overall budget"), recurrence: input.period, defaultAmount: amount, rolloverRule: input.rolloverRule ?? "none", clientGeneratedId: input.clientGeneratedId ?? null, createdAt: timestamp, updatedAt: timestamp };
  const allocation = { id: allocationId, periodId: period.id, templateId, categoryId, originalAmount: amount, adjustedAmount: amount, rolloverAmount: 0, createdAt: timestamp, updatedAt: timestamp };
  const statements: BatchStatement[] = [db.insert(budgetTemplates).values(template), db.insert(budgetAllocations).values(allocation)];
  if (categoryId === null) statements.push(db.update(budgetPeriods).set({ totalLimit: amount, updatedAt: timestamp }).where(eq(budgetPeriods.id, period.id)));
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
  const categoryId = input.categoryId === undefined ? current.categoryId : input.categoryId ?? null;
  const category = await requireExpenseCategory(userId, categoryId);
  const [conflict] = await db.select({ id: budgetAllocations.id }).from(budgetAllocations).where(and(allocationScope(period.id, categoryId), ne(budgetAllocations.id, id))).limit(1);
  if (conflict) throw new BudgetConflictError(conflict.id);
  const timestamp = input.updatedAt ?? new Date().toISOString();
  const amount = input.limitAmount === undefined ? normalizeMoney(current.adjustedAmount) : normalizeMoney(input.limitAmount);
  const allocation = { ...current, categoryId, adjustedAmount: amount, updatedAt: timestamp };
  const template = currentRow.template ? { ...currentRow.template, categoryId, name: input.name?.trim() || (category ? `${category.name} budget` : "Overall budget"), defaultAmount: amount, rolloverRule: input.rolloverRule ?? currentRow.template.rolloverRule, recurrence: period.recurrence, updatedAt: timestamp } : null;
  const statements: BatchStatement[] = [db.update(budgetAllocations).set({ categoryId, adjustedAmount: amount, updatedAt: timestamp }).where(and(eq(budgetAllocations.id, id), eq(budgetAllocations.updatedAt, current.updatedAt)))];
  if (template) statements.push(db.update(budgetTemplates).set({ categoryId: template.categoryId, name: template.name, defaultAmount: template.defaultAmount, rolloverRule: template.rolloverRule, updatedAt: timestamp }).where(eq(budgetTemplates.id, template.id)));
  if (categoryId === null) statements.push(db.update(budgetPeriods).set({ totalLimit: amount, updatedAt: timestamp }).where(eq(budgetPeriods.id, period.id)));
  await executeBatch(statements);
  return { ...allocation, period: period.recurrence, periodId: period.id };
}

export async function deleteBudget(userId: string, id: string) {
  const [current] = await db.select({ allocation: budgetAllocations, period: budgetPeriods, template: budgetTemplates })
    .from(budgetAllocations).innerJoin(budgetPeriods, eq(budgetAllocations.periodId, budgetPeriods.id)).leftJoin(budgetTemplates, eq(budgetAllocations.templateId, budgetTemplates.id))
    .where(and(eq(budgetAllocations.id, id), eq(budgetPeriods.userId, userId))).limit(1);
  if (!current) return false;
  const statements: BatchStatement[] = [db.delete(budgetAllocations).where(eq(budgetAllocations.id, id))];
  if (current.template) statements.push(db.delete(budgetTemplates).where(eq(budgetTemplates.id, current.template.id)));
  if (current.allocation.categoryId === null) statements.push(db.update(budgetPeriods).set({ totalLimit: 0, updatedAt: new Date().toISOString() }).where(eq(budgetPeriods.id, current.period.id)));
  await executeBatch(statements);
  return true;
}
