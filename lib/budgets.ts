import { addMoney, normalizeMoney, subtractMoney } from "./money.ts";

export type BudgetPeriod = "weekly" | "monthly" | "yearly";
export type BudgetRolloverRule = "none" | "cap" | "uncapped";
export type BudgetAllocationKind = "expense" | "savings";
export type BudgetCategoryBucket = "needs" | "wants";
export type BudgetIncomeInterval = "weekly" | "biweekly" | "twice_monthly" | "monthly" | "quarterly" | "yearly";
export type BudgetCategory = { id: string; name: string; icon: string | null; color: string | null };
export type BudgetProgress = { spent: number; remaining: number; percentage: number; periodStart: string; periodEnd: string };
export type Budget = BudgetProgress & {
  id: string; userId: string; categoryId: string | null; name: string; limitAmount: number;
  period: BudgetPeriod; clientGeneratedId: string | null; createdAt: string; updatedAt: string;
  periodId?: string; periodStatus?: "open" | "closed" | "archived";
  originalAmount?: number; adjustedAmount?: number; rolloverAmount?: number; templateId?: string | null; rolloverRule?: BudgetRolloverRule;
  kind?: BudgetAllocationKind;
  category: BudgetCategory | null;
};

export type BudgetRecommendation = {
  categoryId: string | null;
  name: string;
  kind: BudgetAllocationKind;
  amount: number;
  sampleMonths: number;
  bucket?: BudgetCategoryBucket | null;
};

export type BudgetReviewRow = {
  allocationId: string | null;
  categoryId: string | null;
  name: string;
  kind: BudgetAllocationKind;
  bucket: BudgetCategoryBucket | null;
  planned: number;
  spent: number;
  variance: number;
  percentage: number;
  projected: number | null;
  status: "on_track" | "warning" | "over" | "unavailable";
};

export type BudgetReview = {
  period: BudgetPeriod;
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  elapsedDays: number;
  daysRemaining: number;
  overallPlan: number;
  categoryAllocated: number;
  unallocated: number;
  spent: number;
  remaining: number;
  projectedSpending: number | null;
  safeDailySpending: number | null;
  savingsPlan: number;
  savingsActual: number;
  rows: BudgetReviewRow[];
};

export type BudgetIncomeSource = {
  id: string;
  name: string;
  amount: number;
  interval: BudgetIncomeInterval;
  categoryId: string | null;
  categoryName?: string | null;
  monthlyEstimate: number;
  actualThisMonth: number;
  createdAt?: string;
  updatedAt?: string;
};

export type BudgetIncomeSummary = {
  estimatedMonthly: number;
  actualThisMonth: number;
  matchedActualThisMonth: number;
  unmatchedActualThisMonth: number;
  sources: BudgetIncomeSource[];
};

export type BudgetOnboardingStatus = {
  completed: boolean;
  currency: string;
  income: BudgetIncomeSummary;
  incomeCategories: BudgetCategory[];
  expenseCategories: BudgetCategory[];
};

export const BUDGET_INCOME_INTERVAL_LABELS: Record<BudgetIncomeInterval, string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  twice_monthly: "Twice a month",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export function monthlyIncomeEstimate(amount: number, interval: BudgetIncomeInterval) {
  const factor: Record<BudgetIncomeInterval, number> = {
    weekly: 52 / 12,
    biweekly: 26 / 12,
    twice_monthly: 2,
    monthly: 1,
    quarterly: 1 / 3,
    yearly: 1 / 12,
  };
  return normalizeMoney(amount * factor[interval]);
}

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

export function budgetTransactionAmount(
  transaction: { type: string; amount: number; categoryId: string | null; splits: string },
  categoryId: string | null,
) {
  if (transaction.type !== "expense") return 0;
  if (!categoryId || transaction.categoryId === categoryId) return normalizeMoney(transaction.amount);
  return normalizeMoney(splitAmount(transaction.splits, categoryId));
}

export function budgetSavingsAmount(transaction: { type: string; amount: number }) {
  return transaction.type === "savings" && transaction.amount > 0 ? normalizeMoney(transaction.amount) : 0;
}

export function spentForBudget(rows: Array<{ type: string; amount: number; categoryId: string | null; splits: string }>, categoryId: string | null) {
  return rows.reduce((total, transaction) => addMoney(total, budgetTransactionAmount(transaction, categoryId)), 0);
}

export function withBudgetProgress(limit: number, spent: number) {
  const limitAmount = normalizeMoney(limit);
  const normalizedSpent = normalizeMoney(spent);
  return { limitAmount, spent: normalizedSpent, remaining: subtractMoney(limitAmount, normalizedSpent), percentage: limitAmount > 0 ? Math.round((normalizedSpent / limitAmount) * 100) : 0 };
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return normalizeMoney(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

export function periodDayCounts(periodStart: string, periodEnd: string, today: string) {
  const start = new Date(`${periodStart}T12:00:00Z`);
  const end = new Date(`${periodEnd}T12:00:00Z`);
  const current = new Date(`${today}T12:00:00Z`);
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.round((current.getTime() - start.getTime()) / 86_400_000) + 1));
  const daysRemaining = Math.max(0, totalDays - elapsedDays);
  return { totalDays, elapsedDays, daysRemaining };
}

export function projectedSpending(spent: number, elapsedDays: number, totalDays: number) {
  if (elapsedDays <= 0 || totalDays <= 0 || spent <= 0) return null;
  return normalizeMoney((spent / elapsedDays) * totalDays);
}

export function safeDailySpending(remaining: number, daysRemaining: number) {
  if (daysRemaining <= 0) return null;
  return normalizeMoney(Math.max(remaining, 0) / daysRemaining);
}
