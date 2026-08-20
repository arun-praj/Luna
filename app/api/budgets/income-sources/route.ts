import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { getBudgetIncomeSummary, getBudgetOnboardingStatus, replaceBudgetIncomeSources } from "@/backend/domain/budget-income-service";
import { budgetIncomeSourcesInput } from "@/backend/domain/validation";


export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  try {
    return NextResponse.json({ income: await getBudgetIncomeSummary(userId) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to load income estimates", 500);
  }
}

export async function PUT(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const status = await getBudgetOnboardingStatus(userId);
  if (!status.completed) return errorResponse("Complete budget onboarding first", 409);
  const parsed = budgetIncomeSourcesInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Add at least one valid income estimate", 400);
  try {
    return NextResponse.json({ income: await replaceBudgetIncomeSources(userId, parsed.data.incomeSources) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to save income estimates", 400);
  }
}
