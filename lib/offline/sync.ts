"use client";

import { authenticatedFetch } from "@/lib/auth-client";
import {
  getActiveOfflineUserId,
  getOfflineDatabase,
  localDocumentId,
  notifyOfflineDataChanged,
  setActiveOfflineUserId,
} from "@/lib/offline/database";
import type {
  OfflineAccount,
  OfflineCategory,
  OfflineProfile,
  OfflineSavingsInstrument,
  OfflineTransaction,
  OfflineTransactionInput,
} from "@/lib/offline/types";

const NETWORK_STATUS_EVENT = "cocomelon:network-status";
const CONNECTION_TIMEOUT_MS = 5_000;
const SYNC_REQUEST_TIMEOUT_MS = 12_000;

type PublicProfileResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    currency: string;
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

type ServerTransaction = Omit<OfflineTransaction, "id" | "serverId" | "userId" | "syncError"> & {
  id: string;
  userId?: string;
};

type TransactionResponse = { transactions: ServerTransaction[] };

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

export function dispatchNetworkStatus(online: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NETWORK_STATUS_EVENT, { detail: { online } }));
}

export function subscribeToNetworkStatus(listener: (online: boolean) => void) {
  const handler = (event: Event) => {
    listener(Boolean((event as CustomEvent<{ online?: boolean }>).detail?.online));
  };
  window.addEventListener(NETWORK_STATUS_EVENT, handler);
  return () => window.removeEventListener(NETWORK_STATUS_EVENT, handler);
}

export async function checkInternetConnection() {
  if (typeof window === "undefined") {
    dispatchNetworkStatus(false);
    return false;
  }
  // navigator.onLine is only a browser hint and can stay false after a captive
  // portal or network handoff. The same-origin probe is the authoritative check.
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);
  try {
    const response = await fetch(`/api/pwa/connectivity?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    const online = response.ok;
    dispatchNetworkStatus(online);
    return online;
  } catch {
    dispatchNetworkStatus(false);
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
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
  const [profileResponse, accountResponse, categoryResponse, savingsResponse, transactionResponse] =
    await Promise.all([
      syncFetch("/api/auth/me"),
      syncFetch("/api/accounts"),
      syncFetch("/api/categories"),
      syncFetch("/api/savings/instruments"),
      syncFetch(`/api/transactions?${query.toString()}`),
    ]);

  if (!profileResponse.ok) return false;
  if (![accountResponse, categoryResponse, savingsResponse, transactionResponse].every((response) => response.ok)) {
    return false;
  }

  const [{ user }, accountData, categoryData, savingsData, transactionData] = await Promise.all([
    profileResponse.json() as Promise<PublicProfileResponse>,
    accountResponse.json() as Promise<AccountResponse>,
    categoryResponse.json() as Promise<CategoryResponse>,
    savingsResponse.json() as Promise<SavingsResponse>,
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
  const remoteTransactions = transactionData.transactions.map((transaction) =>
    toOfflineTransaction(userId, transaction),
  );

  await Promise.all([
    db.profiles.upsert(profile),
    db.accounts.bulkUpsert(accounts),
    db.categories.bulkUpsert(categories),
    savingsInstruments.length
      ? db.savingsInstruments.bulkUpsert(savingsInstruments)
      : Promise.resolve(),
    remoteTransactions.length
      ? db.transactions.bulkUpsert(remoteTransactions)
      : Promise.resolve(),
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
    amount: input.amount,
    categoryId: input.categoryId ?? null,
    title: input.title.trim(),
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

export async function reconcileOfflineData() {
  const online = await checkInternetConnection();
  if (!online) return false;
  await syncPendingTransactions();
  return refreshOfflineSnapshot();
}
