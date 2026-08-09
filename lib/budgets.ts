import { addMoney, normalizeMoney, subtractMoney } from "./money.ts";

export type BudgetPeriod = "weekly" | "monthly" | "yearly";
export type BudgetCategory = { id: string; name: string; icon: string | null; color: string | null };
export type BudgetProgress = { spent: number; remaining: number; percentage: number; periodStart: string; periodEnd: string };
export type Budget = BudgetProgress & {
  id: string; userId: string; categoryId: string | null; name: string; limitAmount: number;
  period: BudgetPeriod; clientGeneratedId: string | null; createdAt: string; updatedAt: string;
  category: BudgetCategory | null;
};

export function addBudgetDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function budgetPeriodBounds(period: BudgetPeriod, today: string) {
  let start: string;
  if (period === "yearly") start = `${today.slice(0, 4)}-01-01`;
  else if (period === "monthly") start = `${today.slice(0, 7)}-01`;
  else start = addBudgetDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  if (period === "weekly") return { start, end: addBudgetDays(start, 6) };
  if (period === "monthly") {
    const date = new Date(`${start}T12:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() + 1);
    return { start, end: addBudgetDays(date.toISOString().slice(0, 10), -1) };
  }
  return { start, end: `${start.slice(0, 4)}-12-31` };
}

function splitAmount(raw: string, categoryId: string) {
  try {
    const splits = JSON.parse(raw) as Array<{ categoryId?: string; amount?: number }>;
    return splits.reduce((total, split) => split.categoryId === categoryId ? addMoney(total, Number(split.amount) || 0) : total, 0);
  } catch { return 0; }
}

export function spentForBudget(rows: Array<{ type: string; amount: number; categoryId: string | null; splits: string }>, categoryId: string | null) {
  return rows.reduce((total, transaction) => {
    if (transaction.type !== "expense") return total;
    if (!categoryId) return addMoney(total, transaction.amount);
    if (transaction.categoryId === categoryId) return addMoney(total, transaction.amount);
    return addMoney(total, splitAmount(transaction.splits, categoryId));
  }, 0);
}

export function withBudgetProgress(limit: number, spent: number) {
  const limitAmount = normalizeMoney(limit);
  const normalizedSpent = normalizeMoney(spent);
  return { limitAmount, spent: normalizedSpent, remaining: subtractMoney(limitAmount, normalizedSpent), percentage: limitAmount > 0 ? Math.round((normalizedSpent / limitAmount) * 100) : 0 };
}
