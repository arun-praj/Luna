import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { BudgetConflictError, BudgetDeleteConflictError, deleteBudget, getBudgetDetails, listBudgets, updateBudget } from "@/backend/domain/budget-service";
import { budgetInput } from "@/backend/domain/validation";
import { scheduleHomeAlertRepair } from "@/backend/domain/home-alert-service";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const { id } = await params;
  const detail = await getBudgetDetails(userId, id);
  return detail ? NextResponse.json(detail) : errorResponse("Budget not found", 404);
}

export async function PATCH(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const { id } = await params;
  const parsed = budgetInput.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) return errorResponse("Invalid budget update", 400);
  try {
    const updated = await updateBudget(userId, id, parsed.data);
    if (!updated) return errorResponse("Budget not found", 404);
    scheduleHomeAlertRepair(userId);
    const budgets = await listBudgets(userId, updated.period);
    return NextResponse.json({ budget: budgets.find((budget) => budget.id === updated.id) });
  } catch (error) {
    if (error instanceof BudgetConflictError) {
      return NextResponse.json({ error: error.message, existingBudgetId: error.budgetId }, { status: 409 });
    }
    return errorResponse(error instanceof Error ? error.message : "Unable to update budget", 400);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const { id } = await params;
  try {
    const deleted = await deleteBudget(userId, id);
    if (!deleted) return errorResponse("Budget not found", 404);
    scheduleHomeAlertRepair(userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof BudgetDeleteConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    return errorResponse(error instanceof Error ? error.message : "Unable to delete budget", 400);
  }
}
