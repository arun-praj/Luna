import assert from "node:assert/strict";
import test from "node:test";

import { mostRecentCategoryId, orderCategoryOptions } from "./category-ordering.ts";

test("category ordering keeps the selected category first", () => {
  const result = orderCategoryOptions([
    { id: "salary", name: "Salary", usageFrequency: 1, lastUsedAt: "2026-08-01T08:00:00.000Z" },
    { id: "gifts", name: "Gifts", usageFrequency: 4, lastUsedAt: "2026-07-01T08:00:00.000Z" },
  ], "salary", "income");

  assert.deepEqual(result.map((category) => category.id), ["salary", "gifts"]);
});

test("category ordering pins one recent category then ranks by active transaction type", () => {
  const result = orderCategoryOptions([
    { id: "food", name: "Food & Drinks", usageFrequency: 9, usageFrequencyByType: { income: 0 }, lastUsedAt: "2026-06-01T08:00:00.000Z" },
    { id: "salary", name: "Salary", usageFrequency: 1, usageFrequencyByType: { income: 1 }, lastUsedAt: "2026-08-01T08:00:00.000Z" },
    { id: "gifts", name: "Gifts", usageFrequency: 4, usageFrequencyByType: { income: 4 }, lastUsedAt: "2026-07-01T08:00:00.000Z" },
  ], null, "income");

  assert.deepEqual(result.map((category) => category.id), ["salary", "gifts", "food"]);
});

test("category ordering exposes the category shown as recently used", () => {
  assert.equal(
    mostRecentCategoryId([
      { id: "food", name: "Food", lastUsedAt: "2026-08-01T08:00:00.000Z" },
      { id: "salary", name: "Salary", lastUsedAt: "2026-08-03T08:00:00.000Z" },
    ]),
    "salary",
  );
  assert.equal(
    mostRecentCategoryId([
      { id: "food", name: "Food", lastUsedAt: "2026-08-03T08:00:00.000Z" },
      { id: "salary", name: "Salary", lastUsedAt: "2026-08-01T08:00:00.000Z" },
    ], "food"),
    "salary",
  );
});

test("same-name API rows render once", () => {
  const result = orderCategoryOptions([
    { id: "freelancing-1", name: "Freelancing", usageFrequency: 1 },
    { id: "freelancing-2", name: "freelancing", usageFrequency: 2 },
    { id: "salary-1", name: "Salary", usageFrequency: 0 },
    { id: "salary-2", name: "salary", usageFrequency: 1 },
  ], null, "income");
  assert.deepEqual(result.map((category) => category.id), ["freelancing-2", "salary-2"]);
});
