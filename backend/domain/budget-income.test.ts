import assert from "node:assert/strict";
import test from "node:test";

import { actualIncomeByCategory, incomeSummaryForSources } from "../../lib/budget-income.ts";
import { monthlyIncomeEstimate } from "../../lib/budgets.ts";

test("income estimates normalize each supported recurring interval to a month", () => {
  assert.equal(monthlyIncomeEstimate(60000, "monthly"), 60000);
  assert.equal(monthlyIncomeEstimate(35000, "biweekly"), 75833.33);
  assert.equal(monthlyIncomeEstimate(10000, "weekly"), 43333.33);
  assert.equal(monthlyIncomeEstimate(90000, "twice_monthly"), 180000);
  assert.equal(monthlyIncomeEstimate(120000, "quarterly"), 40000);
  assert.equal(monthlyIncomeEstimate(1200000, "yearly"), 100000);
});

test("actual income is grouped by category while retaining unmatched income", () => {
  const actual = actualIncomeByCategory([
    { amount: 60000, categoryId: "salary" },
    { amount: 25000, categoryId: "freelance" },
    { amount: 5000, categoryId: null },
  ]);
  assert.equal(actual.total, 90000);
  assert.equal(actual.byCategory.get("salary"), 60000);
  assert.equal(actual.byCategory.get("freelance"), 25000);

  const summary = incomeSummaryForSources([
    { id: "1", name: "Salary", amount: 60000, interval: "monthly", categoryId: "salary", categoryName: "Salary" },
    { id: "2", name: "Freelance", amount: 35000, interval: "biweekly", categoryId: "freelance", categoryName: "Freelancing" },
  ], actual);
  assert.equal(summary.actualThisMonth, 90000);
  assert.equal(summary.matchedActualThisMonth, 85000);
  assert.equal(summary.unmatchedActualThisMonth, 5000);
  assert.equal(summary.sources[0].actualThisMonth, 60000);
  assert.equal(summary.sources[1].actualThisMonth, 25000);
});

test("income summary handles an empty month without turning estimates into actuals", () => {
  const summary = incomeSummaryForSources([
    { id: "1", name: "Salary", amount: 60000, interval: "monthly", categoryId: "salary", categoryName: "Salary" },
  ], { total: 0, byCategory: new Map() });
  assert.equal(summary.estimatedMonthly, 60000);
  assert.equal(summary.actualThisMonth, 0);
  assert.equal(summary.sources[0].actualThisMonth, 0);
});
