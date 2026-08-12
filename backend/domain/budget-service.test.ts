import assert from "node:assert/strict";
import test from "node:test";

import { budgetPeriodBounds, median, periodDayCounts, projectedSpending, safeDailySpending, spentForBudget } from "../../lib/budgets.ts";

test("budget period bounds use calendar weeks, months, and years", () => {
  assert.deepEqual(budgetPeriodBounds("weekly", "2026-08-09"), { start: "2026-08-03", end: "2026-08-09" });
  assert.deepEqual(budgetPeriodBounds("monthly", "2026-02-14"), { start: "2026-02-01", end: "2026-02-28" });
  assert.deepEqual(budgetPeriodBounds("yearly", "2026-08-09"), { start: "2026-01-01", end: "2026-12-31" });
});

test("overall budgets count expenses once and category budgets include split portions", () => {
  const rows = [
    { type: "expense", amount: 100, categoryId: "food", splits: "[]" },
    { type: "expense", amount: 90, categoryId: null, splits: JSON.stringify([{ categoryId: "food", amount: 40 }, { categoryId: "travel", amount: 50 }]) },
    { type: "income", amount: 200, categoryId: "food", splits: "[]" },
  ];
  assert.equal(spentForBudget(rows, null), 190);
  assert.equal(spentForBudget(rows, "food"), 140);
  assert.equal(spentForBudget(rows, "travel"), 50);
});

test("recommendation and forecast helpers use stable median and capped calendar math", () => {
  assert.equal(median([100, 20, 60, 40]), 50);
  assert.deepEqual(periodDayCounts("2026-08-01", "2026-08-31", "2026-08-17"), { totalDays: 31, elapsedDays: 17, daysRemaining: 14 });
  assert.equal(projectedSpending(500, 17, 31), 911.76);
  assert.equal(safeDailySpending(12500, 14), 892.86);
  assert.equal(projectedSpending(0, 17, 31), null);
  assert.equal(safeDailySpending(-100, 14), 0);
});
