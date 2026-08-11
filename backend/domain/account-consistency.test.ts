import assert from "node:assert/strict";
import test from "node:test";

import { findAccountBalanceMismatches } from "./account-consistency-rules.ts";

test("reconciles normal and transfer ledger effects against an opening balance", () => {
  const accounts = [
    { id: "cash", userId: "user", name: "Cash", openingBalance: 100, currentBalance: 30 },
    { id: "bank", userId: "user", name: "Bank", openingBalance: 0, currentBalance: 50 },
  ];
  const transactions = [
    { userId: "user", accountId: "cash", type: "expense" as const, amount: 20, transferToAccountId: null },
    { userId: "user", accountId: "cash", type: "transfer" as const, amount: 50, transferToAccountId: "bank" },
  ];
  assert.deepEqual(findAccountBalanceMismatches(accounts, transactions), []);
});

test("reports material ledger drift", () => {
  const mismatches = findAccountBalanceMismatches(
    [{ id: "cash", userId: "user", name: "Cash", openingBalance: 0, currentBalance: 90 }],
    [{ userId: "user", accountId: "cash", type: "expense", amount: 100, transferToAccountId: null }],
  );
  assert.equal(mismatches[0]?.difference, 190);
});
