import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { BudgetConflictError, createBudget, listBudgets } from "@/backend/domain/budget-service";
import { budgetInput } from "@/backend/domain/validation";
import { scheduleHomeAlertRepair } from "@/backend/domain/home-alert-service";
import type { BudgetPeriod } from "@/lib/budgets";

export const runtime = "nodejs";
const periods = new Set<BudgetPeriod>(["weekly", "monthly", "yearly"]);

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const requested = new URL(request.url).searchParams.get("period") as BudgetPeriod | null;
  const period = requested && periods.has(requested) ? requested : "monthly";
  return NextResponse.json({ budgets: await listBudgets(userId, period), period });
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = budgetInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid budget", 400);
  try {
    const created = await createBudget(userId, parsed.data);
    scheduleHomeAlertRepair(userId);
    const budgets = await listBudgets(userId, created.period);
    return NextResponse.json({ budget: budgets.find((budget) => budget.id === created.id) }, { status: 201 });
  } catch (error) {
    if (error instanceof BudgetConflictError) {
      return NextResponse.json({ error: error.message, existingBudgetId: error.budgetId }, { status: 409 });
    }
    return errorResponse(error instanceof Error ? error.message : "Unable to create budget", 400);
  }
}
