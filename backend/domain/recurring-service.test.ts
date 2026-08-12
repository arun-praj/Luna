import assert from "node:assert/strict";
import test from "node:test";

import { recurringTemplateShapeIssues, shouldAdvanceRecurringTemplate } from "./recurring-template-rules.ts";

const baseTemplate = {
  accountId: "00000000-0000-4000-8000-000000000001",
  type: "expense" as const,
  amount: 100,
  categoryId: null,
  title: "Rent",
  notes: null,
  frequency: "monthly" as const,
  nextDueDate: "2026-08-15",
  endDate: null,
  approvalRequired: true,
  transferToAccountId: null,
  savingsInstrumentId: null,
  goalId: null,
  isActive: true,
};

test("recurring template shape validation enforces the merged transfer shape", () => {
  assert.deepEqual(recurringTemplateShapeIssues({ ...baseTemplate, type: "transfer" }).map((issue) => issue.path), ["transferToAccountId"]);
});

test("recurring template validation rejects impossible dates and stale movement fields", () => {
  assert.deepEqual(recurringTemplateShapeIssues({ ...baseTemplate, endDate: "2026-08-14" }).map((issue) => issue.path), ["endDate"]);
  assert.deepEqual(recurringTemplateShapeIssues({
    ...baseTemplate,
    transferToAccountId: "00000000-0000-4000-8000-000000000002",
  }).map((issue) => issue.path), ["transferToAccountId"]);
  assert.deepEqual(recurringTemplateShapeIssues({
    ...baseTemplate,
    type: "savings",
    transferToAccountId: "00000000-0000-4000-8000-000000000002",
  }).map((issue) => issue.path), ["transferToAccountId"]);
});

test("recurring schedule advancement never moves backward for an older occurrence", () => {
  assert.equal(shouldAdvanceRecurringTemplate("2026-08-20", "2026-08-15"), false);
  assert.equal(shouldAdvanceRecurringTemplate("2026-08-15", "2026-08-15"), true);
  assert.equal(shouldAdvanceRecurringTemplate("2026-08-10", "2026-08-15"), true);
});
