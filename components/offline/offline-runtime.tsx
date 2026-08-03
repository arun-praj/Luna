"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getActiveOfflineUserId } from "@/lib/offline/database";
import {
  checkInternetConnection,
  reconcileOfflineData,
} from "@/lib/offline/sync";

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

export function OfflineRuntime() {
  const pathname = usePathname();
  const router = useRouter();
  const running = useRef<Promise<boolean> | null>(null);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const checkAndRoute = useCallback(async () => {
    if (running.current) return running.current;
    const task = (async () => {
      const isOfflinePreview =
        process.env.NODE_ENV === "development" &&
        pathnameRef.current === "/offline" &&
        new URLSearchParams(window.location.search).get("preview") === "1";
      if (isOfflinePreview) return false;
      const activeUser = getActiveOfflineUserId();
      if (AUTH_PATHS.has(pathnameRef.current)) return true;

      const online = await checkInternetConnection();
      if (!online) {
        if (activeUser && pathnameRef.current !== "/offline") {
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
        // Connectivity is enough to leave the offline shell. Reconciliation
        // is best-effort and continues in the shared runtime; one failed API
        // request must not trap the user on /offline after the network returns.
        void reconcileOfflineData().catch(() => false);
        router.replace("/");
        router.refresh();
        return true;
      }
      await reconcileOfflineData().catch(() => false);
      return true;
    })().finally(() => {
      running.current = null;
    });
    running.current = task;
    return task;
  }, [router]);

  useEffect(() => {
    router.prefetch("/offline");
    // Let the protected route complete its initial auth/data request before
    // starting the best-effort offline reconciliation work. Running both at
    // the same time can make the first authenticated request contend with a
    // refresh and leave the home widgets waiting until a manual reload.
    const start = window.setTimeout(() => void checkAndRoute(), 1200);
    const handleOnline = () => void checkAndRoute();
    const handleOffline = () => void checkAndRoute();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkAndRoute();
    };
    const handleAuthChange = () => void checkAndRoute();
    const handleWorkerMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "COCOMELON_SYNC_TRANSACTIONS") void checkAndRoute();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("cocomelon:auth-changed", handleAuthChange);
    document.addEventListener("visibilitychange", handleVisibility);
    navigator.serviceWorker?.addEventListener("message", handleWorkerMessage);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkAndRoute();
    }, 20_000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("cocomelon:auth-changed", handleAuthChange);
      document.removeEventListener("visibilitychange", handleVisibility);
      navigator.serviceWorker?.removeEventListener("message", handleWorkerMessage);
    };
  }, [checkAndRoute, router]);

  return null;
}
