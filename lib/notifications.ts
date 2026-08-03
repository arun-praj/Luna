"use client";

import { authenticatedFetch } from "@/lib/auth-client";

export type PushSubscriptionJSON = {
  endpoint: string;
  expirationTime?: number | null;
  keys?: Record<string, string>;
};

export type RecurringReminderFrequency = "daily" | "weekly" | "monthly";

export type NotificationSettings = {
  userId: string;
  goalMilestonesEnabled: boolean;
  recurringDueEnabled: boolean;
  recurringTransactionEnabled: boolean;
  recurringTransactionTime: string;
  timezone: string;
  recurringTransactionFrequency: RecurringReminderFrequency;
  lowBalanceEnabled: boolean;
  lowBalanceThreshold: number | null;
  pushSubscription: PushSubscriptionJSON | null;
};

export type NotificationSettingsPatch = Partial<Omit<NotificationSettings, "userId">>;

const SETTINGS_CACHE_PREFIX = "budget_notification_settings:";
const DEFAULT_SETTINGS = {
  goalMilestonesEnabled: true,
  recurringDueEnabled: true,
  recurringTransactionEnabled: false,
  recurringTransactionTime: "09:00",
  timezone: "UTC",
  recurringTransactionFrequency: "monthly",
  lowBalanceEnabled: false,
  lowBalanceThreshold: null,
  pushSubscription: null,
} satisfies Omit<NotificationSettings, "userId">;

function cacheKey(userId: string) {
  return `${SETTINGS_CACHE_PREFIX}${userId}`;
}

export function defaultNotificationSettings(userId: string): NotificationSettings {
  return { userId, ...DEFAULT_SETTINGS };
}

export function readCachedNotificationSettings(userId: string) {
  try {
    const cached = window.localStorage.getItem(cacheKey(userId));
    return cached ? JSON.parse(cached) as NotificationSettings : null;
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
      cacheNotificationSettings(result.settings);
      return result.settings;
    }
  } catch {
    // Offline: continue with the last local snapshot.
  }
  return cached ?? defaultNotificationSettings(userId);
}

export async function saveNotificationSettings(userId: string, patch: NotificationSettingsPatch) {
  const current = readCachedNotificationSettings(userId) ?? defaultNotificationSettings(userId);
  const optimistic = { ...current, ...patch, userId };
  cacheNotificationSettings(optimistic);

  try {
    const response = await authenticatedFetch("/api/notifications/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (response.ok) {
      const result = await response.json() as { settings: NotificationSettings };
      cacheNotificationSettings(result.settings);
      return { settings: result.settings, synced: true };
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
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
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

function decodeVapidKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export async function subscribeToPush() {
  const key = vapidKey();
  const registration = await registerNotificationServiceWorker();
  if (!key || !registration?.pushManager) return null;
  try {
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(key),
    });
    return subscription.toJSON() as PushSubscriptionJSON;
  } catch {
    return null;
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
  kind: "goal_milestone" | "recurring_due" | "recurring_transaction" | "low_balance",
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
        : settings.lowBalanceEnabled;
  return enabled ? showBudgetNotification(title, body) : false;
}
