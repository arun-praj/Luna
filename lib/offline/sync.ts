"use client";

import { authenticatedFetch } from "@/lib/auth-client";
import {
  checkInternetConnection,
  markOfflineSnapshotRefreshed,
} from "@/lib/offline/connectivity";
import {
  getActiveOfflineUserId,
  getOfflineDatabase,
  localDocumentId,
  notifyOfflineDataChanged,
  setActiveOfflineUserId,
} from "@/lib/offline/database";
import type {
  OfflineAccount,
  OfflineBudget,
  OfflineBudgetMutation,
  OfflineCategory,
  OfflineProfile,
  OfflineLoan,
  OfflineSavingsInstrument,
  OfflineTransaction,
  OfflineTransactionInput,
} from "@/lib/offline/types";
import { budgetPeriodBounds, withBudgetProgress, type Budget, type BudgetPeriod } from "@/lib/budgets";
import { normalizeMoney } from "@/lib/money";

const SYNC_REQUEST_TIMEOUT_MS = 12_000;

export { checkInternetConnection, dispatchNetworkStatus, subscribeToNetworkStatus } from "@/lib/offline/connectivity";

type PublicProfileResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    currency: string;
    hideTotalBalance?: boolean;
    avatarPreset: string;
  };
};

type AccountResponse = {
  accounts: Array<{
    id: string;
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
  }>;
};

type CategoryResponse = {
  categories: Array<{
    id: string;
    name: string;
    type: "expense" | "income";
    icon: string | null;
    color: string | null;
  }>;
};

type SavingsResponse = {
  instruments: Array<{
    id: string;
    name: string;
    typeName?: string;
    currentBalance: number;
    backgroundColor: string | null;
    icon: string | null;
  }>;
};
type LoanResponse = { loans: Array<{ id: string; accountId: string; name: string; counterparty: string | null; direction: "borrowed" | "lent"; currency: string; originalPrincipal: number; outstandingPrincipal: number; nextDueDate: string | null; status: "active" | "paid_off" | "archived" }> };

type ServerTransaction = Omit<OfflineTransaction, "id" | "serverId" | "userId" | "syncError"> & {
  id: string;
  userId?: string;
};

type TransactionResponse = { transactions: ServerTransaction[] };
type BudgetResponse = { budgets: Budget[] };

export type OfflineBudgetInput = {
  categoryId: string | null;
  limitAmount: number;
  period: BudgetPeriod;
};

function toOfflineBudget(userId: string, budget: Budget, cachedAt = new Date().toISOString()): OfflineBudget {
  return {
    ...budget,
    localId: localDocumentId(userId, budget.clientGeneratedId ?? budget.id),
    serverId: budget.id,
    syncStatus: "synced",
    syncError: null,
    deleted: false,
    cachedAt,
  };
}

async function cacheRemoteBudgets(userId: string, budgets: Budget[]) {
  const database = await getOfflineDatabase();
  const cachedAt = new Date().toISOString();
  const remote = budgets.map((budget) => toOfflineBudget(userId, budget, cachedAt));
  await database.budgets.bulkUpsert(remote);
  const pendingIds = new Set((await database.budgetMutations.find({ selector: { userId, status: { $in: ["pending", "failed"] } } }).exec()).map((document) => document.toJSON().budgetId));
  const remoteIds = new Set(budgets.map((budget) => budget.id));
  const cached = await database.budgets.find({ selector: { userId, syncStatus: "synced" } }).exec();
  await Promise.all(cached.filter((document) => {
    const budget = document.toJSON();
    return !remoteIds.has(budget.id) && !pendingIds.has(budget.id);
  }).map((document) => document.remove()));
}

function monthBounds() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const asDate = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  return { from: asDate(from), to: asDate(to) };
}

function toOfflineTransaction(userId: string, transaction: ServerTransaction): OfflineTransaction {
  const clientGeneratedId = transaction.clientGeneratedId ?? null;
  return {
    id: localDocumentId(userId, clientGeneratedId ?? transaction.id),
    serverId: transaction.id,
    userId,
    accountId: transaction.accountId,
    type: transaction.type,
    amount: transaction.amount,
    categoryId: transaction.categoryId ?? null,
    title: transaction.title,
    merchantName: transaction.merchantName ?? null,
    notes: transaction.notes ?? null,
    tags: [...transaction.tags],
    date: transaction.date,
    transactionAt: transaction.transactionAt,
    transferToAccountId: transaction.transferToAccountId ?? null,
    savingsInstrumentId: transaction.savingsInstrumentId ?? null,
    clientGeneratedId,
    syncStatus: "synced",
    syncError: null,
    accountName: transaction.accountName,
    accountType: transaction.accountType ?? null,
    accountCurrency: transaction.accountCurrency,
    accountIcon: transaction.accountIcon ?? null,
    accountColor: transaction.accountColor ?? null,
    destinationAccountName: transaction.destinationAccountName ?? null,
    destinationAccountType: transaction.destinationAccountType ?? null,
    destinationAccountIcon: transaction.destinationAccountIcon ?? null,
    destinationAccountColor: transaction.destinationAccountColor ?? null,
    categoryName: transaction.categoryName ?? null,
    categoryType: transaction.categoryType ?? null,
    categoryIcon: transaction.categoryIcon ?? null,
    categoryColor: transaction.categoryColor ?? null,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

async function syncFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SYNC_REQUEST_TIMEOUT_MS);
  try {
    return await authenticatedFetch(input, { ...init, signal: controller.signal });
  } catch (reason) {
    if (reason instanceof Error && reason.name === "AbortError") {
      throw new Error("The connection timed out while syncing. Try again when it is stable.");
    }
    throw reason;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function refreshOfflineSnapshot() {
  if (typeof window === "undefined") return false;
  const { from, to } = monthBounds();
  const query = new URLSearchParams({ from, to });
  const [profileResponse, accountResponse, categoryResponse, savingsResponse, loanResponse, transactionResponse, ...budgetResponses] =
    await Promise.all([
      syncFetch("/api/auth/me"),
      syncFetch("/api/accounts"),
      syncFetch("/api/categories"),
      syncFetch("/api/savings/instruments"),
      syncFetch("/api/loans"),
      syncFetch(`/api/transactions?${query.toString()}`),
      syncFetch("/api/budgets?period=weekly"),
      syncFetch("/api/budgets?period=monthly"),
      syncFetch("/api/budgets?period=yearly"),
    ]);

  if (!profileResponse.ok) return false;
  if (![accountResponse, categoryResponse, savingsResponse, loanResponse, transactionResponse, ...budgetResponses].every((response) => response.ok)) {
    return false;
  }

  const [{ user }, accountData, categoryData, savingsData, loanData, transactionData] = await Promise.all([
    profileResponse.json() as Promise<PublicProfileResponse>,
    accountResponse.json() as Promise<AccountResponse>,
    categoryResponse.json() as Promise<CategoryResponse>,
    savingsResponse.json() as Promise<SavingsResponse>,
    loanResponse.json() as Promise<LoanResponse>,
    transactionResponse.json() as Promise<TransactionResponse>,
  ]);
  const db = await getOfflineDatabase();
  const cachedAt = new Date().toISOString();
  const userId = user.id;
  const profile: OfflineProfile = {
    id: userId,
    userId,
    name: user.name,
    email: user.email,
    currency: user.currency,
    hideTotalBalance: user.hideTotalBalance === true,
    avatarPreset: user.avatarPreset,
    cachedAt,
  };
  const accounts: OfflineAccount[] = accountData.accounts.map((account) => ({
    id: localDocumentId(userId, account.id),
    serverId: account.id,
    userId,
    name: account.name,
    type: account.type,
    currency: account.currency,
    currentBalance: account.currentBalance,
    isDefault: account.isDefault,
    displayOrder: account.displayOrder,
    backgroundColor: account.backgroundColor ?? null,
    icon: account.icon ?? null,
    includeInTotalBalance: account.includeInTotalBalance,
    allowNegativeBalance: account.allowNegativeBalance,
    cachedAt,
  }));
  const categories: OfflineCategory[] = categoryData.categories.map((category) => ({
    id: localDocumentId(userId, category.id),
    serverId: category.id,
    userId,
    name: category.name,
    type: category.type,
    icon: category.icon ?? null,
    color: category.color ?? null,
    cachedAt,
  }));
  const savingsInstruments: OfflineSavingsInstrument[] = savingsData.instruments.map((instrument) => ({
    id: localDocumentId(userId, instrument.id),
    serverId: instrument.id,
    userId,
    name: instrument.name,
    typeName: instrument.typeName ?? "Savings",
    currentBalance: instrument.currentBalance,
    backgroundColor: instrument.backgroundColor ?? null,
    icon: instrument.icon ?? null,
    cachedAt,
  }));
  const offlineLoans: OfflineLoan[] = loanData.loans.map((loan) => ({ id: localDocumentId(userId, loan.id), serverId: loan.id, userId, accountId: loan.accountId, name: loan.name, counterparty: loan.counterparty, direction: loan.direction, currency: loan.currency, originalPrincipal: loan.originalPrincipal, outstandingPrincipal: loan.outstandingPrincipal, nextDueDate: loan.nextDueDate, status: loan.status, cachedAt }));
  const remoteTransactions = transactionData.transactions.map((transaction) =>
    toOfflineTransaction(userId, transaction),
  );
  const budgetData = await Promise.all(budgetResponses.map((response) => response.json() as Promise<BudgetResponse>));
  const remoteBudgets = budgetData.flatMap((result) => result.budgets);

  await Promise.all([
    db.profiles.upsert(profile),
    db.accounts.bulkUpsert(accounts),
    db.categories.bulkUpsert(categories),
    db.savingsInstruments.bulkUpsert(savingsInstruments),
    db.loans.bulkUpsert(offlineLoans),
    db.transactions.bulkUpsert(remoteTransactions),
    cacheRemoteBudgets(userId, remoteBudgets),
  ]);

  const [cachedAccounts, cachedCategories, cachedSavingsInstruments, cachedLoans] = await Promise.all([
    db.accounts.find({ selector: { userId } }).exec(),
    db.categories.find({ selector: { userId } }).exec(),
    db.savingsInstruments.find({ selector: { userId } }).exec(),
    db.loans.find({ selector: { userId } }).exec(),
  ]);
  const remoteAccountIds = new Set(accounts.map((account) => account.serverId));
  const remoteCategoryIds = new Set(categories.map((category) => category.serverId));
  const remoteSavingsInstrumentIds = new Set(savingsInstruments.map((instrument) => instrument.serverId));
  const remoteLoanIds = new Set(offlineLoans.map((loan) => loan.serverId));
  await Promise.all([
    ...cachedAccounts.filter((document) => !remoteAccountIds.has(document.toJSON().serverId)).map((document) => document.remove()),
    ...cachedCategories.filter((document) => !remoteCategoryIds.has(document.toJSON().serverId)).map((document) => document.remove()),
    ...cachedSavingsInstruments.filter((document) => !remoteSavingsInstrumentIds.has(document.toJSON().serverId)).map((document) => document.remove()),
    ...cachedLoans.filter((document) => !remoteLoanIds.has(document.toJSON().serverId)).map((document) => document.remove()),
  ]);

  const remoteLocalIds = new Set(remoteTransactions.map((transaction) => transaction.id));
  const cachedTransactions = await db.transactions.find({
    selector: { userId, date: { $gte: from, $lte: to }, syncStatus: "synced" },
  }).exec();
  await Promise.all(
    cachedTransactions
      .filter((document) => !remoteLocalIds.has(document.id))
      .map((document) => document.remove()),
  );

  setActiveOfflineUserId(userId);
  markOfflineSnapshotRefreshed();
  notifyOfflineDataChanged();
  return true;
}

export async function queueOfflineTransaction(input: OfflineTransactionInput) {
  const userId = getActiveOfflineUserId();
  if (!userId) throw new Error("Open Luna online once before adding offline transactions.");
  const db = await getOfflineDatabase();
  const [accountDocument, categoryDocument, destinationDocument] = await Promise.all([
    db.accounts.findOne({ selector: { userId, serverId: input.accountId } }).exec(),
    input.categoryId
      ? db.categories.findOne({ selector: { userId, serverId: input.categoryId } }).exec()
      : Promise.resolve(null),
    input.transferToAccountId
      ? db.accounts.findOne({ selector: { userId, serverId: input.transferToAccountId } }).exec()
      : Promise.resolve(null),
  ]);
  if (!accountDocument) throw new Error("Choose an account that is available offline.");
  const account = accountDocument.toJSON();
  const category = categoryDocument?.toJSON() ?? null;
  const destination = destinationDocument?.toJSON() ?? null;
  const clientGeneratedId = window.crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const transaction: OfflineTransaction = {
    id: localDocumentId(userId, clientGeneratedId),
    serverId: null,
    userId,
    accountId: input.accountId,
    type: input.type,
    amount: normalizeMoney(input.amount),
    categoryId: input.categoryId ?? null,
    title: input.title.trim(),
    merchantName: input.merchantName?.trim() || null,
    notes: input.notes?.trim() || null,
    tags: input.tags ?? [],
    date: input.date,
    transactionAt: input.transactionAt,
    transferToAccountId: input.transferToAccountId ?? null,
    savingsInstrumentId: input.savingsInstrumentId ?? null,
    clientGeneratedId,
    syncStatus: "pending",
    syncError: null,
    accountName: account.name,
    accountType: account.type,
    accountCurrency: account.currency,
    accountIcon: account.icon,
    accountColor: account.backgroundColor,
    destinationAccountName: destination?.name ?? null,
    destinationAccountType: destination?.type ?? null,
    destinationAccountIcon: destination?.icon ?? null,
    destinationAccountColor: destination?.backgroundColor ?? null,
    categoryName: category?.name ?? null,
    categoryType: category?.type ?? null,
    categoryIcon: category?.icon ?? null,
    categoryColor: category?.color ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.transactions.insert(transaction);
  notifyOfflineDataChanged();

  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.ready.then((registration) => {
      const backgroundSync = registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      };
      return backgroundSync.sync?.register("cocomelon-sync-transactions");
    }).catch(() => undefined);
  }
  return transaction;
}

function transactionSyncPayload(
  transaction: Readonly<Omit<OfflineTransaction, "tags">> & {
    readonly tags: readonly string[];
  },
) {
  return {
    accountId: transaction.accountId,
    type: transaction.type,
    amount: transaction.amount,
    categoryId: transaction.categoryId,
    title: transaction.title,
    merchantName: transaction.merchantName,
    notes: transaction.notes,
    tags: [...transaction.tags],
    date: transaction.date,
    transactionAt: transaction.transactionAt,
    transferToAccountId: transaction.transferToAccountId,
    savingsInstrumentId: transaction.savingsInstrumentId,
    clientGeneratedId: transaction.clientGeneratedId,
  };
}

export async function syncPendingTransactions() {
  if (typeof window === "undefined") return 0;
  const userId = getActiveOfflineUserId();
  if (!userId) return 0;
  const db = await getOfflineDatabase();
  const pending = await db.transactions.find({
    selector: { userId, syncStatus: { $in: ["pending", "failed"] } },
    sort: [{ transactionAt: "asc" }],
  }).exec();
  let syncedCount = 0;

  for (const document of pending) {
    const transaction = document.toJSON();
    try {
      const response = await syncFetch("/api/transactions/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: [transactionSyncPayload(transaction)] }),
      });
      const result = (await response.json().catch(() => null)) as
        | { transactions?: ServerTransaction[]; error?: string }
        | null;
      if (!response.ok || !result?.transactions?.[0]) {
        await document.incrementalPatch({
          syncStatus: response.status >= 400 && response.status < 500 ? "failed" : "pending",
          syncError: result?.error ?? "Waiting to sync",
          updatedAt: new Date().toISOString(),
        });
        if (response.status === 401) break;
        continue;
      }
      const synced = result.transactions[0];
      await document.incrementalPatch({
        serverId: synced.id,
        syncStatus: "synced",
        syncError: null,
        updatedAt: synced.updatedAt ?? new Date().toISOString(),
      });
      syncedCount += 1;
    } catch {
      await document.incrementalPatch({
        syncStatus: "pending",
        syncError: "Waiting for a stable connection",
        updatedAt: new Date().toISOString(),
      });
      break;
    }
  }

  if (syncedCount) notifyOfflineDataChanged();
  return syncedCount;
}

export async function queueOfflineBudgetCreate(input: OfflineBudgetInput) {
  const userId = getActiveOfflineUserId();
  if (!userId) throw new Error("Open Luna online once before creating an offline budget.");
  const database = await getOfflineDatabase();
  const existing = await database.budgets.findOne({ selector: { userId, period: input.period, categoryId: input.categoryId, deleted: false } }).exec();
  if (existing) return { budget: existing.toJSON(), existing: true };
  const id = window.crypto.randomUUID();
  const mutationId = window.crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const categoryDocument = input.categoryId ? await database.categories.findOne({ selector: { userId, serverId: input.categoryId } }).exec() : null;
  const category = categoryDocument?.toJSON() ?? null;
  const bounds = budgetPeriodBounds(input.period, timestamp.slice(0, 10));
  const progress = withBudgetProgress(input.limitAmount, 0);
  const budget: OfflineBudget = {
    id,
    localId: localDocumentId(userId, id),
    serverId: null,
    userId,
    categoryId: input.categoryId,
    name: category ? `${category.name} budget` : "Overall budget",
    period: input.period,
    clientGeneratedId: mutationId,
    createdAt: timestamp,
    updatedAt: timestamp,
    category: category ? { id: category.serverId, name: category.name, icon: category.icon, color: category.color } : null,
    ...progress,
    periodStart: bounds.start,
    periodEnd: bounds.end,
    syncStatus: "pending",
    syncError: null,
    deleted: false,
    cachedAt: timestamp,
  };
  const mutation: OfflineBudgetMutation = { id: mutationId, userId, budgetId: id, operation: "create", ...input, clientGeneratedId: mutationId, status: "pending", error: null, createdAt: timestamp, updatedAt: timestamp };
  await Promise.all([database.budgets.insert(budget), database.budgetMutations.insert(mutation)]);
  notifyOfflineDataChanged();
  return { budget, existing: false };
}

export async function queueOfflineBudgetUpdate(budgetId: string, input: OfflineBudgetInput) {
  const userId = getActiveOfflineUserId();
  if (!userId) throw new Error("Open Luna online once before editing an offline budget.");
  const database = await getOfflineDatabase();
  const document = await database.budgets.findOne({ selector: { userId, id: budgetId } }).exec();
  if (!document) throw new Error("Budget is not available offline.");
  const current = document.toJSON();
  const categoryDocument = input.categoryId ? await database.categories.findOne({ selector: { userId, serverId: input.categoryId } }).exec() : null;
  const category = categoryDocument?.toJSON() ?? null;
  const timestamp = new Date().toISOString();
  const bounds = budgetPeriodBounds(input.period, timestamp.slice(0, 10));
  const progress = withBudgetProgress(input.limitAmount, current.spent);
  await document.incrementalPatch({
    categoryId: input.categoryId, name: category ? `${category.name} budget` : "Overall budget", category: category ? { id: category.serverId, name: category.name, icon: category.icon, color: category.color } : null,
    period: input.period, ...progress, periodStart: bounds.start, periodEnd: bounds.end, updatedAt: timestamp, syncStatus: "pending", syncError: null,
  });
  const pendingCreate = await database.budgetMutations.findOne({ selector: { userId, budgetId, operation: "create" } }).exec();
  if (pendingCreate) {
    await pendingCreate.incrementalPatch({ ...input, status: "pending", error: null, updatedAt: timestamp });
  } else {
    const mutationId = window.crypto.randomUUID();
    await database.budgetMutations.insert({ id: mutationId, userId, budgetId, operation: "update", ...input, clientGeneratedId: mutationId, status: "pending", error: null, createdAt: timestamp, updatedAt: timestamp });
  }
  notifyOfflineDataChanged();
  return document.toJSON();
}

export async function queueOfflineBudgetDelete(budgetId: string) {
  const userId = getActiveOfflineUserId();
  if (!userId) throw new Error("Open Luna online once before deleting an offline budget.");
  const database = await getOfflineDatabase();
  const document = await database.budgets.findOne({ selector: { userId, id: budgetId } }).exec();
  if (!document) return;
  const pendingCreate = await database.budgetMutations.findOne({ selector: { userId, budgetId, operation: "create" } }).exec();
  if (pendingCreate && !document.toJSON().serverId) {
    await Promise.all([pendingCreate.remove(), document.remove()]);
  } else {
    const current = document.toJSON();
    const timestamp = new Date().toISOString();
    const mutationId = window.crypto.randomUUID();
    await document.incrementalPatch({ deleted: true, syncStatus: "pending", syncError: null, updatedAt: timestamp });
    await database.budgetMutations.insert({ id: mutationId, userId, budgetId: current.serverId ?? current.id, operation: "delete", categoryId: current.categoryId, limitAmount: current.limitAmount, period: current.period, clientGeneratedId: mutationId, status: "pending", error: null, createdAt: timestamp, updatedAt: timestamp });
  }
  notifyOfflineDataChanged();
}

export async function syncPendingBudgets() {
  if (typeof window === "undefined") return 0;
  const userId = getActiveOfflineUserId();
  if (!userId) return 0;
  const database = await getOfflineDatabase();
  const documents = await database.budgetMutations.find({ selector: { userId, status: { $in: ["pending", "failed"] } }, sort: [{ createdAt: "asc" }] }).exec();
  if (!documents.length) return 0;
  const mutations = documents.map((document) => {
    const item = document.toJSON();
    return item.operation === "delete"
      ? { operation: item.operation, mutationId: item.id, budgetId: item.budgetId }
      : { operation: item.operation, mutationId: item.id, budgetId: item.budgetId, input: { categoryId: item.categoryId, limitAmount: item.limitAmount, period: item.period, clientGeneratedId: item.clientGeneratedId, updatedAt: item.updatedAt } };
  });
  const response = await syncFetch("/api/budgets/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mutations }) });
  const result = await response.json().catch(() => null) as { results?: Array<{ mutationId: string; status: "synced" | "failed"; budgetId?: string; error?: string }>; budgets?: Budget[]; error?: string } | null;
  if (!response.ok || !result?.results) throw new Error(result?.error ?? "Unable to sync budgets.");
  let synced = 0;
  for (const document of documents) {
    const mutation = document.toJSON();
    const mutationResult = result.results.find((item) => item.mutationId === document.id);
    if (mutationResult?.status === "synced") {
      await document.remove();
      if (mutation.operation === "delete") {
        const deletedBudget = await database.budgets.findOne({ selector: { userId, id: mutation.budgetId } }).exec()
          ?? await database.budgets.findOne({ selector: { userId, serverId: mutation.budgetId } }).exec();
        await deletedBudget?.remove();
      }
      synced += 1;
    } else {
      await document.incrementalPatch({ status: "failed", error: mutationResult?.error ?? "Budget could not be synced.", updatedAt: new Date().toISOString() });
    }
  }
  if (result.budgets) await cacheRemoteBudgets(userId, result.budgets);
  notifyOfflineDataChanged();
  return synced;
}

export async function reconcileOfflineData() {
  const online = await checkInternetConnection();
  if (!online) return false;
  await syncPendingTransactions();
  await syncPendingBudgets();
  return refreshOfflineSnapshot();
}
