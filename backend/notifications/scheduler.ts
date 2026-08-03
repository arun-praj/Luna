import "server-only";

import { and, eq, isNotNull, or } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/backend/db/client";
import {
  accounts,
  goals,
  notificationDeliveries,
  notificationSettings,
  recurringTemplates,
} from "@/backend/db/schema";

type NotificationKind = "goal_milestone" | "recurring_due" | "recurring_transaction" | "low_balance";
type NotificationSettingsRow = typeof notificationSettings.$inferSelect;
type PushSubscription = { endpoint: string; expirationTime?: number | null; keys?: Record<string, string> };
type LocalDateTime = { date: string; time: string; weekday: number; dayOfMonth: number };

const MILESTONES = [25, 50, 75, 100];

function localDateTime(now: Date, timezone: string): LocalDateTime {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const year = Number(values.year);
    const month = Number(values.month);
    const day = Number(values.day);
    return {
      date: `${values.year}-${values.month}-${values.day}`,
      time: `${values.hour}:${values.minute}`,
      weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
      dayOfMonth: day,
    };
  } catch {
    if (timezone !== "UTC") return localDateTime(now, "UTC");
    return localDateTimeParts(now);
  }
}

function localDateTimeParts(now: Date): LocalDateTime {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return {
    date: `${year}-${month}-${day}`,
    time: `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`,
    weekday: now.getUTCDay(),
    dayOfMonth: now.getUTCDate(),
  };
}

function reminderTime(settings: NotificationSettingsRow) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(settings.recurringTransactionTime)
    ? settings.recurringTransactionTime
    : "09:00";
}

function parseSubscription(value: string | null): PushSubscription | null {
  if (!value) return null;
  try {
    const subscription = JSON.parse(value) as Partial<PushSubscription>;
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) return null;
    return subscription as PushSubscription;
  } catch {
    return null;
  }
}

function vapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? process.env.APP_URL ?? "https://luna.arunprajapati.com";
  return publicKey && privateKey ? { publicKey, privateKey, subject } : null;
}

function errorStatus(error: unknown) {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return null;
  const statusCode = error.statusCode;
  return typeof statusCode === "number" ? statusCode : null;
}

function enabled(settings: NotificationSettingsRow, kind: NotificationKind) {
  if (kind === "goal_milestone") return settings.goalMilestonesEnabled;
  if (kind === "recurring_due") return settings.recurringDueEnabled;
  if (kind === "recurring_transaction") return settings.recurringTransactionEnabled;
  return settings.lowBalanceEnabled;
}

async function sendUserNotification(
  settings: NotificationSettingsRow,
  kind: NotificationKind,
  referenceId: string,
  occurrenceKey: string,
  payload: { title: string; body: string; url?: string },
) {
  const config = vapidConfig();
  const subscription = parseSubscription(settings.pushSubscription);
  if (!config || !subscription || !enabled(settings, kind)) return false;

  const deliveryId = crypto.randomUUID();
  const [delivery] = await db.insert(notificationDeliveries).values({
    id: deliveryId,
    userId: settings.userId,
    kind,
    referenceId,
    occurrenceKey,
    sentAt: new Date().toISOString(),
  }).onConflictDoNothing().returning({ id: notificationDeliveries.id });

  if (!delivery) return false;

  try {
    await webpush.sendNotification(subscription, JSON.stringify({
      ...payload,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: `${kind}-${referenceId}`,
    }), {
      TTL: 60 * 60 * 24,
      urgency: "normal",
      vapidDetails: config,
    });
    return true;
  } catch (error) {
    await db.delete(notificationDeliveries).where(eq(notificationDeliveries.id, deliveryId));
    if (errorStatus(error) === 404 || errorStatus(error) === 410) {
      await db.update(notificationSettings)
        .set({ pushSubscription: null })
        .where(eq(notificationSettings.userId, settings.userId));
    } else {
      console.error("Luna notification delivery failed", { kind, userId: settings.userId, error });
    }
    return false;
  }
}

function recurringTransactionIsScheduled(
  frequency: NotificationSettingsRow["recurringTransactionFrequency"],
  local: LocalDateTime,
) {
  if (frequency === "daily") return true;
  if (frequency === "weekly") return local.weekday === 1;
  return local.dayOfMonth === 1;
}

async function notifyUser(settings: NotificationSettingsRow, now: Date) {
  const local = localDateTime(now, settings.timezone || "UTC");
  if (local.time !== reminderTime(settings)) return;

  if (settings.recurringDueEnabled) {
    const dueTemplates = await db.select({ id: recurringTemplates.id, type: recurringTemplates.type, amount: recurringTemplates.amount })
      .from(recurringTemplates)
      .where(and(eq(recurringTemplates.userId, settings.userId), eq(recurringTemplates.isActive, true)));
    for (const template of dueTemplates) {
      if (template.nextDueDate > local.date) continue;
      await sendUserNotification(settings, "recurring_due", template.id, template.nextDueDate, {
        title: "Recurring payment due",
        body: `Your ${template.type} of ${template.amount} is due.`,
        url: "/",
      });
    }
  }

  if (settings.recurringTransactionEnabled && recurringTransactionIsScheduled(settings.recurringTransactionFrequency, local)) {
    await sendUserNotification(settings, "recurring_transaction", "schedule", local.date, {
      title: "Recurring transaction reminder",
      body: "Review and record your recurring transaction in Luna.",
      url: "/",
    });
  }

  if (settings.goalMilestonesEnabled) {
    const userGoals = await db.select({ id: goals.id, name: goals.name, targetAmount: goals.targetAmount, allocatedAmount: goals.allocatedAmount })
      .from(goals)
      .where(and(eq(goals.userId, settings.userId), or(eq(goals.status, "active"), eq(goals.status, "completed"))));
    for (const goal of userGoals) {
      const progress = goal.targetAmount > 0 ? (goal.allocatedAmount / goal.targetAmount) * 100 : 0;
      for (const milestone of MILESTONES) {
        if (progress < milestone) continue;
        await sendUserNotification(settings, "goal_milestone", goal.id, `milestone-${milestone}`, {
          title: "Goal milestone reached",
          body: `${goal.name} is ${milestone}% funded. Keep going!`,
          url: "/",
        });
      }
    }
  }

  if (settings.lowBalanceEnabled && settings.lowBalanceThreshold !== null) {
    const userAccounts = await db.select({ id: accounts.id, name: accounts.name, currency: accounts.currency, currentBalance: accounts.currentBalance })
      .from(accounts)
      .where(and(eq(accounts.userId, settings.userId), eq(accounts.includeInTotalBalance, true)));
    for (const account of userAccounts) {
      if (account.currentBalance > settings.lowBalanceThreshold) continue;
      await sendUserNotification(settings, "low_balance", account.id, local.date, {
        title: "Low balance alert",
        body: `${account.name} is at ${account.currentBalance} ${account.currency}.`,
        url: "/",
      });
    }
  }
}

export async function runScheduledNotifications(now = new Date()) {
  if (!vapidConfig()) return;
  const settings = await db.select().from(notificationSettings).where(isNotNull(notificationSettings.pushSubscription));
  for (const userSettings of settings) {
    await notifyUser(userSettings, now);
  }
}
