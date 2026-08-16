import assert from "node:assert/strict";
import test from "node:test";

import { createReconciliationCoordinator } from "./reconcile-orchestrator.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

test("reconnect waits for sync and snapshot refresh before succeeding", async () => {
  const events: string[] = [];
  const coordinator = createReconciliationCoordinator({
    probe: async () => {
      events.push("probe");
      return true;
    },
    syncTransactions: async () => events.push("transactions"),
    syncBudgets: async () => events.push("budgets"),
    refreshSnapshot: async () => {
      events.push("snapshot");
      return true;
    },
  });

  const result = await coordinator.reconcile();
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(events, ["probe", "transactions", "budgets", "snapshot"]);
});

test("concurrent reconnect triggers share one attempt", async () => {
  const transactions = deferred<void>();
  let transactionCalls = 0;
  const coordinator = createReconciliationCoordinator({
    probe: async () => true,
    syncTransactions: async () => {
      transactionCalls += 1;
      await transactions.promise;
    },
    syncBudgets: async () => undefined,
    refreshSnapshot: async () => true,
  });

  const first = coordinator.reconcile();
  const second = coordinator.reconcile();
  assert.equal(first, second);
  transactions.resolve();
  assert.deepEqual(await Promise.all([first, second]), [{ ok: true }, { ok: true }]);
  assert.equal(transactionCalls, 1);
});

test("a failed attempt remains retryable and never refreshes early", async () => {
  const events: string[] = [];
  let shouldFail = true;
  const coordinator = createReconciliationCoordinator({
    probe: async () => true,
    syncTransactions: async () => {
      events.push("transactions");
      if (shouldFail) throw new Error("transient failure");
    },
    syncBudgets: async () => events.push("budgets"),
    refreshSnapshot: async () => {
      events.push("snapshot");
      return true;
    },
  });

  assert.deepEqual(await coordinator.reconcile(), { ok: false, reason: "failed" });
  assert.deepEqual(events, ["transactions"]);

  shouldFail = false;
  assert.deepEqual(await coordinator.reconcile(), { ok: true });
  assert.deepEqual(events, ["transactions", "transactions", "budgets", "snapshot"]);
});

test("offline probe does not run mutations or snapshot refresh", async () => {
  let mutationCalls = 0;
  const coordinator = createReconciliationCoordinator({
    probe: async () => false,
    syncTransactions: async () => { mutationCalls += 1; },
    syncBudgets: async () => { mutationCalls += 1; },
    refreshSnapshot: async () => { mutationCalls += 1; return true; },
  });

  assert.deepEqual(await coordinator.reconcile(), { ok: false, reason: "offline" });
  assert.equal(mutationCalls, 0);
});
