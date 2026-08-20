"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  getAccessTokenSubject,
  isAuthRedirectExemptPath,
  refreshSessionIfNeeded,
} from "@/lib/auth-client";
import {
  notificationPermission,
  reconcileNotificationSubscription,
} from "@/lib/notifications";

export function NotificationRuntime() {
  const pathname = usePathname();
  const reconciliationRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let active = true;

    const reconcile = () => {
      if (reconciliationRef.current) return reconciliationRef.current;
      const task = (async () => {
        if (!active || isAuthRedirectExemptPath(window.location.pathname) || document.visibilityState !== "visible") return;

        let userId = getAccessTokenSubject();
        if (!userId) {
          await refreshSessionIfNeeded();
          userId = getAccessTokenSubject();
        }
        if (!active || !userId || notificationPermission() !== "granted") return;
        await reconcileNotificationSubscription(userId);
      })().catch(() => undefined).finally(() => {
        reconciliationRef.current = null;
      });
      reconciliationRef.current = task;
      return task;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void reconcile();
    };
    const handleAuthChange = () => {
      if (getAccessTokenSubject()) void reconcile();
    };

    window.addEventListener("pageshow", reconcile);
    window.addEventListener("resume", reconcile);
    window.addEventListener("focus", reconcile);
    window.addEventListener("online", reconcile);
    window.addEventListener("cocomelon:auth-changed", handleAuthChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void reconcile();

    return () => {
      active = false;
      window.removeEventListener("pageshow", reconcile);
      window.removeEventListener("resume", reconcile);
      window.removeEventListener("focus", reconcile);
      window.removeEventListener("online", reconcile);
      window.removeEventListener("cocomelon:auth-changed", handleAuthChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname]);

  return null;
}
