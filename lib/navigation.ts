"use client";

function isInternalPath(value: string | null | undefined) {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/api/"));
}

export function getReturnTo(fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = new URLSearchParams(window.location.search).get("returnTo");
  return isInternalPath(value) ? value! : fallback;
}

export function getCurrentRoute() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

export function withReturnTo(path: string, returnTo: string) {
  const url = new URL(path, "https://budget.local");
  url.searchParams.set("returnTo", returnTo);
  return `${url.pathname}${url.search}${url.hash}`;
}
