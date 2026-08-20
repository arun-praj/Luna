import assert from "node:assert/strict";
import test from "node:test";

import { clearHomeSnapshots, hasFreshDataChanged, readHomeSnapshot, updateCachedBalancePrivacy, writeHomeSnapshot } from "./home-snapshot-cache.ts";

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
    removeItem(key: string) { values.delete(key); },
    key(index: number) { return [...values.keys()][index] ?? null; },
    get length() { return values.size; },
  };
}

test("home snapshots are scoped by user, surface, and exact query scope", () => {
  const storage = createStorage();
  writeHomeSnapshot("transactions", "user-a", "from=2026-08-01&to=2026-08-31", { transactions: [] }, storage);
  writeHomeSnapshot("transactions", "user-a", "from=2026-07-01&to=2026-07-31", { transactions: ["july"] }, storage);

  assert.deepEqual(readHomeSnapshot("transactions", "user-a", "from=2026-08-01&to=2026-08-31", storage)?.data, { transactions: [] });
  assert.deepEqual(readHomeSnapshot("transactions", "user-a", "from=2026-07-01&to=2026-07-31", storage)?.data, { transactions: ["july"] });
  assert.equal(readHomeSnapshot("transactions", "user-b", "from=2026-08-01&to=2026-08-31", storage), null);
  assert.equal(readHomeSnapshot("monthly-summary", "user-a", "from=2026-08-01&to=2026-08-31", storage), null);
});

test("successful empty results are retained and malformed or old entries are ignored", () => {
  const storage = createStorage();
  writeHomeSnapshot("transactions", "user-a", "all", { transactions: [] }, storage);
  assert.deepEqual(readHomeSnapshot("transactions", "user-a", "all", storage)?.data, { transactions: [] });

  const key = [...storage.values.keys()][0];
  storage.values.set(key, JSON.stringify({ version: 0, userId: "user-a", surface: "transactions", scope: "all", savedAt: Date.now(), data: { transactions: ["old"] } }));
  assert.equal(readHomeSnapshot("transactions", "user-a", "all", storage), null);
  storage.values.set(key, "not json");
  assert.equal(readHomeSnapshot("transactions", "user-a", "all", storage), null);
});

test("privacy updates mask the cached balance without exposing another user's data", () => {
  const storage = createStorage();
  writeHomeSnapshot("balance", "user-a", "default", { accounts: [], hideTotalBalance: false }, storage);
  updateCachedBalancePrivacy("user-a", true, storage);
  assert.equal(readHomeSnapshot<{ hideTotalBalance: boolean }>("balance", "user-a", "default", storage)?.data.hideTotalBalance, true);
  assert.equal(readHomeSnapshot("balance", "user-b", "default", storage), null);
});

test("logout cleanup removes only home snapshots", () => {
  const storage = createStorage();
  writeHomeSnapshot("balance", "user-a", "default", { value: 1 }, storage);
  storage.setItem("unrelated", "keep");
  clearHomeSnapshots(storage);
  assert.equal(readHomeSnapshot("balance", "user-a", "default", storage), null);
  assert.equal(storage.getItem("unrelated"), "keep");
});

test("fresh data change detection ignores the first result and identical refreshes", () => {
  assert.equal(hasFreshDataChanged(null, { value: 1 }), false);
  assert.equal(hasFreshDataChanged({ value: 1 }, { value: 1 }), false);
  assert.equal(hasFreshDataChanged({ value: 1 }, { value: 2 }), true);
});
