"use client";

import { authenticatedFetch } from "./auth-client.ts";

export type PushSubscriptionJSON = {
  endpoint: string;
  expirationTime?: number | null;
  keys?: Record<string, string>;
  [key: string]: unknown;
};

export type RecurringReminderFrequency = "daily" | "weekly" | "monthly";

export type NotificationSettings = {
  userId: string;
  goalMilestonesEnabled: boolean;
  recurringDueEnabled: boolean;
  loanPaymentDueEnabled: boolean;
  recurringTransactionEnabled: boolean;
  recurringTransactionTime: string;
  recurringDueTime: string;
  timezone: string;
  recurringTransactionFrequency: RecurringReminderFrequency;
  lowBalanceEnabled: boolean;
  lowBalanceThreshold: number | null;
  pushSubscription: PushSubscriptionJSON | null;
};

export type NotificationSettingsPatch = Partial<Omit<NotificationSettings, "userId">> & { deviceId?: string };

const SETTINGS_CACHE_PREFIX = "budget_notification_settings:";
const DEFAULT_SETTINGS = {
  goalMilestonesEnabled: true,
  recurringDueEnabled: true,
  loanPaymentDueEnabled: true,
  recurringTransactionEnabled: false,
  recurringTransactionTime: "09:00",
  recurringDueTime: "09:00",
  timezone: "UTC",
  recurringTransactionFrequency: "monthly",
  lowBalanceEnabled: false,
  lowBalanceThreshold: null,
  pushSubscription: null,
} satisfies Omit<NotificationSettings, "userId">;

const NOTIFICATION_DEVICE_ID_KEY = "luna_notification_device_id";

function cacheKey(userId: string) {
  return `${SETTINGS_CACHE_PREFIX}${userId}`;
}

function normalizeNotificationSettings(userId: string, settings: Partial<NotificationSettings>) {
  return {
    ...defaultNotificationSettings(userId),
    ...settings,
    userId,
  } satisfies NotificationSettings;
}

export function defaultNotificationSettings(userId: string): NotificationSettings {
  return { userId, ...DEFAULT_SETTINGS };
}

export function notificationDeviceId() {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(NOTIFICATION_DEVICE_ID_KEY);
    if (existing) return existing;
    const created = window.crypto.randomUUID();
    window.localStorage.setItem(NOTIFICATION_DEVICE_ID_KEY, created);
    return created;
  } catch {
    return null;
  }
}

export function readCachedNotificationSettings(userId: string) {
  try {
    const cached = window.localStorage.getItem(cacheKey(userId));
    return cached ? normalizeNotificationSettings(userId, JSON.parse(cached) as Partial<NotificationSettings>) : null;
  } catch {
    return null;
  }
}

function cacheNotificationSettings(settings: NotificationSettings) {
  try {
    window.localStorage.setItem(cacheKey(settings.userId), JSON.stringify(settings));
  } catch {
    // Local storage may be unavailable in private browsing. The API still works online.
  }
}

export async function loadNotificationSettings(userId: string) {
  const cached = readCachedNotificationSettings(userId);
  try {
    const response = await authenticatedFetch("/api/notifications/settings");
    if (response.ok) {
      const result = await response.json() as { settings: NotificationSettings };
      const settings = normalizeNotificationSettings(userId, result.settings);
      cacheNotificationSettings(settings);
      return settings;
    }
  } catch {
    // Offline: continue with the last local snapshot.
  }
  return cached ?? defaultNotificationSettings(userId);
}

export async function saveNotificationSettings(userId: string, patch: NotificationSettingsPatch) {
  const current = readCachedNotificationSettings(userId) ?? defaultNotificationSettings(userId);
  const settingsPatch = { ...patch };
  delete settingsPatch.deviceId;
  const optimistic = { ...current, ...settingsPatch, userId };
  cacheNotificationSettings(optimistic);

  try {
    const requestPatch = patch.pushSubscription && !patch.deviceId
      ? { ...patch, deviceId: notificationDeviceId() ?? undefined }
      : patch;
    const response = await authenticatedFetch("/api/notifications/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPatch),
    });
    if (response.ok) {
      const result = await response.json() as { settings: NotificationSettings };
      const settings = normalizeNotificationSettings(userId, result.settings);
      cacheNotificationSettings(settings);
      return { settings, synced: true };
    }
  } catch {
    // Keep the optimistic local value and reconcile on the next online save.
  }
  return { settings: optimistic, synced: false };
}

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission() {
  return notificationsSupported() ? window.Notification.permission : "unsupported";
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "unsupported" as NotificationPermission | "unsupported";
  return window.Notification.requestPermission();
}

export async function registerNotificationServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  } catch {
    return null;
  }
}

function vapidKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
}

export function pushNotificationsConfigured() {
  return Boolean(vapidKey());
}

export function pushSubscriptionFingerprint(subscription: PushSubscriptionJSON | null) {
  if (!subscription) return null;
  return JSON.stringify({
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    auth: subscription.keys?.auth ?? null,
    p256dh: subscription.keys?.p256dh ?? null,
  });
}

function decodeVapidKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function subscriptionUsesVapidKey(subscription: PushSubscription, key: string) {
  const applicationServerKey = subscription.options.applicationServerKey;
  if (!applicationServerKey) return false;
  const current = new Uint8Array(applicationServerKey);
  const expected = decodeVapidKey(key);
  return current.length === expected.length && current.every((value, index) => value === expected[index]);
}

export async function getCurrentPushSubscription() {
  const registration = await registerNotificationServiceWorker();
  if (!registration?.pushManager) return null;
  try {
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function subscribeToPush() {
  const key = vapidKey();
  if (!key || notificationPermission() !== "granted") return null;
  const registration = await registerNotificationServiceWorker();
  if (!registration?.pushManager) return null;
  try {
    let existing = await registration.pushManager.getSubscription();
    if (existing && !subscriptionUsesVapidKey(existing, key)) {
      await existing.unsubscribe();
      existing = null;
    }
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(key),
    });
    return subscription.toJSON() as PushSubscriptionJSON;
  } catch {
    return null;
  }
}

type NotificationSubscriptionReconciliation = {
  subscription: PushSubscriptionJSON | null;
  synced: boolean;
  skipped: boolean;
};

const subscriptionSyncState = new Map<string, string>();
const subscriptionReconciliations = new Map<string, Promise<NotificationSubscriptionReconciliation>>();

export async function reconcileNotificationSubscription(userId: string): Promise<NotificationSubscriptionReconciliation> {
  const key = vapidKey();
  if (typeof window === "undefined" || notificationPermission() !== "granted" || !key) {
    return { subscription: null, synced: false, skipped: true };
  }

  const reconciliationKey = `${userId}:${key}`;
  const pending = subscriptionReconciliations.get(reconciliationKey);
  if (pending) return pending;

  const task = (async () => {
    const subscription = await subscribeToPush();
    if (!subscription) return { subscription: null, synced: false, skipped: false };

    const fingerprint = pushSubscriptionFingerprint(subscription);
    if (fingerprint && subscriptionSyncState.get(reconciliationKey) === fingerprint) {
      return { subscription, synced: true, skipped: false };
    }

    const result = await saveNotificationSettings(userId, { pushSubscription: subscription });
    if (result.synced && fingerprint) subscriptionSyncState.set(reconciliationKey, fingerprint);
    return { subscription, synced: result.synced, skipped: false };
  })().finally(() => {
    if (subscriptionReconciliations.get(reconciliationKey) === task) subscriptionReconciliations.delete(reconciliationKey);
  });

  subscriptionReconciliations.set(reconciliationKey, task);
  return task;
}

export function forgetNotificationSubscriptionSync(userId: string) {
  for (const key of subscriptionSyncState.keys()) {
    if (key.startsWith(`${userId}:`)) subscriptionSyncState.delete(key);
  }
}

export async function showBudgetNotification(title: string, body: string) {
  if (notificationPermission() !== "granted") return false;
  const options = { body, icon: "/favicon.ico", badge: "/favicon.ico", tag: "budget-alert" };
  const registration = await registerNotificationServiceWorker();
  if (registration) {
    await registration.showNotification(title, options);
    return true;
  }
  new window.Notification(title, options);
  return true;
}

export async function notifyBudgetEvent(
  kind: "goal_milestone" | "recurring_due" | "recurring_transaction" | "loan_payment_due" | "low_balance",
  title: string,
  body: string,
  settings: NotificationSettings,
) {
  const enabled = kind === "goal_milestone"
    ? settings.goalMilestonesEnabled
    : kind === "recurring_due"
      ? settings.recurringDueEnabled
      : kind === "recurring_transaction"
      ? settings.recurringTransactionEnabled
      : kind === "loan_payment_due" ? settings.loanPaymentDueEnabled
        : settings.lowBalanceEnabled;
  return enabled ? showBudgetNotification(title, body) : false;
}
