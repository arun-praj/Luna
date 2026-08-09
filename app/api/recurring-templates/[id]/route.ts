import { and, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { accounts, categories, goals, recurringTemplates, savingsInstruments } from "@/backend/db/schema";
import { recurringOverview } from "@/backend/domain/recurring-service";
import { recurringTemplateInput } from "@/backend/domain/validation";
import { scheduleHomeAlertRepair } from "@/backend/domain/home-alert-service";

type Context = { params: Promise<{ id: string }> };

async function validatePatchReferences(userId: string, input: Record<string, unknown>) {
  if (typeof input.accountId === "string") {
    const [account] = await db.select().from(accounts).where(and(eq(accounts.id, input.accountId), eq(accounts.userId, userId))).limit(1);
    if (!account) throw new Error("Account not found");
    if (typeof input.transferToAccountId === "string") {
      const [target] = await db.select().from(accounts).where(and(eq(accounts.id, input.transferToAccountId), eq(accounts.userId, userId))).limit(1);
      if (!target) throw new Error("Transfer account not found");
      if (target.id === account.id) throw new Error("Transfer accounts must be different");
      if (input.type === "transfer" && target.currency !== account.currency) throw new Error("Recurring transfers must use the same currency");
    }
  }
  if (typeof input.categoryId === "string") {
    const [category] = await db.select().from(categories).where(and(eq(categories.id, input.categoryId), or(eq(categories.userId, userId), isNull(categories.userId)))).limit(1);
    if (!category) throw new Error("Category not found");
  }
  if (typeof input.savingsInstrumentId === "string") {
    const [instrument] = await db.select().from(savingsInstruments).where(and(eq(savingsInstruments.id, input.savingsInstrumentId), eq(savingsInstruments.userId, userId))).limit(1);
    if (!instrument) throw new Error("Savings instrument not found");
  }
  if (typeof input.goalId === "string") {
    if (input.type !== "savings") throw new Error("Goals can only be linked to savings recurring transactions");
    const [goal] = await db.select().from(goals).where(and(eq(goals.id, input.goalId), eq(goals.userId, userId))).limit(1);
    if (!goal) throw new Error("Goal not found");
    if (goal.monthlyContribution <= 0) throw new Error("Add a monthly set-aside to this goal first");
    if (typeof input.accountId === "string" && goal.accountId === input.accountId) throw new Error("The source account and goal account must be different");
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request);
  const { id } = await params;
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = recurringTemplateInput.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) return errorResponse("Invalid recurring template update", 400);
  try {
    await validatePatchReferences(userId, parsed.data);
    const [updated] = await db.update(recurringTemplates).set(parsed.data).where(and(eq(recurringTemplates.id, id), eq(recurringTemplates.userId, userId))).returning();
    if (!updated) return errorResponse("Recurring template not found", 404);
    scheduleHomeAlertRepair(userId);
    return NextResponse.json({ recurringTemplates: await recurringOverview(userId) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to update recurring template", 400);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request);
  const { id } = await params;
  if (!userId) return errorResponse("Authentication required", 401);
  const deleted = await db.delete(recurringTemplates).where(and(eq(recurringTemplates.id, id), eq(recurringTemplates.userId, userId))).returning({ id: recurringTemplates.id });
  return deleted.length ? NextResponse.json({ success: true }) : errorResponse("Recurring template not found", 404);
}
