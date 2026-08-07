"use client";

import {
  addRxPlugin,
  createRxDatabase,
  removeRxDatabase,
  type RxCollection,
  type RxDatabase,
  type RxJsonSchema,
} from "rxdb";
import { RxDBMigrationPlugin } from "rxdb/plugins/migration-schema";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";

import type {
  OfflineAccount,
  OfflineCategory,
  OfflineProfile,
  OfflineSavingsInstrument,
  OfflineTransaction,
} from "@/lib/offline/types";

export const ACTIVE_OFFLINE_USER_KEY = "cocomelon.offline-active-user";
export const OFFLINE_DATA_CHANGED_EVENT = "cocomelon:offline-data-changed";
const OFFLINE_DATABASE_NAME = "cocomelon_offline_v1";

type OfflineCollections = {
  profiles: RxCollection<OfflineProfile>;
  accounts: RxCollection<OfflineAccount>;
  categories: RxCollection<OfflineCategory>;
  savingsInstruments: RxCollection<OfflineSavingsInstrument>;
  transactions: RxCollection<OfflineTransaction>;
};

export type CocomelonOfflineDatabase = RxDatabase<OfflineCollections>;

addRxPlugin(RxDBMigrationPlugin);

const nullableString = { type: ["string", "null"] } as const;
const boundedNullableString = {
  type: ["string", "null"],
  maxLength: 500,
} as const;

const profileSchema: RxJsonSchema<OfflineProfile> = {
  title: "offline profile",
  version: 0,
  primaryKey: "id",
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", maxLength: 100 },
    userId: { type: "string", maxLength: 100 },
    name: { type: "string", maxLength: 160 },
    email: { type: "string", maxLength: 320 },
    currency: { type: "string", maxLength: 3 },
    avatarPreset: { type: "string", maxLength: 240 },
    cachedAt: { type: "string", maxLength: 40 },
  },
  required: ["id", "userId", "name", "email", "currency", "avatarPreset", "cachedAt"],
};

const accountSchema: RxJsonSchema<OfflineAccount> = {
  title: "offline account",
  version: 0,
  primaryKey: "id",
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", maxLength: 220 },
    serverId: { type: "string", maxLength: 100 },
    userId: { type: "string", maxLength: 100 },
    name: { type: "string", maxLength: 160 },
    type: { type: "string", maxLength: 40 },
    currency: { type: "string", maxLength: 3 },
    currentBalance: { type: "number" },
    isDefault: { type: "boolean" },
    displayOrder: { type: "number", minimum: 0, maximum: 10000, multipleOf: 1 },
    backgroundColor: boundedNullableString,
    icon: boundedNullableString,
    includeInTotalBalance: { type: "boolean" },
    allowNegativeBalance: { type: "boolean" },
    cachedAt: { type: "string", maxLength: 40 },
  },
  required: [
    "id", "serverId", "userId", "name", "type", "currency",
    "currentBalance", "isDefault", "displayOrder", "backgroundColor", "icon",
    "includeInTotalBalance", "allowNegativeBalance", "cachedAt",
  ],
  indexes: [["userId", "displayOrder"]],
};

const categorySchema: RxJsonSchema<OfflineCategory> = {
  title: "offline category",
  version: 0,
  primaryKey: "id",
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", maxLength: 220 },
    serverId: { type: "string", maxLength: 100 },
    userId: { type: "string", maxLength: 100 },
    name: { type: "string", maxLength: 160 },
    type: { type: "string", enum: ["expense", "income"], maxLength: 10 },
    icon: boundedNullableString,
    color: boundedNullableString,
    cachedAt: { type: "string", maxLength: 40 },
  },
  required: ["id", "serverId", "userId", "name", "type", "icon", "color", "cachedAt"],
  indexes: [["userId", "type"]],
};

const savingsInstrumentSchema: RxJsonSchema<OfflineSavingsInstrument> = {
  title: "offline savings instrument",
  version: 0,
  primaryKey: "id",
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", maxLength: 220 },
    serverId: { type: "string", maxLength: 100 },
    userId: { type: "string", maxLength: 100 },
    name: { type: "string", maxLength: 160 },
    typeName: { type: "string", maxLength: 160 },
    currentBalance: { type: "number" },
    backgroundColor: boundedNullableString,
    icon: boundedNullableString,
    cachedAt: { type: "string", maxLength: 40 },
  },
  required: [
    "id", "serverId", "userId", "name", "typeName", "currentBalance",
    "backgroundColor", "icon", "cachedAt",
  ],
  indexes: ["userId"],
};

const transactionSchema: RxJsonSchema<OfflineTransaction> = {
  title: "offline transaction",
  version: 1,
  primaryKey: "id",
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", maxLength: 220 },
    serverId: { ...nullableString, maxLength: 100 },
    userId: { type: "string", maxLength: 100 },
    accountId: { type: "string", maxLength: 100 },
    type: {
      type: "string",
      enum: ["expense", "income", "savings", "transfer", "adjust_balance", "goal_spend"],
      maxLength: 20,
    },
    amount: { type: "number" },
    categoryId: { ...nullableString, maxLength: 100 },
    title: { type: "string", maxLength: 220 },
    notes: nullableString,
    tags: { type: "array", items: { type: "string", maxLength: 60 }, maxItems: 30 },
    date: { type: "string", maxLength: 10 },
    transactionAt: { type: "string", maxLength: 40 },
    transferToAccountId: { ...nullableString, maxLength: 100 },
    savingsInstrumentId: { ...nullableString, maxLength: 100 },
    clientGeneratedId: { ...nullableString, maxLength: 100 },
    syncStatus: { type: "string", enum: ["synced", "pending", "failed"], maxLength: 10 },
    syncError: nullableString,
    accountName: { type: "string", maxLength: 160 },
    accountType: boundedNullableString,
    accountCurrency: { type: "string", maxLength: 3 },
    accountIcon: boundedNullableString,
    accountColor: boundedNullableString,
    destinationAccountName: boundedNullableString,
    destinationAccountType: boundedNullableString,
    destinationAccountIcon: boundedNullableString,
    destinationAccountColor: boundedNullableString,
    categoryName: boundedNullableString,
    categoryType: boundedNullableString,
    categoryIcon: boundedNullableString,
    categoryColor: boundedNullableString,
    createdAt: { type: "string", maxLength: 40 },
    updatedAt: { type: "string", maxLength: 40 },
  },
  required: [
    "id", "serverId", "userId", "accountId", "type", "amount", "categoryId",
    "title", "notes", "tags", "date", "transactionAt", "transferToAccountId",
    "savingsInstrumentId", "clientGeneratedId", "syncStatus", "syncError",
    "accountName", "accountType", "accountCurrency", "accountIcon", "accountColor",
    "destinationAccountName", "destinationAccountType", "destinationAccountIcon",
    "destinationAccountColor", "categoryName", "categoryType", "categoryIcon",
    "categoryColor", "createdAt", "updatedAt",
  ],
  indexes: [
    ["userId", "transactionAt"],
    ["userId", "syncStatus"],
    ["userId", "date"],
  ],
};

let databasePromise: Promise<CocomelonOfflineDatabase> | null = null;

export function localDocumentId(userId: string, serverId: string) {
  // RxDB document ids must use its storage-safe key alphabet. UUIDs and
  // underscores are portable across Dexie/IndexedDB and future adapters.
  return `${userId}__${serverId}`;
}

export function getActiveOfflineUserId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_OFFLINE_USER_KEY);
}

export function setActiveOfflineUserId(userId: string | null) {
  if (typeof window === "undefined") return;
  if (userId) window.localStorage.setItem(ACTIVE_OFFLINE_USER_KEY, userId);
  else window.localStorage.removeItem(ACTIVE_OFFLINE_USER_KEY);
}

export function notifyOfflineDataChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OFFLINE_DATA_CHANGED_EVENT));
}

export function getOfflineDatabase() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("The offline database is only available in the browser."));
  }
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await createRxDatabase<OfflineCollections>({
        name: OFFLINE_DATABASE_NAME,
        storage: getRxStorageDexie(),
        multiInstance: true,
        eventReduce: true,
      });
      await db.addCollections({
        profiles: { schema: profileSchema },
        accounts: { schema: accountSchema },
        categories: { schema: categorySchema },
        savingsInstruments: { schema: savingsInstrumentSchema },
        transactions: {
          schema: transactionSchema,
          migrationStrategies: {
            1: (document: OfflineTransaction) => document,
          },
        },
      });
      return db;
    })().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

/**
 * Removes every user snapshot and queued offline write from this device.
 * Keep the application shell/service-worker cache intact: it contains no
 * account data and is what allows Luna itself to open while offline.
 */
export async function clearOfflineDatabase() {
  if (typeof window === "undefined") return;

  setActiveOfflineUserId(null);
  const currentDatabase = databasePromise;
  databasePromise = null;

  try {
    if (currentDatabase) {
      const db = await currentDatabase;
      await db.close();
    }
  } catch {
    // A partially initialized database can still be removed from storage below.
  }

  await removeRxDatabase(OFFLINE_DATABASE_NAME, getRxStorageDexie(), true);
  notifyOfflineDataChanged();
}
