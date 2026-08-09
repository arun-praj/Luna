import { and, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { accounts, categories, goals, recurringTemplates, savingsInstruments } from "@/backend/db/schema";
import { recurringOverview } from "@/backend/domain/recurring-service";
import { recurringTemplateInput } from "@/backend/domain/validation";
import { scheduleHomeAlertRepair } from "@/backend/domain/home-alert-service";

async function validateReferences(userId: string, input: Partial<ReturnType<typeof recurringTemplateInput.parse>>) {
  if (input.accountId) {
    const [account] = await db.select().from(accounts).where(and(eq(accounts.id, input.accountId), eq(accounts.userId, userId))).limit(1);
    if (!account) throw new Error("Account not found");
    if (input.transferToAccountId) {
      const [target] = await db.select().from(accounts).where(and(eq(accounts.id, input.transferToAccountId), eq(accounts.userId, userId))).limit(1);
      if (!target) throw new Error("Transfer account not found");
      if (target.id === account.id) throw new Error("Transfer accounts must be different");
      if (input.type === "transfer" && target.currency !== account.currency) throw new Error("Recurring transfers must use the same currency");
    }
  }
  if (input.type === "transfer" && !input.transferToAccountId) throw new Error("Transfer account is required");
  if (input.categoryId) {
    const [category] = await db.select().from(categories).where(and(eq(categories.id, input.categoryId), or(eq(categories.userId, userId), isNull(categories.userId)))).limit(1);
    if (!category) throw new Error("Category not found");
  }
  if (input.savingsInstrumentId) {
    const [instrument] = await db.select().from(savingsInstruments).where(and(eq(savingsInstruments.id, input.savingsInstrumentId), eq(savingsInstruments.userId, userId))).limit(1);
    if (!instrument) throw new Error("Savings instrument not found");
  }
  if (input.goalId) {
    if (input.type !== "savings") throw new Error("Goals can only be linked to savings recurring transactions");
    const [goal] = await db.select().from(goals).where(and(eq(goals.id, input.goalId), eq(goals.userId, userId))).limit(1);
    if (!goal) throw new Error("Goal not found");
    if (goal.monthlyContribution <= 0) throw new Error("Add a monthly set-aside to this goal first");
    if (goal.accountId === input.accountId) throw new Error("The source account and goal account must be different");
  }
}

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  return NextResponse.json({ recurringTemplates: await recurringOverview(userId) });
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = recurringTemplateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid recurring template", 400);
  try {
    await validateReferences(userId, parsed.data);
    const id = crypto.randomUUID();
    await db.insert(recurringTemplates).values({
      id,
      userId,
      ...parsed.data,
      title: parsed.data.title ?? "Recurring transaction",
      categoryId: parsed.data.categoryId ?? null,
      notes: parsed.data.notes ?? null,
      endDate: parsed.data.endDate ?? null,
      approvalRequired: parsed.data.approvalRequired ?? true,
      transferToAccountId: parsed.data.transferToAccountId ?? null,
      savingsInstrumentId: parsed.data.savingsInstrumentId ?? null,
      isActive: parsed.data.isActive ?? true,
    });
    scheduleHomeAlertRepair(userId);
    return NextResponse.json({ recurringTemplates: await recurringOverview(userId), createdId: id }, { status: 201 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to create recurring template", 400);
  }
}
