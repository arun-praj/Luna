import assert from "node:assert/strict";
import test from "node:test";

import { transactionReceiptKeyForUser } from "./transaction-receipts.ts";

test("receipt cleanup only resolves an internal receipt owned by the user", () => {
  assert.equal(transactionReceiptKeyForUser("user-1", "/api/uploads/transaction-receipts/user-1/receipt.jpg"), "transaction-receipts/user-1/receipt.jpg");
  assert.equal(transactionReceiptKeyForUser("user-1", "/api/uploads/transaction-receipts/user-2/receipt.jpg"), null);
  assert.equal(transactionReceiptKeyForUser("user-1", "/api/uploads/transaction-receipts/user-1/../other.jpg"), null);
  assert.equal(transactionReceiptKeyForUser("user-1", "https://example.com/receipt.jpg"), null);
});
