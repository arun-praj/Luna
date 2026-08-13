import assert from "node:assert/strict";
import test from "node:test";

import { isTransactionReceiptReference } from "./receipt-reference.ts";

test("transaction validation accepts Luna's protected relative receipt path", () => {
  assert.equal(isTransactionReceiptReference("/api/uploads/transaction-receipts/user-1/receipt.jpg"), true);
  assert.equal(isTransactionReceiptReference("https://example.com/receipt.jpg"), false);
  assert.equal(isTransactionReceiptReference("not-a-url"), false);
});
