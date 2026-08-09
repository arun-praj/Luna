import assert from "node:assert/strict";
import test from "node:test";

import {
  addDays,
  budgetAlertThreshold,
  budgetPeriodStart,
  goalTargetWindowDays,
  loanFrequencyWindows,
  previousPaymentAge,
  recurringFrequencyWindows,
  urgencyForDate,
} from "./home-alert-rules.ts";

test("goal target dates use a 14-day window and keep overdue alerts hard urgent", () => {
  assert.equal(goalTargetWindowDays, 14);
  assert.deepEqual(urgencyForDate("2026-08-23", "2026-08-09", goalTargetWindowDays), { hardUrgency: 1, rank: 786 });
  assert.deepEqual(urgencyForDate("2026-08-08", "2026-08-09", goalTargetWindowDays), { hardUrgency: 3, rank: 999 });
});

test("loan and recurring windows remain distinct", () => {
  assert.equal(loanFrequencyWindows.weekly, 3);
  assert.equal(loanFrequencyWindows.monthly, 10);
  assert.equal(loanFrequencyWindows.yearly, 45);
  assert.equal(recurringFrequencyWindows.daily, 1);
  assert.equal(recurringFrequencyWindows.weekly, 2);
  assert.equal(recurringFrequencyWindows.monthly, 7);
  assert.equal(recurringFrequencyWindows.yearly, 30);
});

test("recurring copy preserves the previous payment presentation", () => {
  assert.equal(previousPaymentAge(["2026-07-09", "2026-08-01"], "2026-08-09"), "1 Week ago");
  assert.equal(previousPaymentAge(["2026-07-01"], "2026-08-09"), "1 Month ago");
});

test("budget occurrence keys can use stable fixed period starts", () => {
  assert.equal(budgetPeriodStart("weekly", "2026-08-09"), "2026-08-03");
  assert.equal(budgetPeriodStart("monthly", "2026-08-09"), "2026-08-01");
  assert.equal(budgetPeriodStart("yearly", "2026-08-09"), "2026-01-01");
  assert.equal(addDays("2026-08-23", -14), "2026-08-09");
});

test("budget alerts start at the limit and create a new occurrence when over budget", () => {
  assert.equal(budgetAlertThreshold(89), null);
  assert.equal(budgetAlertThreshold(90), null);
  assert.equal(budgetAlertThreshold(99), null);
  assert.equal(budgetAlertThreshold(100), 100);
  assert.equal(budgetAlertThreshold(140), 100);
});
