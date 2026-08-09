import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { BudgetConflictError, createBudget, deleteBudget, listBudgets, updateBudget } from "@/backend/domain/budget-service";
import { scheduleHomeAlertRepair } from "@/backend/domain/home-alert-service";
import { budgetInput } from "@/backend/domain/validation";

export const runtime = "nodejs";
const mutation = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("create"), mutationId: z.string().uuid(), budgetId: z.string().uuid(), input: budgetInput }),
  z.object({ operation: z.literal("update"), mutationId: z.string().uuid(), budgetId: z.string().uuid(), input: budgetInput.partial() }),
  z.object({ operation: z.literal("delete"), mutationId: z.string().uuid(), budgetId: z.string().uuid() }),
]);
const payload = z.object({ mutations: z.array(mutation).max(100) });

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = payload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid budget sync payload", 400);
  const results: Array<{ mutationId: string; status: "synced" | "failed"; budgetId?: string; error?: string; existingBudgetId?: string }> = [];
  for (const item of parsed.data.mutations) {
    try {
      if (item.operation === "create") {
        const budget = await createBudget(userId, { ...item.input, clientGeneratedId: item.mutationId });
        results.push({ mutationId: item.mutationId, status: "synced", budgetId: budget.id });
      } else if (item.operation === "update") {
        const budget = await updateBudget(userId, item.budgetId, item.input);
        results.push(budget ? { mutationId: item.mutationId, status: "synced", budgetId: budget.id } : { mutationId: item.mutationId, status: "failed", error: "Budget not found" });
      } else {
        await deleteBudget(userId, item.budgetId);
        results.push({ mutationId: item.mutationId, status: "synced", budgetId: item.budgetId });
      }
    } catch (error) {
      results.push(error instanceof BudgetConflictError
        ? { mutationId: item.mutationId, status: "failed", error: error.message, existingBudgetId: error.budgetId }
        : { mutationId: item.mutationId, status: "failed", error: error instanceof Error ? error.message : "Unable to sync budget" });
    }
  }
  scheduleHomeAlertRepair(userId);
  const budgets = await Promise.all((["weekly", "monthly", "yearly"] as const).map((period) => listBudgets(userId, period)));
  return NextResponse.json({ results, budgets: budgets.flat() });
}
