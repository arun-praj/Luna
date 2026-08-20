import { useMemo, useSyncExternalStore } from "react";

const HOME_SNAPSHOT_VERSION = 1;
const HOME_SNAPSHOT_KEY_PREFIX = "luna.home-snapshot:v1:";
const HOME_CACHE_KEY_PREFIXES = [
  HOME_SNAPSHOT_KEY_PREFIX,
  "luna.home-alerts.cache:",
  "luna.activity-alerts.cache:",
];

export type HomeSnapshotSurface = "balance" | "monthly-summary" | "transactions";

type SnapshotStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
type SnapshotValidator<T> = (value: unknown) => value is T;

export type HomeSnapshotEnvelope<T> = {
  version: number;
  userId: string;
  surface: HomeSnapshotSurface;
  scope: string;
  savedAt: number;
  data: T;
};

const noSnapshotSubscription = () => () => undefined;

export function hasFreshDataChanged<T>(previous: T | null, next: T) {
  return previous !== null && JSON.stringify(previous) !== JSON.stringify(next);
}

function sessionStorageOrNull() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function snapshotKey(surface: HomeSnapshotSurface, userId: string, scope: string) {
  return `${HOME_SNAPSHOT_KEY_PREFIX}${encodeURIComponent(userId)}:${surface}:${encodeURIComponent(scope)}`;
}

function isEnvelope<T>(value: unknown, surface: HomeSnapshotSurface, userId: string, scope: string): value is HomeSnapshotEnvelope<T> {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<HomeSnapshotEnvelope<T>>;
  return envelope.version === HOME_SNAPSHOT_VERSION
    && envelope.userId === userId
    && envelope.surface === surface
    && envelope.scope === scope
    && typeof envelope.savedAt === "number"
    && Object.hasOwn(envelope, "data");
}

export function readHomeSnapshot<T>(
  surface: HomeSnapshotSurface,
  userId: string | null | undefined,
  scope: string,
  storage: SnapshotStorage | null = sessionStorageOrNull(),
) {
  if (!userId || !storage) return null;
  try {
    const raw = storage.getItem(snapshotKey(surface, userId, scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isEnvelope<T>(parsed, surface, userId, scope) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Provides the matching snapshot during the first client render after
 * hydration. The server snapshot remains null, so SSR markup stays cold-safe.
 */
export function useHomeSnapshot<T>(
  surface: HomeSnapshotSurface,
  userId: string | null | undefined,
  scope: string,
  validate?: SnapshotValidator<T>,
) {
  const key = `${surface}:${userId ?? ""}:${scope}`;
  const cached = useMemo(() => {
    const snapshot = readHomeSnapshot<T>(surface, userId, scope);
    return {
      key,
      value: snapshot && (!validate || validate(snapshot.data)) ? snapshot : null,
    };
  }, [key, scope, surface, userId, validate]);
  return useSyncExternalStore(
    noSnapshotSubscription,
    () => cached.value,
    () => null,
  );
}

export function writeHomeSnapshot<T>(
  surface: HomeSnapshotSurface,
  userId: string | null | undefined,
  scope: string,
  data: T,
  storage: SnapshotStorage | null = sessionStorageOrNull(),
) {
  if (!userId || !storage) return;
  const envelope: HomeSnapshotEnvelope<T> = {
    version: HOME_SNAPSHOT_VERSION,
    userId,
    surface,
    scope,
    savedAt: Date.now(),
    data,
  };
  try {
    storage.setItem(snapshotKey(surface, userId, scope), JSON.stringify(envelope));
  } catch {
    // Session storage is an optimization and may be unavailable in private mode.
  }
}

export function clearHomeSnapshots(storage: SnapshotStorage | null = sessionStorageOrNull()) {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && HOME_CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // Best effort cleanup; a fresh user still cannot read another user's key.
  }
}

export function updateCachedBalancePrivacy(
  userId: string | null | undefined,
  hideTotalBalance: boolean,
  storage: SnapshotStorage | null = sessionStorageOrNull(),
) {
  const snapshot = readHomeSnapshot<Record<string, unknown>>("balance", userId, "default", storage);
  if (!snapshot || !snapshot.data || typeof snapshot.data !== "object") return;
  writeHomeSnapshot("balance", userId, "default", { ...snapshot.data, hideTotalBalance }, storage);
}
