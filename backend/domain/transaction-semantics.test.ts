import assert from "node:assert/strict";
import test from "node:test";

import { savingsInstrumentReferenceError, transactionCategoryReferenceError } from "./transaction-semantics.ts";

test("transaction categories must match expense or income semantics", () => {
  assert.equal(transactionCategoryReferenceError("expense", "expense"), null);
  assert.equal(transactionCategoryReferenceError("income", "income"), null);
  assert.equal(transactionCategoryReferenceError("income", "expense"), "Choose an income category for this transaction");
  assert.equal(transactionCategoryReferenceError("savings", "expense"), "Categories can only be linked to expense or income transactions");
});

test("savings instruments are restricted to savings transactions", () => {
  assert.equal(savingsInstrumentReferenceError("savings"), null);
  assert.equal(savingsInstrumentReferenceError("income"), "Savings instruments can only be linked to savings transactions");
  assert.equal(savingsInstrumentReferenceError("expense"), "Savings instruments can only be linked to savings transactions");
});
