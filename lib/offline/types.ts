export type OfflineTransactionType =
  | "expense"
  | "income"
  | "savings"
  | "transfer"
  | "adjust_balance"
  | "goal_spend";

export type OfflineSyncStatus = "synced" | "pending" | "failed";

export type OfflineProfile = {
  id: string;
  userId: string;
  name: string;
  email: string;
  currency: string;
  hideTotalBalance: boolean;
  avatarPreset: string;
  cachedAt: string;
};

export type OfflineAccount = {
  id: string;
  serverId: string;
  userId: string;
  name: string;
  type: string;
  currency: string;
  currentBalance: number;
  isDefault: boolean;
  displayOrder: number;
  backgroundColor: string | null;
  icon: string | null;
  includeInTotalBalance: boolean;
  allowNegativeBalance: boolean;
  cachedAt: string;
};

export type OfflineCategory = {
  id: string;
  serverId: string;
  userId: string;
  name: string;
  type: "expense" | "income";
  icon: string | null;
  color: string | null;
  cachedAt: string;
};

export type OfflineSavingsInstrument = {
  id: string;
  serverId: string;
  userId: string;
  name: string;
  typeName: string;
  currentBalance: number;
  backgroundColor: string | null;
  icon: string | null;
  cachedAt: string;
};

export type OfflineLoan = {
  id: string;
  serverId: string;
  userId: string;
  accountId: string;
  name: string;
  counterparty: string | null;
  direction: "borrowed" | "lent";
  currency: string;
  originalPrincipal: number;
  outstandingPrincipal: number;
  nextDueDate: string | null;
  status: "active" | "paid_off" | "archived";
  cachedAt: string;
};

export type OfflineTransaction = {
  id: string;
  serverId: string | null;
  userId: string;
  accountId: string;
  type: OfflineTransactionType;
  amount: number;
  categoryId: string | null;
  title: string;
  merchantName: string | null;
  notes: string | null;
  tags: string[];
  date: string;
  transactionAt: string;
  transferToAccountId: string | null;
  savingsInstrumentId: string | null;
  clientGeneratedId: string | null;
  syncStatus: OfflineSyncStatus;
  syncError: string | null;
  accountName: string;
  accountType: string | null;
  accountCurrency: string;
  accountIcon: string | null;
  accountColor: string | null;
  destinationAccountName: string | null;
  destinationAccountType: string | null;
  destinationAccountIcon: string | null;
  destinationAccountColor: string | null;
  categoryName: string | null;
  categoryType: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OfflineTransactionInput = {
  accountId: string;
  type: Exclude<OfflineTransactionType, "adjust_balance" | "goal_spend">;
  amount: number;
  categoryId?: string | null;
  title: string;
  merchantName?: string | null;
  notes?: string | null;
  tags?: string[];
  date: string;
  transactionAt: string;
  transferToAccountId?: string | null;
  savingsInstrumentId?: string | null;
};

export type OfflineBudget = Budget & {
  localId: string;
  serverId: string | null;
  syncStatus: OfflineSyncStatus;
  syncError: string | null;
  deleted: boolean;
  cachedAt: string;
};

export type OfflineBudgetMutation = {
  id: string;
  userId: string;
  budgetId: string;
  operation: "create" | "update" | "delete";
  categoryId: string | null;
  limitAmount: number;
  period: BudgetPeriod;
  clientGeneratedId: string;
  status: OfflineSyncStatus;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OfflineSnapshot = {
  profile: OfflineProfile | null;
  accounts: OfflineAccount[];
  categories: OfflineCategory[];
  savingsInstruments: OfflineSavingsInstrument[];
  loans: OfflineLoan[];
  transactions: OfflineTransaction[];
  budgets: OfflineBudget[];
  budgetMutations: OfflineBudgetMutation[];
};
import type { Budget, BudgetPeriod } from "@/lib/budgets";
