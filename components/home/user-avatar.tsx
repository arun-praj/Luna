"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/auth-client";
import { avatarForPreset } from "@/lib/avatar";

const AVATAR_CACHE_KEY = "cocomelon.avatar-preset";

export function UserAvatar({ size = 44 }: { size?: number }) {
  const [avatarPreset, setAvatarPreset] = useState(() => {
    if (typeof window === "undefined") return "sunrise";
    return window.localStorage.getItem(AVATAR_CACHE_KEY) || "sunrise";
  });

  useEffect(() => {
    let active = true;
    void authenticatedFetch("/api/auth/me").then(async (response) => {
      if (!response.ok || !active) return;
      const result = (await response.json()) as {
        user?: { avatarPreset?: string };
      };
      if (result.user?.avatarPreset) {
        setAvatarPreset(result.user.avatarPreset);
        window.localStorage.setItem(AVATAR_CACHE_KEY, result.user.avatarPreset);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Image
      suppressHydrationWarning
      src={avatarForPreset(avatarPreset)}
      alt=""
      width={size}
      height={size}
      unoptimized
      className="size-full rounded-[12px] border border-border bg-primary-soft"
    />
  );
}
