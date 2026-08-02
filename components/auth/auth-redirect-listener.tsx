"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loginPathFor, safeReturnPath } from "@/lib/auth-client";

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

  return null;
}
