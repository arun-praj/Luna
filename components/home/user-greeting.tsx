"use client";

import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/data-skeleton";

export function UserGreeting() {
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void authenticatedFetch("/api/auth/me").then(async (response) => {
      if (!response.ok || !active) return;
      const result = (await response.json()) as { user?: { name?: string } };
      const name = result.user?.name?.trim().split(/\s+/)[0];
      if (name) setFirstName(name);
    });
    return () => {
      active = false;
    };
  }, []);

  return firstName ? (
    <span className="inline-block route-data-reveal">{firstName}</span>
  ) : (
    <Skeleton className="inline-block h-7 w-20 align-middle rounded-md" />
  );
}
