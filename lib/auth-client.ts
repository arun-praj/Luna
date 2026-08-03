"use client";

const ACCESS_TOKEN_KEY = "budget_access_token";
const REFRESH_WINDOW_SECONDS = 60;
const API_CACHE_TTL_MS = 120_000;
const AUTH_REQUEST_TIMEOUT_MS = 15_000;
const API_CACHE_STORAGE_KEY = "cocomelon.api-cache";
let refreshPromise: Promise<string | null> | null = null;

type ApiCacheEntry = {
  data: unknown;
  expiresAt: number;
};

const apiCache = new Map<string, ApiCacheEntry>();
const apiRequests = new Map<string, Promise<Response>>();

const publicAuthPaths = new Set(["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"]);

export function safeReturnPath(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/api/") || publicAuthPaths.has(value.split("?")[0])) return fallback;
  return value;
}

export function loginPathFor(returnTo?: string) {
  const path = safeReturnPath(returnTo ?? (typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`));
  return `/login?next=${encodeURIComponent(path)}`;
}

export function notifyAuthExpired() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("budget:auth-expired", { detail: { returnTo: `${window.location.pathname}${window.location.search}` } }));
}

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getAccessTokenSubject() {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(
      window.atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  window.dispatchEvent(new CustomEvent("cocomelon:auth-changed"));
}

function readPersistedCache() {
  if (apiCache.size || typeof window === "undefined") return;
  try {
    const persisted = JSON.parse(
      window.sessionStorage.getItem(API_CACHE_STORAGE_KEY) ?? "null",
    ) as Record<string, ApiCacheEntry> | null;
    if (!persisted) return;
    for (const [key, entry] of Object.entries(persisted)) {
      if (entry.expiresAt > Date.now()) apiCache.set(key, entry);
    }
  } catch {
    window.sessionStorage.removeItem(API_CACHE_STORAGE_KEY);
  }
}

function persistCache() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      API_CACHE_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(apiCache)),
    );
  } catch {
    // Caching is an optimization; private browsing storage may be unavailable.
  }
}

export function clearApiCache() {
  apiCache.clear();
  if (typeof window !== "undefined")
    window.sessionStorage.removeItem(API_CACHE_STORAGE_KEY);
}

export function notifyTransactionsChanged() {
  clearApiCache();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cocomelon:transactions-changed"));
  }
}

export function clearAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  clearApiCache();
  window.dispatchEvent(new CustomEvent("cocomelon:auth-changed"));
}

function tokenExpiresSoon(token: string | null) {
  if (!token) return true;
  try {
    const payload = JSON.parse(
      window.atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };
    return (
      !payload.exp ||
      payload.exp <= Math.floor(Date.now() / 1000) + REFRESH_WINDOW_SECONDS
    );
  } catch {
    return true;
  }
}

async function performRefresh(signal?: AbortSignal) {
  const refresh = await fetch("/api/auth/refresh", { method: "POST", signal });
  if (!refresh.ok) {
    clearAccessToken();
    return null;
  }
  const session = (await refresh.json()) as { accessToken?: string };
  if (!session.accessToken) {
    clearAccessToken();
    return null;
  }
  setAccessToken(session.accessToken);
  return session.accessToken;
}

async function refreshAccessToken(signal?: AbortSignal) {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshWithTabLock = async () => {
      if ("locks" in navigator && navigator.locks?.request) {
        const refreshUnderLock = async () => {
          const latestToken = getAccessToken();
          return tokenExpiresSoon(latestToken) ? performRefresh(signal) : latestToken;
        };
        return signal
          ? navigator.locks.request("budget-auth-refresh", { signal }, refreshUnderLock)
          : navigator.locks.request("budget-auth-refresh", refreshUnderLock);
      }
      return performRefresh(signal);
    };
    return refreshWithTabLock();
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const method = (
    init.method ??
    (typeof input === "string"
      ? "GET"
      : input instanceof Request
        ? input.method
        : "GET")
  ).toUpperCase();
  const cacheKey =
    method === "GET"
      ? new URL(
          input instanceof Request ? input.url : input.toString(),
          window.location.origin,
        ).toString()
      : null;
  if (cacheKey) {
    readPersistedCache();
    const cached = apiCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      if (!apiRequests.has(cacheKey))
        void startApiRequest(input, init, cacheKey).catch(() => undefined);
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const pending = apiRequests.get(cacheKey);
    if (pending) return pending.then((response) => response.clone());
    return startApiRequest(input, init, cacheKey);
  }

  clearApiCache();
  return fetchWithAuth(input, init);
}

function startApiRequest(
  input: RequestInfo | URL,
  init: RequestInit,
  cacheKey: string,
) {
  const request = fetchAndCache(input, init, cacheKey);
  const trackedRequest = request.finally(() => {
    if (apiRequests.get(cacheKey) === trackedRequest)
      apiRequests.delete(cacheKey);
  });
  apiRequests.set(cacheKey, trackedRequest);
  return trackedRequest;
}

async function fetchAndCache(
  input: RequestInfo | URL,
  init: RequestInit,
  cacheKey: string,
) {
  const response = await fetchWithAuth(input, init);
  if (response.status === 401) {
    clearAccessToken();
  }
  if (!response.ok) return response;
  try {
    const data = (await response.clone().json()) as unknown;
    apiCache.set(cacheKey, { data, expiresAt: Date.now() + API_CACHE_TTL_MS });
    persistCache();
  } catch {
    // Some successful GET endpoints may return an empty or non-JSON response.
  }
  return response;
}

async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  const requestController = init.signal ? null : new AbortController();
  const requestSignal = init.signal ?? requestController?.signal;
  const timeout = requestController
    ? window.setTimeout(() => requestController.abort(), AUTH_REQUEST_TIMEOUT_MS)
    : null;
  const headers = new Headers(init.headers);
  try {
    let token = getAccessToken();
    if (tokenExpiresSoon(token)) token = await refreshAccessToken(requestSignal);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(input, { ...init, headers, signal: requestSignal });
    if (response.status !== 401) return response;
    const refreshedToken = await refreshAccessToken(requestSignal);
    if (!refreshedToken) {
      notifyAuthExpired();
      return response;
    }
    headers.set("Authorization", `Bearer ${refreshedToken}`);
    const retry = await fetch(input, { ...init, headers, signal: requestSignal });
    if (retry.status === 401) notifyAuthExpired();
    return retry;
  } finally {
    if (timeout !== null) window.clearTimeout(timeout);
  }
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  clearAccessToken();
}
