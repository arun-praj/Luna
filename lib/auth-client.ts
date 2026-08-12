"use client";

// Access tokens are intentionally process-local. A reload restores the session
// through the HttpOnly refresh cookie instead of exposing a bearer token to
// JavaScript-readable storage.
const LEGACY_ACCESS_TOKEN_KEY = "budget_access_token";
const REFRESH_WINDOW_SECONDS = 60;
const API_CACHE_TTL_MS = 120_000;
const AUTH_REQUEST_TIMEOUT_MS = 15_000;
const REFRESH_REQUEST_TIMEOUT_MS = 10_000;
const API_CACHE_STORAGE_KEY = "cocomelon.api-cache";
export const ONLINE_DATA_CHANGED_EVENT = "cocomelon:online-data-changed";
let refreshPromise: Promise<string | null> | null = null;
let accessToken: string | null = null;

class RefreshUnavailableError extends Error {}

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
  return accessToken;
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
  accessToken = token;
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

export function primeApiCache(path: string, data: unknown) {
  if (typeof window === "undefined") return;
  const cacheKey = new URL(path, window.location.origin).toString();
  apiCache.set(cacheKey, { data, expiresAt: Date.now() + API_CACHE_TTL_MS });
  persistCache();
}

export function notifyTransactionsChanged() {
  clearApiCache();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cocomelon:transactions-changed"));
  }
}

export function notifyOnlineDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ONLINE_DATA_CHANGED_EVENT));
  }
}

export function clearAccessToken() {
  accessToken = null;
  // Remove tokens written by older builds during the migration. New builds
  // never persist access tokens in browser storage.
  window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  // Do not leave the previous user's offline snapshot addressable after
  // logout or token expiry on a shared device.
  window.localStorage.removeItem("cocomelon.offline-active-user");
  clearApiCache();
  window.dispatchEvent(new CustomEvent("cocomelon:auth-changed"));
}

function clearAccessTokenIfCurrent(expectedToken: string | null) {
  if (getAccessToken() !== expectedToken) return;
  clearAccessToken();
}

function clearLunaDeviceCache() {
  if (typeof window === "undefined") return;

  // Remove Luna-owned browser state only. Do not clear the origin wholesale:
  // browser extensions and other applications may share it on localhost.
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (!key) continue;
      if (
        key.startsWith("cocomelon.") ||
        key.startsWith("budget_notification_settings:") ||
        key === LEGACY_ACCESS_TOKEN_KEY
      ) {
        storage.removeItem(key);
      }
    }
  }
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

async function performRefresh() {
  const tokenAtStart = getAccessToken();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REFRESH_REQUEST_TIMEOUT_MS);
  try {
    let refresh: Response;
    try {
      refresh = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (reason) {
      throw new RefreshUnavailableError(
        reason instanceof Error ? reason.message : "Refresh request failed",
      );
    }

    if (refresh.status === 401 || refresh.status === 403) {
      // Only a definitive invalid/revoked session may clear the local token.
      // A temporary 5xx or network failure must leave the session recoverable.
      clearAccessTokenIfCurrent(tokenAtStart);
      return null;
    }
    if (!refresh.ok) {
      throw new RefreshUnavailableError(`Refresh request failed with HTTP ${refresh.status}`);
    }

    const session = (await refresh.json()) as { accessToken?: string };
    if (!session.accessToken) {
      throw new RefreshUnavailableError("Refresh response was missing an access token");
    }

    // Do not overwrite a newer login or refresh that completed while this
    // request was in flight.
    const currentToken = getAccessToken();
    if (currentToken !== tokenAtStart) return currentToken;
    setAccessToken(session.accessToken);
    return session.accessToken;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshWithTabLock = async () => {
      if ("locks" in navigator && navigator.locks?.request) {
        return navigator.locks.request("budget-auth-refresh", async () => {
          const latestToken = getAccessToken();
          return tokenExpiresSoon(latestToken) ? performRefresh() : latestToken;
        });
      }
      return performRefresh();
    };
    return refreshWithTabLock();
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function refreshSessionIfNeeded() {
  const token = getAccessToken();
  if (token && !tokenExpiresSoon(token)) return token;
  try {
    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken && !getAccessToken()) notifyAuthExpired();
    return refreshedToken;
  } catch {
    // Keep the existing access token for a later retry when the failure was
    // caused by a temporary network, Worker, or database problem.
    return getAccessToken() ?? token;
  }
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
  const method = (
    init.method ??
    (typeof input === "string"
      ? "GET"
      : input instanceof Request
        ? input.method
        : "GET")
  ).toUpperCase();
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(method);
  const markMutationSuccess = (response: Response) => {
    if (response.ok && isMutation) notifyOnlineDataChanged();
    return response;
  };
  // Always put a bounded controller around authenticated requests. Several
  // callers pass their own signal (route loaders, login probes, sync), and
  // the old implementation skipped the timeout entirely in that case. A
  // stalled request could therefore leave a route on an endless loading
  // screen. Forward caller cancellation into the bounded controller so both
  // behaviors work together.
  const requestController = new AbortController();
  const requestSignal = requestController.signal;
  const forwardAbort = () => requestController.abort(init.signal?.reason);
  if (init.signal) {
    if (init.signal.aborted) forwardAbort();
    else init.signal.addEventListener("abort", forwardAbort, { once: true });
  }
  const timeout = window.setTimeout(() => requestController.abort(), AUTH_REQUEST_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  try {
    let token = getAccessToken();
    let initialRefreshFailed = false;
    let initialRefreshCompleted = false;
    if (tokenExpiresSoon(token)) {
      try {
        const refreshedToken = await refreshAccessToken();
        initialRefreshCompleted = true;
        token = refreshedToken;
      } catch {
        initialRefreshFailed = true;
      }
    }
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(input, { ...init, headers, signal: requestSignal });
    if (response.status !== 401) return markMutationSuccess(response);
    if (initialRefreshFailed) return response;
    if (initialRefreshCompleted && !token && !getAccessToken()) {
      notifyAuthExpired();
      return response;
    }
    let refreshedToken: string | null;
    try {
      refreshedToken = await refreshAccessToken();
    } catch {
      return response;
    }
    if (!refreshedToken) {
      if (!getAccessToken()) notifyAuthExpired();
      return response;
    }
    headers.set("Authorization", `Bearer ${refreshedToken}`);
    const retry = await fetch(input, { ...init, headers, signal: requestSignal });
    if (retry.status === 401) notifyAuthExpired();
    return markMutationSuccess(retry);
  } finally {
    window.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", forwardAbort);
  }
}

export async function signOut() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    // Clearing the device must not depend on a successful network logout.
    // This prevents the next person using a shared phone from accessing a
    // previous user's cached accounts or queued transactions offline.
    clearAccessToken();
    clearLunaDeviceCache();
    try {
      const { clearOfflineDatabase } = await import("@/lib/offline/database");
      await clearOfflineDatabase();
    } catch {
      // The auth state has already been cleared. A later launch cannot select
      // this snapshot because its active-user marker was removed above.
    }
  }
}
