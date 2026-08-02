"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch, loginPathFor } from "@/lib/auth-client";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    let active = true;
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
    });
    return () => {
      active = false;
    };
  }, [router]);

  // Render the route shell immediately. Protected data components own their
  // loading skeletons, while this gate continues to handle auth/onboarding
  // redirects in the background.
  return <div className="min-h-dvh">{children}</div>;
}
