import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, gte, isNull, lte, or } from "drizzle-orm";

import { db } from "@/backend/db/client";
import { budgetAllocations, budgetIncomeSources, budgetPeriods, budgetTemplates, categories, transactions, users } from "@/backend/db/schema";
import { addMoney, normalizeMoney } from "@/lib/money";
import { actualIncomeByCategory, incomeSummaryForSources } from "@/lib/budget-income";
import { budgetPeriodBounds, monthlyIncomeEstimate, type BudgetIncomeInterval, type BudgetOnboardingStatus } from "@/lib/budgets";

type IncomeSourceInput = {
  name: string;
  amount: number;
  interval: BudgetIncomeInterval;
  categoryId?: string | null;
};

type OnboardingAllocation = {
  categoryId?: string | null;
  kind: "expense" | "savings";
  amount: number;
};

type BatchStatement = Parameters<typeof db.batch>[0][number];

function executeBatch(statements: BatchStatement[]) {
  return db.batch(statements as [BatchStatement, ...BatchStatement[]]);
}

function currentMonth(today = new Date().toISOString().slice(0, 10)) {
  return budgetPeriodBounds("monthly", today);
}

async function getIncomeSources(userId: string) {
  return db.select({ source: budgetIncomeSources, category: categories })
    .from(budgetIncomeSources)
    .leftJoin(categories, eq(budgetIncomeSources.categoryId, categories.id))
    .where(eq(budgetIncomeSources.userId, userId));
}

async function validateIncomeCategories(userId: string, sources: IncomeSourceInput[]) {
  const ids = [...new Set(sources.map((source) => source.categoryId).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return;
  const rows = await db.select({ id: categories.id, type: categories.type, userId: categories.userId })
    .from(categories)
    .where(or(...ids.map((id) => eq(categories.id, id))));
  const valid = new Set(rows.filter((category) => category.type === "income" && (category.userId === null || category.userId === userId)).map((category) => category.id));
  if (valid.size !== ids.length) throw new Error("Choose valid income categories for each mapped source.");
}

async function validateExpenseCategories(userId: string, allocations: OnboardingAllocation[]) {
  const ids = [...new Set(allocations.map((allocation) => allocation.categoryId).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return new Map<string, string>();
  const rows = await db.select({ id: categories.id, name: categories.name, type: categories.type, userId: categories.userId })
    .from(categories)
    .where(or(...ids.map((id) => eq(categories.id, id))));
  const valid = new Map(rows.filter((category) => category.type === "expense" && (category.userId === null || category.userId === userId)).map((category) => [category.id, category.name]));
  if (valid.size !== ids.length) throw new Error("Choose valid expense categories for each allocation.");
  return valid;
}

export async function getBudgetIncomeSummary(userId: string, today = new Date().toISOString().slice(0, 10)) {
  const bounds = currentMonth(today);
  const [sourceRows, actualRows] = await Promise.all([
    getIncomeSources(userId),
    db.select({ amount: transactions.amount, categoryId: transactions.categoryId })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.type, "income"), gte(transactions.date, bounds.start), lte(transactions.date, bounds.end))),
  ]);
  const actual = actualIncomeByCategory(actualRows);
  return incomeSummaryForSources(sourceRows.map(({ source, category }) => ({ ...source, categoryName: category?.name ?? null })), actual);
}

export async function getBudgetOnboardingStatus(userId: string, today = new Date().toISOString().slice(0, 10)): Promise<BudgetOnboardingStatus> {
  const [user, incomeCategories, expenseCategories, income] = await Promise.all([
    db.select({ completed: users.budgetOnboardingCompleted, currency: users.currency }).from(users).where(eq(users.id, userId)).limit(1),
    db.select().from(categories).where(and(eq(categories.type, "income"), or(eq(categories.userId, userId), isNull(categories.userId)))),
    db.select().from(categories).where(and(eq(categories.type, "expense"), or(eq(categories.userId, userId), isNull(categories.userId)))),
    getBudgetIncomeSummary(userId, today),
  ]);
  return {
    completed: Boolean(user[0]?.completed),
    currency: user[0]?.currency ?? "NPR",
    income,
    incomeCategories: incomeCategories.map((category) => ({ id: category.id, name: category.name, icon: category.icon, color: category.color })),
    expenseCategories: expenseCategories.map((category) => ({ id: category.id, name: category.name, icon: category.icon, color: category.color })),
  };
}

export async function replaceBudgetIncomeSources(userId: string, sources: IncomeSourceInput[]) {
  await validateIncomeCategories(userId, sources);
  const timestamp = new Date().toISOString();
  const statements: BatchStatement[] = [db.delete(budgetIncomeSources).where(eq(budgetIncomeSources.userId, userId))];
  for (const source of sources) {
    statements.push(db.insert(budgetIncomeSources).values({
      id: randomUUID(), userId, name: source.name.trim(), amount: normalizeMoney(source.amount), interval: source.interval,
      categoryId: source.categoryId ?? null, createdAt: timestamp, updatedAt: timestamp,
    }));
  }
  await executeBatch(statements);
  return getBudgetIncomeSummary(userId);
}

export async function completeBudgetOnboarding(userId: string, sources: IncomeSourceInput[], allocations: OnboardingAllocation[]) {
  const [user] = await db.select({ completed: users.budgetOnboardingCompleted }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("Authentication required");
  if (user.completed) return { alreadyCompleted: true, status: await getBudgetOnboardingStatus(userId) };
  await validateIncomeCategories(userId, sources);
  const categoryNames = await validateExpenseCategories(userId, allocations);
  const monthlyIncome = sources.reduce((sum, source) => addMoney(sum, monthlyIncomeEstimate(source.amount, source.interval)), 0);
  const bounds = currentMonth();
  const [existingPeriod] = await db.select().from(budgetPeriods).where(and(eq(budgetPeriods.userId, userId), eq(budgetPeriods.recurrence, "monthly"), eq(budgetPeriods.periodStart, bounds.start))).limit(1);
  const [existingTemplate] = await db.select({ id: budgetTemplates.id }).from(budgetTemplates).where(and(eq(budgetTemplates.userId, userId), eq(budgetTemplates.recurrence, "monthly"))).limit(1);
  if (existingTemplate) throw new Error("A monthly budget already exists. Open Budgets to continue planning.");

  const periodId = existingPeriod?.id ?? randomUUID();
  const timestamp = new Date().toISOString();
  const statements: BatchStatement[] = [db.delete(budgetIncomeSources).where(eq(budgetIncomeSources.userId, userId))];
  if (!existingPeriod) {
    statements.push(db.insert(budgetPeriods).values({ id: periodId, userId, recurrence: "monthly", periodStart: bounds.start, periodEnd: bounds.end, totalLimit: monthlyIncome, status: "open", createdAt: timestamp, updatedAt: timestamp }));
  }
  for (const source of sources) {
    statements.push(db.insert(budgetIncomeSources).values({ id: randomUUID(), userId, name: source.name.trim(), amount: normalizeMoney(source.amount), interval: source.interval, categoryId: source.categoryId ?? null, createdAt: timestamp, updatedAt: timestamp }));
  }
  const overallTemplateId = randomUUID();
  statements.push(db.insert(budgetTemplates).values({ id: overallTemplateId, userId, categoryId: null, kind: "expense", name: "Overall budget", recurrence: "monthly", defaultAmount: monthlyIncome, rolloverRule: "none", clientGeneratedId: null, createdAt: timestamp, updatedAt: timestamp }));
  statements.push(db.insert(budgetAllocations).values({ id: randomUUID(), periodId, templateId: overallTemplateId, categoryId: null, kind: "expense", originalAmount: monthlyIncome, adjustedAmount: monthlyIncome, rolloverAmount: 0, createdAt: timestamp, updatedAt: timestamp }));
  for (const allocation of allocations) {
    const categoryId = allocation.kind === "savings" ? null : allocation.categoryId!;
    const templateId = randomUUID();
    const name = allocation.kind === "savings" ? "Savings target" : `${categoryNames.get(allocation.categoryId!) ?? "Category"} budget`;
    statements.push(db.insert(budgetTemplates).values({ id: templateId, userId, categoryId, kind: allocation.kind, name, recurrence: "monthly", defaultAmount: normalizeMoney(allocation.amount), rolloverRule: "none", clientGeneratedId: null, createdAt: timestamp, updatedAt: timestamp }));
    statements.push(db.insert(budgetAllocations).values({ id: randomUUID(), periodId, templateId, categoryId, kind: allocation.kind, originalAmount: normalizeMoney(allocation.amount), adjustedAmount: normalizeMoney(allocation.amount), rolloverAmount: 0, createdAt: timestamp, updatedAt: timestamp }));
  }
  if (existingPeriod) statements.push(db.update(budgetPeriods).set({ totalLimit: monthlyIncome, updatedAt: timestamp }).where(eq(budgetPeriods.id, periodId)));
  statements.push(db.update(users).set({ budgetOnboardingCompleted: true, updatedAt: timestamp }).where(and(eq(users.id, userId), eq(users.budgetOnboardingCompleted, false))));
  await executeBatch(statements);
  return { alreadyCompleted: false, status: await getBudgetOnboardingStatus(userId) };
}
