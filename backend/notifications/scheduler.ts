import "server-only";

import { and, eq, isNotNull, or } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/backend/db/client";
import {
  accounts,
  goals,
  loans,
  notificationDeliveries,
  notificationPushSubscriptions,
  notificationSettings,
  recurringTemplates,
} from "@/backend/db/schema";
import {
  isReminderWindow,
  localDateTime,
  recurringDueReminderIsScheduled,
  recurringTransactionIsScheduled,
  validReminderTime,
} from "@/backend/notifications/scheduler-rules";
import {
  deliveryStatusForHttpStatus,
  sanitizedDeliveryError,
  shouldAttemptDelivery,
  summarizeDeliveryStatuses,
  uniqueActiveSubscriptions,
  type PushDeliveryStatus,
} from "@/backend/notifications/subscription-rules";

type NotificationKind = "goal_milestone" | "recurring_due" | "recurring_transaction" | "loan_payment_due" | "low_balance";
type NotificationSettingsRow = typeof notificationSettings.$inferSelect;
type PushSubscriptionRecord = typeof notificationPushSubscriptions.$inferSelect;
type PushSubscription = Parameters<typeof webpush.sendNotification>[0];
type NotificationPayload = { title: string; body: string; url?: string; icon?: string; badge?: string; tag?: string };
type DeliveryAttempt = { result: PushDeliveryStatus; httpStatus: number | null };
export type PushDeliveryResult = PushDeliveryStatus;

const MILESTONES = [25, 50, 75, 100];

function parseSubscription(value: string | null): PushSubscription | null {
  if (!value) return null;
  try {
    const subscription = JSON.parse(value) as Partial<PushSubscription>;
    if (typeof subscription.endpoint !== "string" || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) return null;
    return {
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime ?? null,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    };
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
  if (kind === "loan_payment_due") return settings.loanPaymentDueEnabled;
  return settings.lowBalanceEnabled;
}

async function updateSubscriptionHealth(
  subscription: PushSubscriptionRecord,
  result: PushDeliveryStatus,
  httpStatus: number | null,
  now: string,
) {
  await db.update(notificationPushSubscriptions).set({
    active: result === "subscription_expired" ? false : subscription.active,
    lastDeliveryAt: now,
    lastDeliveryStatus: result,
    lastDeliveryHttpStatus: httpStatus,
    lastDeliveryError: sanitizedDeliveryError(httpStatus, result),
    updatedAt: now,
  }).where(eq(notificationPushSubscriptions.id, subscription.id));

  if (result === "subscription_expired") {
    const [settings] = await db.select({ pushSubscription: notificationSettings.pushSubscription })
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, subscription.userId))
      .limit(1);
    if (parseSubscription(settings?.pushSubscription ?? null)?.endpoint === subscription.endpoint) {
      await db.update(notificationSettings)
        .set({ pushSubscription: null })
        .where(eq(notificationSettings.userId, subscription.userId));
    }
  }
}

async function deliverPush(subscription: PushSubscriptionRecord, payload: NotificationPayload): Promise<DeliveryAttempt> {
  const config = vapidConfig();
  const parsed = parseSubscription(subscription.subscriptionJson);
  const now = new Date().toISOString();
  if (!config || !parsed) {
    await updateSubscriptionHealth(subscription, "not_configured", null, now);
    return { result: "not_configured", httpStatus: null };
  }

  try {
    await webpush.sendNotification(parsed, JSON.stringify(payload), {
      TTL: 60 * 60 * 24,
      urgency: "normal",
      vapidDetails: config,
    });
    await updateSubscriptionHealth(subscription, "sent", null, now);
    return { result: "sent", httpStatus: null };
  } catch (error) {
    const httpStatus = errorStatus(error);
    const result = deliveryStatusForHttpStatus(httpStatus);
    await updateSubscriptionHealth(subscription, result, httpStatus, now);
    console.error(JSON.stringify({
      event: "notification_delivery_failed",
      userId: subscription.userId,
      status: httpStatus,
      reason: sanitizedDeliveryError(httpStatus, result),
    }));
    return { result, httpStatus };
  }
}

async function sendUserNotification(
  settings: NotificationSettingsRow,
  subscriptions: PushSubscriptionRecord[],
  kind: NotificationKind,
  referenceId: string,
  occurrenceKey: string,
  payload: NotificationPayload,
) {
  if (!enabled(settings, kind)) return false;

  const now = new Date().toISOString();
  const deliveryId = crypto.randomUUID();
  const [created] = await db.insert(notificationDeliveries).values({
    id: deliveryId,
    userId: settings.userId,
    kind,
    referenceId,
    occurrenceKey,
    sentAt: now,
    deliveryStatus: "pending",
    attemptedDeviceCount: 0,
    deliveredDeviceCount: 0,
  }).onConflictDoNothing().returning({
    id: notificationDeliveries.id,
    deliveryStatus: notificationDeliveries.deliveryStatus,
  });

  let delivery = created;
  if (!delivery) {
    [delivery] = await db.select({
      id: notificationDeliveries.id,
      deliveryStatus: notificationDeliveries.deliveryStatus,
    }).from(notificationDeliveries).where(and(
      eq(notificationDeliveries.userId, settings.userId),
      eq(notificationDeliveries.kind, kind),
      eq(notificationDeliveries.referenceId, referenceId),
      eq(notificationDeliveries.occurrenceKey, occurrenceKey),
    )).limit(1);
  }

  // A sent or partial notification has already reached at least one device;
  // do not duplicate it on the next minute's cron tick.
  if (!delivery || !shouldAttemptDelivery(delivery.deliveryStatus)) return false;

  const activeSubscriptions = uniqueActiveSubscriptions(subscriptions);
  const attempts = await Promise.all(activeSubscriptions.map((subscription) => deliverPush(subscription, {
    ...payload,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: `${kind}-${referenceId}`,
  })));
  const statuses = attempts.map((attempt) => attempt.result);
  const summary = summarizeDeliveryStatuses(statuses);
  const firstFailure = attempts.find((attempt) => attempt.result !== "sent");
  await db.update(notificationDeliveries).set({
    deliveryStatus: summary.deliveryStatus,
    deliveryHttpStatus: firstFailure?.httpStatus ?? null,
    deliveryError: firstFailure ? sanitizedDeliveryError(firstFailure.httpStatus, firstFailure.result) : null,
    attemptedDeviceCount: summary.attemptedDeviceCount,
    deliveredDeviceCount: summary.deliveredDeviceCount,
  }).where(eq(notificationDeliveries.id, delivery.id));
  return summary.deliveredDeviceCount > 0;
}

async function notifyUser(settings: NotificationSettingsRow, subscriptions: PushSubscriptionRecord[], now: Date) {
  const local = localDateTime(now, settings.timezone || "UTC");

  if (settings.recurringDueEnabled && isReminderWindow(local, settings.recurringDueTime)) {
    const dueTemplates = await db.select({ id: recurringTemplates.id, type: recurringTemplates.type, amount: recurringTemplates.amount, nextDueDate: recurringTemplates.nextDueDate })
      .from(recurringTemplates)
      .where(and(eq(recurringTemplates.userId, settings.userId), eq(recurringTemplates.isActive, true)));
    for (const template of dueTemplates) {
      if (!recurringDueReminderIsScheduled(template.nextDueDate, local, settings.recurringDueTime)) continue;
      await sendUserNotification(settings, subscriptions, "recurring_due", template.id, template.nextDueDate, {
        title: "Recurring payment due",
        body: `Your ${template.type} of ${template.amount} is due.`,
        url: "/",
      });
    }
  }

  if (settings.loanPaymentDueEnabled) {
    const dueLoans = await db.select({ id: loans.id, name: loans.name, nextDueDate: loans.nextDueDate })
      .from(loans)
      .where(and(eq(loans.userId, settings.userId), eq(loans.status, "active"), isNotNull(loans.nextDueDate)));
    for (const loan of dueLoans) {
      if (loan.nextDueDate && loan.nextDueDate <= local.date) {
        await sendUserNotification(settings, subscriptions, "loan_payment_due", loan.id, loan.nextDueDate, {
          title: loan.nextDueDate < local.date ? "Loan payment overdue" : "Loan payment due",
          body: `${loan.name} needs your review. Confirm the payment when it appears on your account.`,
          url: `/loans/${loan.id}`,
        });
      }
    }
  }

  if (settings.recurringTransactionEnabled && isReminderWindow(local, validReminderTime(settings.recurringTransactionTime)) && recurringTransactionIsScheduled(settings.recurringTransactionFrequency, local)) {
    await sendUserNotification(settings, subscriptions, "recurring_transaction", "schedule", local.date, {
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
        await sendUserNotification(settings, subscriptions, "goal_milestone", goal.id, `milestone-${milestone}`, {
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
      await sendUserNotification(settings, subscriptions, "low_balance", account.id, local.date, {
        title: "Low balance alert",
        body: `${account.name} is at ${account.currentBalance} ${account.currency}.`,
        url: "/",
      });
    }
  }
}

export async function runScheduledNotifications(now = new Date()) {
  if (!vapidConfig()) return;
  const rows = await db.select({
    settings: notificationSettings,
    subscription: notificationPushSubscriptions,
  }).from(notificationSettings).innerJoin(
    notificationPushSubscriptions,
    and(
      eq(notificationPushSubscriptions.userId, notificationSettings.userId),
      eq(notificationPushSubscriptions.active, true),
    ),
  );
  const users = new Map<string, { settings: NotificationSettingsRow; subscriptions: PushSubscriptionRecord[] }>();
  for (const row of rows) {
    const current = users.get(row.settings.userId) ?? { settings: row.settings, subscriptions: [] };
    current.subscriptions.push(row.subscription);
    users.set(row.settings.userId, current);
  }
  for (const { settings, subscriptions } of users.values()) await notifyUser(settings, subscriptions, now);
}

export async function sendTestNotification(userId: string): Promise<PushDeliveryResult> {
  const [settings] = await db.select().from(notificationSettings)
    .where(eq(notificationSettings.userId, userId))
    .limit(1);
  if (!settings) return "not_configured";
  const subscriptions = await db.select().from(notificationPushSubscriptions)
    .where(and(eq(notificationPushSubscriptions.userId, userId), eq(notificationPushSubscriptions.active, true)));
  const activeSubscriptions = uniqueActiveSubscriptions(subscriptions);
  if (!vapidConfig() || activeSubscriptions.length === 0) return "not_configured";
  const attempts = await Promise.all(activeSubscriptions.map((subscription) => deliverPush(subscription, {
    title: "Luna notifications are working",
    body: "This test used the same background delivery path as your reminders and low balance alerts.",
    url: "/profile",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: `notification-test-${Date.now()}`,
  })));
  const delivered = attempts.filter((attempt) => attempt.result === "sent").length;
  if (delivered > 0) return "sent";
  return attempts[0]?.result ?? "not_configured";
}
