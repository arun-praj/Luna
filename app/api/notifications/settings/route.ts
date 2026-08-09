import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { notificationSettings } from "@/backend/db/schema";

export const runtime = "nodejs";

const notificationSettingsInput = z.object({
  goalMilestonesEnabled: z.boolean().optional(),
  recurringDueEnabled: z.boolean().optional(),
  loanPaymentDueEnabled: z.boolean().optional(),
  recurringTransactionEnabled: z.boolean().optional(),
  recurringTransactionTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  recurringTransactionFrequency: z.enum(["daily", "weekly", "monthly"]).optional(),
  lowBalanceEnabled: z.boolean().optional(),
  lowBalanceThreshold: z.number().int().nonnegative().nullable().optional(),
  pushSubscription: z.record(z.string(), z.unknown()).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one setting is required");

const defaultSettings = (userId: string) => ({
  userId,
  goalMilestonesEnabled: true,
  recurringDueEnabled: true,
  loanPaymentDueEnabled: true,
  recurringTransactionEnabled: false,
  recurringTransactionTime: "09:00",
  timezone: "UTC",
  recurringTransactionFrequency: "monthly" as const,
  lowBalanceEnabled: false,
  lowBalanceThreshold: null,
  pushSubscription: null,
});

function serializeSettings(settings: typeof notificationSettings.$inferSelect) {
  return {
    userId: settings.userId,
    goalMilestonesEnabled: settings.goalMilestonesEnabled,
    recurringDueEnabled: settings.recurringDueEnabled,
    loanPaymentDueEnabled: settings.loanPaymentDueEnabled,
    recurringTransactionEnabled: settings.recurringTransactionEnabled,
    recurringTransactionTime: settings.recurringTransactionTime,
    timezone: settings.timezone,
    recurringTransactionFrequency: settings.recurringTransactionFrequency,
    lowBalanceEnabled: settings.lowBalanceEnabled,
    lowBalanceThreshold: settings.lowBalanceThreshold,
    pushSubscription: settings.pushSubscription ? JSON.parse(settings.pushSubscription) : null,
  };
}

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);

  let [settings] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1);
  if (!settings) {
    await db.insert(notificationSettings).values(defaultSettings(userId));
    [settings] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1);
  }
  return settings ? NextResponse.json({ settings: serializeSettings(settings) }) : errorResponse("Unable to load notification settings", 500);
}

export async function PATCH(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = notificationSettingsInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid notification settings", 400);

  const [current] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1);
  const input = parsed.data;
  const values = {
    userId,
    goalMilestonesEnabled: input.goalMilestonesEnabled ?? current?.goalMilestonesEnabled ?? true,
    recurringDueEnabled: input.recurringDueEnabled ?? current?.recurringDueEnabled ?? true,
    loanPaymentDueEnabled: input.loanPaymentDueEnabled ?? current?.loanPaymentDueEnabled ?? true,
    recurringTransactionEnabled: input.recurringTransactionEnabled ?? current?.recurringTransactionEnabled ?? false,
    recurringTransactionTime: input.recurringTransactionTime ?? current?.recurringTransactionTime ?? "09:00",
    timezone: input.timezone ?? current?.timezone ?? "UTC",
    recurringTransactionFrequency: input.recurringTransactionFrequency ?? current?.recurringTransactionFrequency ?? "monthly",
    lowBalanceEnabled: input.lowBalanceEnabled ?? current?.lowBalanceEnabled ?? false,
    lowBalanceThreshold: input.lowBalanceThreshold !== undefined ? input.lowBalanceThreshold : current?.lowBalanceThreshold ?? null,
    pushSubscription: input.pushSubscription !== undefined ? input.pushSubscription === null ? null : JSON.stringify(input.pushSubscription) : current?.pushSubscription ?? null,
  };

  if (current) {
    await db.update(notificationSettings).set(values).where(eq(notificationSettings.userId, userId));
  } else {
    await db.insert(notificationSettings).values(values);
  }

  const [settings] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)).limit(1);
  return settings ? NextResponse.json({ settings: serializeSettings(settings) }) : errorResponse("Unable to save notification settings", 500);
}
