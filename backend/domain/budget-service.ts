import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, lte, ne } from "drizzle-orm";

import { db } from "@/backend/db/client";
import { categories, spendingBudgets, transactions } from "@/backend/db/schema";
import { budgetPeriodBounds, spentForBudget, withBudgetProgress, type BudgetPeriod } from "@/lib/budgets";
import { normalizeMoney } from "@/lib/money";

export type BudgetMutationInput = {
  categoryId?: string | null;
  limitAmount: number;
  period: BudgetPeriod;
  clientGeneratedId?: string;
  updatedAt?: string;
};

export class BudgetConflictError extends Error {
  constructor(public readonly budgetId: string) {
    super("A budget already exists for this scope and period.");
  }
}

async function requireExpenseCategory(userId: string, categoryId: string | null) {
  if (!categoryId) return null;
  const [category] = await db.select().from(categories).where(and(eq(categories.id, categoryId), eq(categories.type, "expense"))).limit(1);
  if (!category || (category.userId !== null && category.userId !== userId)) throw new Error("Expense category not found.");
  return category;
}

async function conflictingBudget(userId: string, categoryId: string | null, period: BudgetPeriod, excludingId?: string) {
  const rows = await db.select({ id: spendingBudgets.id, categoryId: spendingBudgets.categoryId })
    .from(spendingBudgets)
    .where(and(eq(spendingBudgets.userId, userId), eq(spendingBudgets.period, period), ...(excludingId ? [ne(spendingBudgets.id, excludingId)] : [])))
    .orderBy(asc(spendingBudgets.id));
  return rows.find((row) => row.categoryId === categoryId) ?? null;
}

export async function listBudgets(userId: string, period: BudgetPeriod, today = new Date().toISOString().slice(0, 10)) {
  const { start, end } = budgetPeriodBounds(period, today);
  const [budgetRows, categoryRows, expenseRows] = await Promise.all([
    db.select().from(spendingBudgets).where(and(eq(spendingBudgets.userId, userId), eq(spendingBudgets.period, period))),
    db.select().from(categories),
    db.select({ type: transactions.type, amount: transactions.amount, categoryId: transactions.categoryId, splits: transactions.splits })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.date, start), lte(transactions.date, end))),
  ]);
  const categoryMap = new Map(categoryRows.filter((category) => category.userId === null || category.userId === userId).map((category) => [category.id, category]));
  return budgetRows.map((budget) => {
    const category = budget.categoryId ? categoryMap.get(budget.categoryId) ?? null : null;
    const spent = spentForBudget(expenseRows, budget.categoryId);
    const progress = withBudgetProgress(budget.limitAmount, spent);
    return {
      ...budget,
      name: budget.categoryId ? `${category?.name ?? "Category"} budget` : "Overall budget",
      ...progress,
      periodStart: start,
      periodEnd: end,
      category: category ? { id: category.id, name: category.name, icon: category.icon, color: category.color } : null,
    };
  }).sort((left, right) => {
    if (!left.categoryId) return -1;
    if (!right.categoryId) return 1;
    return right.percentage - left.percentage || left.name.localeCompare(right.name);
  });
}

export async function createBudget(userId: string, input: BudgetMutationInput) {
  const categoryId = input.categoryId ?? null;
  const category = await requireExpenseCategory(userId, categoryId);
  if (input.clientGeneratedId) {
    const [idempotent] = await db.select().from(spendingBudgets).where(eq(spendingBudgets.clientGeneratedId, input.clientGeneratedId)).limit(1);
    if (idempotent?.userId === userId) return idempotent;
  }
  const conflict = await conflictingBudget(userId, categoryId, input.period);
  if (conflict) throw new BudgetConflictError(conflict.id);
  const timestamp = input.updatedAt ?? new Date().toISOString();
  const id = randomUUID();
  try {
    const [budget] = await db.insert(spendingBudgets).values({
      id,
      userId,
      categoryId,
      name: category ? `${category.name} budget` : "Overall budget",
      limitAmount: normalizeMoney(input.limitAmount),
      period: input.period,
      clientGeneratedId: input.clientGeneratedId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }).returning();
    return budget;
  } catch (error) {
    const racedConflict = await conflictingBudget(userId, categoryId, input.period);
    if (racedConflict) throw new BudgetConflictError(racedConflict.id);
    throw error;
  }
}

export async function updateBudget(userId: string, id: string, input: Partial<BudgetMutationInput>) {
  const [current] = await db.select().from(spendingBudgets).where(and(eq(spendingBudgets.id, id), eq(spendingBudgets.userId, userId))).limit(1);
  if (!current) return null;
  if (input.updatedAt && input.updatedAt <= current.updatedAt) return current;
  const categoryId = input.categoryId === undefined ? current.categoryId : input.categoryId ?? null;
  const period = input.period ?? current.period;
  const category = await requireExpenseCategory(userId, categoryId);
  const conflict = await conflictingBudget(userId, categoryId, period, id);
  if (conflict) throw new BudgetConflictError(conflict.id);
  try {
    const [updated] = await db.update(spendingBudgets).set({
      categoryId,
      name: category ? `${category.name} budget` : "Overall budget",
      limitAmount: input.limitAmount === undefined ? current.limitAmount : normalizeMoney(input.limitAmount),
      period,
      updatedAt: input.updatedAt ?? new Date().toISOString(),
    }).where(and(eq(spendingBudgets.id, id), eq(spendingBudgets.userId, userId))).returning();
    return updated ?? null;
  } catch (error) {
    const racedConflict = await conflictingBudget(userId, categoryId, period, id);
    if (racedConflict) throw new BudgetConflictError(racedConflict.id);
    throw error;
  }
}

export async function deleteBudget(userId: string, id: string) {
  await db.delete(spendingBudgets).where(and(eq(spendingBudgets.id, id), eq(spendingBudgets.userId, userId)));
  return true;
}
