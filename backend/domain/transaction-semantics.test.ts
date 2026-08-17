import assert from "node:assert/strict";
import test from "node:test";

import { savingsInstrumentReferenceError } from "./transaction-semantics.ts";

test("savings instruments are restricted to savings transactions", () => {
  assert.equal(savingsInstrumentReferenceError("savings"), null);
  assert.equal(savingsInstrumentReferenceError("income"), "Savings instruments can only be linked to savings transactions");
  assert.equal(savingsInstrumentReferenceError("expense"), "Savings instruments can only be linked to savings transactions");
});
