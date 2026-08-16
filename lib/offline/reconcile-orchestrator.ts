export type ReconciliationOutcome =
  | { ok: true }
  | { ok: false; reason: "offline" | "failed" };

export type ReconciliationOperations = {
  probe: () => Promise<boolean>;
  syncTransactions: () => Promise<unknown>;
  syncBudgets: () => Promise<unknown>;
  refreshSnapshot: () => Promise<boolean>;
};

/**
 * Coordinates reconnect work without allowing online, visibility, timer, and
 * service-worker events to start competing sync requests.
 */
export function createReconciliationCoordinator(operations: ReconciliationOperations) {
  let inFlight: Promise<ReconciliationOutcome> | null = null;

  const reconcile = (): Promise<ReconciliationOutcome> => {
    if (inFlight) return inFlight;

    inFlight = (async (): Promise<ReconciliationOutcome> => {
      try {
        if (!(await operations.probe())) return { ok: false, reason: "offline" };
        await operations.syncTransactions();
        await operations.syncBudgets();
        return (await operations.refreshSnapshot())
          ? { ok: true }
          : { ok: false, reason: "failed" };
      } catch {
        return { ok: false, reason: "failed" };
      }
    })().finally(() => {
      inFlight = null;
    });

    return inFlight;
  };

  return {
    reconcile,
    isRunning: () => inFlight !== null,
  };
}
