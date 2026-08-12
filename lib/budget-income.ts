import { addMoney, normalizeMoney, subtractMoney } from "./money.ts";
import { monthlyIncomeEstimate, type BudgetIncomeSource, type BudgetIncomeSummary } from "./budgets.ts";

export function actualIncomeByCategory(rows: Array<{ amount: number; categoryId: string | null }>) {
  const byCategory = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    const amount = normalizeMoney(Math.max(row.amount, 0));
    total = addMoney(total, amount);
    if (row.categoryId) byCategory.set(row.categoryId, addMoney(byCategory.get(row.categoryId) ?? 0, amount));
  }
  return { total, byCategory };
}

export type IncomeSourceSummaryRow = {
  id: string;
  name: string;
  amount: number;
  interval: BudgetIncomeSource["interval"];
  categoryId: string | null;
  categoryName: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export function incomeSummaryForSources(rows: IncomeSourceSummaryRow[], actual: { total: number; byCategory: Map<string, number> }): BudgetIncomeSummary {
  const sources: BudgetIncomeSource[] = rows.map((source) => ({
    id: source.id,
    name: source.name,
    amount: normalizeMoney(source.amount),
    interval: source.interval,
    categoryId: source.categoryId,
    categoryName: source.categoryName,
    monthlyEstimate: monthlyIncomeEstimate(source.amount, source.interval),
    actualThisMonth: source.categoryId ? actual.byCategory.get(source.categoryId) ?? 0 : 0,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  }));
  const matchedActualThisMonth = rows.reduce((sum, row) => row.categoryId ? addMoney(sum, actual.byCategory.get(row.categoryId) ?? 0) : sum, 0);
  const estimatedMonthly = sources.reduce((sum, source) => addMoney(sum, source.monthlyEstimate), 0);
  return {
    estimatedMonthly,
    actualThisMonth: actual.total,
    matchedActualThisMonth,
    unmatchedActualThisMonth: subtractMoney(actual.total, matchedActualThisMonth),
    sources,
  };
}
