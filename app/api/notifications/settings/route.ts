import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { notificationPushSubscriptions, notificationSettings } from "@/backend/db/schema";

export const runtime = "nodejs";

const pushSubscriptionInput = z.object({
  endpoint: z.string().trim().url().max(2048),
  expirationTime: z.number().finite().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

const notificationSettingsInput = z.object({
  goalMilestonesEnabled: z.boolean().optional(),
  recurringDueEnabled: z.boolean().optional(),
  loanPaymentDueEnabled: z.boolean().optional(),
  recurringTransactionEnabled: z.boolean().optional(),
  recurringTransactionTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  recurringDueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  recurringTransactionFrequency: z.enum(["daily", "weekly", "monthly"]).optional(),
  lowBalanceEnabled: z.boolean().optional(),
  lowBalanceThreshold: z.number().int().nonnegative().nullable().optional(),
  deviceId: z.string().trim().min(1).max(200).optional(),
  pushSubscription: pushSubscriptionInput.nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one setting is required");

const defaultSettings = (userId: string) => ({
  userId,
  goalMilestonesEnabled: true,
  recurringDueEnabled: true,
  loanPaymentDueEnabled: true,
  recurringTransactionEnabled: false,
  recurringTransactionTime: "09:00",
  recurringDueTime: "09:00",
  timezone: "UTC",
  recurringTransactionFrequency: "monthly" as const,
  lowBalanceEnabled: false,
  lowBalanceThreshold: null,
  pushSubscription: null,
});

function parseLegacySubscription(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function serializeSettings(settings: typeof notificationSettings.$inferSelect) {
  return {
    userId: settings.userId,
    goalMilestonesEnabled: settings.goalMilestonesEnabled,
    recurringDueEnabled: settings.recurringDueEnabled,
    loanPaymentDueEnabled: settings.loanPaymentDueEnabled,
    recurringTransactionEnabled: settings.recurringTransactionEnabled,
    recurringTransactionTime: settings.recurringTransactionTime,
    recurringDueTime: settings.recurringDueTime,
    timezone: settings.timezone,
    recurringTransactionFrequency: settings.recurringTransactionFrequency,
    lowBalanceEnabled: settings.lowBalanceEnabled,
    lowBalanceThreshold: settings.lowBalanceThreshold,
    pushSubscription: parseLegacySubscription(settings.pushSubscription),
  };
}

async function fallbackDeviceId(endpoint: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return `endpoint-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function upsertDeviceSubscription(
  userId: string,
  deviceId: string,
  subscription: z.infer<typeof pushSubscriptionInput>,
) {
  const now = new Date().toISOString();
  const normalizedSubscription = {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: subscription.keys,
  };
  const subscriptionJson = JSON.stringify(normalizedSubscription);
  const [deviceRow] = await db.select().from(notificationPushSubscriptions).where(and(
    eq(notificationPushSubscriptions.userId, userId),
    eq(notificationPushSubscriptions.deviceId, deviceId),
  )).limit(1);
  const [endpointRow] = await db.select().from(notificationPushSubscriptions)
    .where(eq(notificationPushSubscriptions.endpoint, subscription.endpoint)).limit(1);

  if (endpointRow && endpointRow.userId !== userId) {
    throw new Error("PUSH_SUBSCRIPTION_OWNED_BY_OTHER_USER");
  }

  // A browser can rotate its endpoint while retaining the same device id, or
  // return an existing endpoint after local storage has been cleared. Keep one
  // row for the current device and one globally unique owner for each endpoint.
  if (deviceRow && endpointRow && deviceRow.id !== endpointRow.id) {
    await db.delete(notificationPushSubscriptions).where(eq(notificationPushSubscriptions.id, deviceRow.id));
  }
  const existing = endpointRow ?? deviceRow;
  if (existing) {
    await db.update(notificationPushSubscriptions).set({
      userId,
      deviceId,
      endpoint: subscription.endpoint,
      subscriptionJson,
      active: true,
      lastSeenAt: now,
      lastDeliveryStatus: null,
      lastDeliveryHttpStatus: null,
      lastDeliveryError: null,
      updatedAt: now,
    }).where(eq(notificationPushSubscriptions.id, existing.id));
  } else {
    await db.insert(notificationPushSubscriptions).values({
      id: crypto.randomUUID(),
      userId,
      deviceId,
      endpoint: subscription.endpoint,
      subscriptionJson,
      active: true,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function loadOrCreateSettings(userId: string) {
  let [settings] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1);
  if (!settings) {
    await db.insert(notificationSettings).values(defaultSettings(userId));
    [settings] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1);
  }
  return settings;
}

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const settings = await loadOrCreateSettings(userId);
  return settings
    ? NextResponse.json({ settings: serializeSettings(settings) })
    : errorResponse("Unable to load notification settings", 500);
}

export async function PATCH(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = notificationSettingsInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid notification settings", 400);

  const input = parsed.data;
  try {
    if (input.pushSubscription) {
      const deviceId = input.deviceId ?? await fallbackDeviceId(input.pushSubscription.endpoint);
      await upsertDeviceSubscription(userId, deviceId, input.pushSubscription);
    } else if (input.pushSubscription === null) {
      const now = new Date().toISOString();
      let currentEndpoint: string | null = null;
      if (!input.deviceId) {
        const [current] = await db.select({ pushSubscription: notificationSettings.pushSubscription })
          .from(notificationSettings)
          .where(eq(notificationSettings.userId, userId))
          .limit(1);
        const endpoint = parseLegacySubscription(current?.pushSubscription)?.endpoint;
        currentEndpoint = typeof endpoint === "string" ? endpoint : null;
      }
      await db.update(notificationPushSubscriptions).set({
        active: false,
        lastSeenAt: now,
        updatedAt: now,
      }).where(and(
        eq(notificationPushSubscriptions.userId, userId),
        input.deviceId
          ? eq(notificationPushSubscriptions.deviceId, input.deviceId)
          : eq(notificationPushSubscriptions.endpoint, currentEndpoint ?? ""),
      ));
    }

    const [current] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1);
    const values = {
      userId,
      goalMilestonesEnabled: input.goalMilestonesEnabled ?? current?.goalMilestonesEnabled ?? true,
      recurringDueEnabled: input.recurringDueEnabled ?? current?.recurringDueEnabled ?? true,
      loanPaymentDueEnabled: input.loanPaymentDueEnabled ?? current?.loanPaymentDueEnabled ?? true,
      recurringTransactionEnabled: input.recurringTransactionEnabled ?? current?.recurringTransactionEnabled ?? false,
      recurringTransactionTime: input.recurringTransactionTime ?? current?.recurringTransactionTime ?? "09:00",
      recurringDueTime: input.recurringDueTime ?? current?.recurringDueTime ?? "09:00",
      timezone: input.timezone ?? current?.timezone ?? "UTC",
      recurringTransactionFrequency: input.recurringTransactionFrequency ?? current?.recurringTransactionFrequency ?? "monthly",
      lowBalanceEnabled: input.lowBalanceEnabled ?? current?.lowBalanceEnabled ?? false,
      lowBalanceThreshold: input.lowBalanceThreshold !== undefined ? input.lowBalanceThreshold : current?.lowBalanceThreshold ?? null,
      pushSubscription: input.pushSubscription !== undefined
        ? input.pushSubscription === null ? null : JSON.stringify({
          endpoint: input.pushSubscription.endpoint,
          expirationTime: input.pushSubscription.expirationTime ?? null,
          keys: input.pushSubscription.keys,
        })
        : current?.pushSubscription ?? null,
    };

    if (current) {
      await db.update(notificationSettings).set(values).where(eq(notificationSettings.userId, userId));
    } else {
      await db.insert(notificationSettings).values(values);
    }
    const [settings] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1);
    return settings
      ? NextResponse.json({ settings: serializeSettings(settings), synced: true })
      : errorResponse("Unable to save notification settings", 500);
  } catch (error) {
    if (error instanceof Error && error.message === "PUSH_SUBSCRIPTION_OWNED_BY_OTHER_USER") {
      return errorResponse("This push subscription is already registered to another account", 409);
    }
    throw error;
  }
}
