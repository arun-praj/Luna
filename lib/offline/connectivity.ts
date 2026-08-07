const NETWORK_STATUS_EVENT = "cocomelon:network-status";
const CONNECTION_TIMEOUT_MS = 5_000;
const LAST_SUCCESSFUL_REFRESH_KEY = "cocomelon.offline-last-refresh";
const SNAPSHOT_REFRESH_INTERVAL_MS = 5 * 60_000;

export function offlineSnapshotNeedsRefresh(now = Date.now()) {
  if (typeof window === "undefined") return false;
  const lastRefresh = Number(window.localStorage.getItem(LAST_SUCCESSFUL_REFRESH_KEY));
  return !Number.isFinite(lastRefresh) || lastRefresh <= 0 || now - lastRefresh >= SNAPSHOT_REFRESH_INTERVAL_MS;
}

export function markOfflineSnapshotRefreshed(at = Date.now()) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_SUCCESSFUL_REFRESH_KEY, String(at));
}

export function dispatchNetworkStatus(online: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NETWORK_STATUS_EVENT, { detail: { online } }));
}

export function subscribeToNetworkStatus(listener: (online: boolean) => void) {
  const handler = (event: Event) => {
    listener(Boolean((event as CustomEvent<{ online?: boolean }>).detail?.online));
  };
  window.addEventListener(NETWORK_STATUS_EVENT, handler);
  return () => window.removeEventListener(NETWORK_STATUS_EVENT, handler);
}

export async function checkInternetConnection() {
  if (typeof window === "undefined") {
    dispatchNetworkStatus(false);
    return false;
  }
  // navigator.onLine is only a browser hint and can stay false after a captive
  // portal or network handoff. The same-origin probe is the authoritative check.
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);
  try {
    const response = await fetch(`/api/pwa/connectivity?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    const online = response.ok;
    dispatchNetworkStatus(online);
    return online;
  } catch {
    dispatchNetworkStatus(false);
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}
