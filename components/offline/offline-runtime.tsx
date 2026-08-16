"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { ONLINE_DATA_CHANGED_EVENT } from "@/lib/auth-client";

const AUTH_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/onboarding",
  "/terms",
  "/privacy",
]);
const RETURN_PATH_KEY = "cocomelon.offline-return-path";
const RECONNECT_RETRY_DELAY_MS = 5_000;

type RouteCheckOptions = {
  redirectIfOffline?: boolean;
  forceReconciliation?: boolean;
};

export function OfflineRuntime() {
  const pathname = usePathname();
  const running = useRef<Promise<boolean> | null>(null);
  const backgroundReconciliation = useRef<Promise<boolean> | null>(null);
  const reconciliationTimer = useRef<number | null>(null);
  const reconciliationIdleCallback = useRef<number | null>(null);
  const pathnameRef = useRef(pathname);
  const scheduleReconciliationRef = useRef<(delayMs: number, routeAfterSuccess: boolean) => void>(() => undefined);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const leaveOffline = useCallback(() => {
    const savedPath = window.sessionStorage.getItem(RETURN_PATH_KEY);
    const returnPath = savedPath && savedPath.startsWith("/") && !savedPath.startsWith("//") ? savedPath : "/";
    window.sessionStorage.removeItem(RETURN_PATH_KEY);
    window.location.replace(returnPath);
  }, []);

  const scheduleReconciliation = useCallback((delayMs = 8_000, routeAfterSuccess = false) => {
    if (
      backgroundReconciliation.current ||
      reconciliationTimer.current !== null ||
      reconciliationIdleCallback.current !== null
    ) {
      return;
    }

    const begin = () => {
      reconciliationTimer.current = null;
      const idleWindow = window as Window & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      };
      const reconcile = () => {
        reconciliationTimer.current = null;
        reconciliationIdleCallback.current = null;
        const task = import("@/lib/offline/sync")
          .then(({ reconcileOfflineData }) => reconcileOfflineData())
          .catch(() => false)
          .then((success) => {
            if (success && routeAfterSuccess && pathnameRef.current === "/offline") leaveOffline();
            if (!success) scheduleReconciliationRef.current(RECONNECT_RETRY_DELAY_MS, routeAfterSuccess);
            return success;
          })
          .finally(() => {
            backgroundReconciliation.current = null;
          });
        backgroundReconciliation.current = task;
      };

      if (idleWindow.requestIdleCallback) {
        reconciliationIdleCallback.current = idleWindow.requestIdleCallback(reconcile, { timeout: 10_000 });
      } else {
        reconciliationTimer.current = window.setTimeout(reconcile, 2_000);
      }
    };

    reconciliationTimer.current = window.setTimeout(begin, delayMs);
  }, [leaveOffline]);

  useEffect(() => {
    scheduleReconciliationRef.current = scheduleReconciliation;
  }, [scheduleReconciliation]);

  const checkAndRoute = useCallback(async ({
    redirectIfOffline = true,
    forceReconciliation = false,
  }: RouteCheckOptions = {}) => {
    if (running.current) return running.current;
    const task = (async () => {
      const isOfflinePreview =
        process.env.NODE_ENV === "development" &&
        pathnameRef.current === "/offline" &&
        new URLSearchParams(window.location.search).get("preview") === "1";
      if (isOfflinePreview) return false;
      if (AUTH_PATHS.has(pathnameRef.current)) return true;

      const { checkInternetConnection, offlineSnapshotNeedsRefresh } = await import("@/lib/offline/connectivity");
      const online = await checkInternetConnection();
      if (!online) {
        const { getActiveOfflineUserId } = await import("@/lib/offline/database");
        const activeUser = getActiveOfflineUserId();
        // A mobile browser can briefly fail the probe while its network radio
        // wakes after the screen is turned back on. Do not replace the whole
        // app with the offline shell for that transient failure unless this
        // check was explicitly allowed to change the route.
        if (
          document.visibilityState === "visible" &&
          activeUser &&
          pathnameRef.current !== "/offline" &&
          redirectIfOffline
        ) {
          window.sessionStorage.setItem(
            RETURN_PATH_KEY,
            `${window.location.pathname}${window.location.search}`,
          );
          // Use a document navigation here. An App Router transition needs a
          // fresh RSC response, which is exactly what is unavailable offline;
          // the service worker can satisfy this navigation from its shell cache.
          window.location.replace("/offline");
        }
        return false;
      }

      if (pathnameRef.current === "/offline") {
        // Keep the offline shell mounted until the queued writes have had an
        // opportunity to reach the server and the fresh snapshot is cached.
        // This prevents navigation from aborting the authenticated sync fetch.
        const reconciled = await import("@/lib/offline/sync")
          .then(({ reconcileOfflineData }) => reconcileOfflineData())
          .catch(() => false);
        if (reconciled) leaveOffline();
        else scheduleReconciliation(RECONNECT_RETRY_DELAY_MS, true);
        return reconciled;
      }
      // RxDB remains available for offline writes and reconciliation, but it
      // must not compete with the first protected home-page requests.
      const { hasPendingOfflineChangesHint } = await import("@/lib/offline/database");
      if (forceReconciliation || offlineSnapshotNeedsRefresh() || hasPendingOfflineChangesHint()) {
        scheduleReconciliation(forceReconciliation ? 1_000 : 8_000);
      }
      return true;
    })().finally(() => {
      running.current = null;
    });
    running.current = task;
    return task;
  }, [leaveOffline, scheduleReconciliation]);

  useEffect(() => {
    // Probe connectivity after the first paint. Actual RxDB reconciliation is
    // deferred further and runs during idle time so it cannot delay the home
    // route's initial authenticated requests.
    const start = window.setTimeout(() => void checkAndRoute(), 1200);
    let deferredConnectivityCheck: number | null = null;
    const deferConnectivityCheck = (redirectIfOffline: boolean) => {
      if (deferredConnectivityCheck !== null) {
        window.clearTimeout(deferredConnectivityCheck);
      }
      deferredConnectivityCheck = window.setTimeout(() => {
        deferredConnectivityCheck = null;
        void checkAndRoute({ redirectIfOffline });
      }, 2_000);
    };
    const handleOnline = () => void checkAndRoute({ redirectIfOffline: false });
    const handleOffline = () => {
      // Locking a phone can briefly emit `offline` while the page is hidden.
      // Wait until the page is visible again and give the network radio time
      // to wake before considering an offline navigation.
      if (document.visibilityState === "visible") {
        deferConnectivityCheck(false);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        deferConnectivityCheck(navigator.onLine === false);
      }
    };
    const handleAuthChange = () => void checkAndRoute({ forceReconciliation: true });
    const handleOnlineDataChanged = () => void checkAndRoute({
      redirectIfOffline: false,
      forceReconciliation: true,
    });
    const handleWorkerMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "COCOMELON_SYNC_TRANSACTIONS") void checkAndRoute();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("cocomelon:auth-changed", handleAuthChange);
    window.addEventListener(ONLINE_DATA_CHANGED_EVENT, handleOnlineDataChanged);
    document.addEventListener("visibilitychange", handleVisibility);
    navigator.serviceWorker?.addEventListener("message", handleWorkerMessage);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void checkAndRoute({ redirectIfOffline: navigator.onLine === false });
      }
    }, 20_000);
    return () => {
      window.clearTimeout(start);
      if (deferredConnectivityCheck !== null) {
        window.clearTimeout(deferredConnectivityCheck);
      }
      if (reconciliationTimer.current !== null) {
        window.clearTimeout(reconciliationTimer.current);
        reconciliationTimer.current = null;
      }
      if (reconciliationIdleCallback.current !== null) {
        const idleWindow = window as Window & {
          cancelIdleCallback?: (handle: number) => void;
        };
        idleWindow.cancelIdleCallback?.(reconciliationIdleCallback.current);
        reconciliationIdleCallback.current = null;
      }
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("cocomelon:auth-changed", handleAuthChange);
      window.removeEventListener(ONLINE_DATA_CHANGED_EVENT, handleOnlineDataChanged);
      document.removeEventListener("visibilitychange", handleVisibility);
      navigator.serviceWorker?.removeEventListener("message", handleWorkerMessage);
    };
  }, [checkAndRoute]);

  return null;
}
