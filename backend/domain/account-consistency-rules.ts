import { addMoney, normalizeMoney } from "../../lib/money.ts";

type AccountLedgerRow = {
  id: string;
  userId: string;
  name: string;
  currentBalance: number;
  openingBalance: number;
};

type TransactionLedgerRow = {
  userId: string;
  accountId: string;
  type: string;
  amount: number;
  transferToAccountId: string | null;
};

export type AccountBalanceMismatch = {
  accountId: string;
  userId: string;
  accountName: string;
  openingBalance: number;
  ledgerDelta: number;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
};

export function transactionAccountDelta(transaction: TransactionLedgerRow, accountId: string) {
  if (transaction.type === "goal_spend") return 0;
  const sourceDelta = transaction.type === "income" || transaction.type === "adjust_balance" ? transaction.amount : -transaction.amount;
  if (transaction.accountId === accountId) return normalizeMoney(sourceDelta);
  if (transaction.transferToAccountId === accountId && (transaction.type === "transfer" || transaction.type === "savings")) return normalizeMoney(-sourceDelta);
  return 0;
}

export function findAccountBalanceMismatches(accountsToCheck: AccountLedgerRow[], ledger: TransactionLedgerRow[], tolerance = 0.005) {
  const ledgerByAccount = new Map<string, number>();
  for (const transaction of ledger) {
    const accountIds = [transaction.accountId, transaction.transferToAccountId].filter((value): value is string => Boolean(value));
    for (const accountId of accountIds) {
      const delta = transactionAccountDelta(transaction, accountId);
      if (delta !== 0) ledgerByAccount.set(accountId, addMoney(ledgerByAccount.get(accountId) ?? 0, delta));
    }
  }
  return accountsToCheck.flatMap((account) => {
    const openingBalance = normalizeMoney(account.openingBalance);
    const ledgerDelta = normalizeMoney(ledgerByAccount.get(account.id) ?? 0);
    const expectedBalance = addMoney(openingBalance, ledgerDelta);
    const actualBalance = normalizeMoney(account.currentBalance);
    const difference = normalizeMoney(actualBalance - expectedBalance);
    return Math.abs(difference) > tolerance ? [{ accountId: account.id, userId: account.userId, accountName: account.name, openingBalance, ledgerDelta, expectedBalance, actualBalance, difference }] : [];
  });
}
