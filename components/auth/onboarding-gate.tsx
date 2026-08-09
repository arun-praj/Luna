"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch, getAccessTokenSubject, loginPathFor } from "@/lib/auth-client";
import { LunaLoader } from "@/components/ui/luna-loader";

let onboardingCheckUserId: string | null = null;

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "error">(() => {
    if (typeof window === "undefined") return "checking";
    return onboardingCheckUserId && onboardingCheckUserId === getAccessTokenSubject() ? "ready" : "checking";
  });

  useEffect(() => {
    let active = true;
    const handleAuthChanged = () => {
      const userId = getAccessTokenSubject();
      if (!userId || userId !== onboardingCheckUserId) onboardingCheckUserId = null;
    };
    window.addEventListener("cocomelon:auth-changed", handleAuthChanged);
    void authenticatedFetch("/api/auth/me").then(async (response) => {
      if (!response.ok) {
        if (active) router.replace(loginPathFor());
        return;
      }
      const result = (await response.json()) as {
        user: { onboardingCompleted: boolean; emailVerifiedAt?: string | null };
      };
      if (!result.user.emailVerifiedAt) {
        router.replace("/verify-email?next=/");
        return;
      }
      if (!result.user.onboardingCompleted) {
        router.replace("/onboarding");
        return;
      }
      onboardingCheckUserId = getAccessTokenSubject();
      if (active) setStatus("ready");
    }).catch(() => {
      if (active) setStatus("error");
    });
    return () => {
      active = false;
      window.removeEventListener("cocomelon:auth-changed", handleAuthChanged);
    };
  }, [router]);

  if (status === "checking") {
    return <LunaLoader />;
  }

  if (status === "error") {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-5 text-center">
        <section aria-labelledby="home-load-error" className="max-w-sm">
          <h1 id="home-load-error" className="text-lg font-semibold">Luna could not connect</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Check your connection, then try loading your budget again.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 min-h-11 rounded-[12px] bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">Try again</button>
        </section>
      </main>
    );
  }

  return <div className="min-h-dvh">{children}</div>;
}
