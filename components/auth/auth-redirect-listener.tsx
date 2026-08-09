"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loginPathFor, refreshSessionIfNeeded, safeReturnPath } from "@/lib/auth-client";

export function AuthRedirectListener() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    function handleAuthExpired(event: Event) {
      if (["/login", "/signup", "/forgot-password", "/reset-password", "/terms", "/privacy"].includes(pathname)) return;
      const returnTo = (event as CustomEvent<{ returnTo?: string }>).detail?.returnTo;
      router.replace(loginPathFor(safeReturnPath(returnTo, pathname)));
    }
    window.addEventListener("budget:auth-expired", handleAuthExpired);
    return () => window.removeEventListener("budget:auth-expired", handleAuthExpired);
  }, [pathname, router]);

  useEffect(() => {
    if (["/login", "/signup", "/forgot-password", "/reset-password", "/terms", "/privacy"].includes(pathname)) return;

    const refreshIfNeeded = () => {
      if (document.visibilityState === "visible") void refreshSessionIfNeeded();
    };
    refreshIfNeeded();
    const interval = window.setInterval(refreshIfNeeded, 5 * 60_000);
    document.addEventListener("visibilitychange", refreshIfNeeded);
    window.addEventListener("online", refreshIfNeeded);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfNeeded);
      window.removeEventListener("online", refreshIfNeeded);
    };
  }, [pathname]);

  return null;
}
