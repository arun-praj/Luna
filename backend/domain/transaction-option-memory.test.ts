import test from "node:test";
import assert from "node:assert/strict";
import { getNewTransactionOptionAssociations, getTransactionOptionAssociations } from "./transaction-option-memory.ts";
import { rankTransactionOptions } from "../../lib/transaction-option-memory.ts";

const base = {
  type: "expense" as const,
  accountId: "account-1",
  transferToAccountId: null,
  categoryId: "category-1",
  splits: "[]",
  savingsInstrumentId: null,
};

test("extracts distinct source, destination, direct, and split associations", () => {
  assert.deepEqual(
    getTransactionOptionAssociations({ ...base, type: "transfer", transferToAccountId: "account-2", categoryId: null, splits: JSON.stringify([{ categoryId: "category-2" }, { categoryId: "category-2" }]) }),
    [
      { transactionType: "transfer", optionKind: "account", optionId: "account-1" },
      { transactionType: "transfer", optionKind: "account", optionId: "account-2" },
      { transactionType: "transfer", optionKind: "category", optionId: "category-2" },
    ],
  );
});

test("only counts newly selected options on update and scopes type changes", () => {
  assert.deepEqual(
    getNewTransactionOptionAssociations(base, { ...base, accountId: "account-2", categoryId: "category-2" }),
    [
      { transactionType: "expense", optionKind: "account", optionId: "account-2" },
      { transactionType: "expense", optionKind: "category", optionId: "category-2" },
    ],
  );
  assert.equal(getNewTransactionOptionAssociations(base, { ...base, type: "income" }).length, 2);
});

test("ranks by last use, then stored frequency, then existing order", () => {
  const options = [{ id: "first" }, { id: "second" }, { id: "third" }, { id: "unknown" }];
  assert.deepEqual(rankTransactionOptions(options, [
    { optionId: "second", frequency: 1, lastUsedAt: "2026-08-17T10:00:00.000Z" },
    { optionId: "first", frequency: 99, lastUsedAt: "2026-08-17T09:00:00.000Z" },
    { optionId: "third", frequency: 4, lastUsedAt: "2026-08-17T10:00:00.000Z" },
  ]).map((option) => option.id), ["third", "second", "first", "unknown"]);
});
