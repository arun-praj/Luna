import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/backend/db/client";
import { accounts, transactions } from "@/backend/db/schema";
import { findAccountBalanceMismatches } from "./account-consistency-rules";

export async function checkAccountBalanceConsistency(userId?: string) {
  const accountRows = userId
    ? await db.select({ id: accounts.id, userId: accounts.userId, name: accounts.name, currentBalance: accounts.currentBalance, openingBalance: accounts.openingBalance }).from(accounts).where(eq(accounts.userId, userId))
    : await db.select({ id: accounts.id, userId: accounts.userId, name: accounts.name, currentBalance: accounts.currentBalance, openingBalance: accounts.openingBalance }).from(accounts);
  const transactionRows = userId
    ? await db.select({ userId: transactions.userId, accountId: transactions.accountId, type: transactions.type, amount: transactions.amount, transferToAccountId: transactions.transferToAccountId }).from(transactions).where(eq(transactions.userId, userId))
    : await db.select({ userId: transactions.userId, accountId: transactions.accountId, type: transactions.type, amount: transactions.amount, transferToAccountId: transactions.transferToAccountId }).from(transactions);
  const mismatches = findAccountBalanceMismatches(accountRows, transactionRows);
  return { checkedAt: new Date().toISOString(), accountsChecked: accountRows.length, transactionsChecked: transactionRows.length, mismatchCount: mismatches.length, ok: mismatches.length === 0, mismatches };
}
