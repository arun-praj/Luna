import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { completeBudgetOnboarding, getBudgetOnboardingStatus } from "@/backend/domain/budget-income-service";
import { budgetOnboardingInput } from "@/backend/domain/validation";
import { scheduleHomeAlertRepair } from "@/backend/domain/home-alert-service";


export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  try {
    return NextResponse.json(await getBudgetOnboardingStatus(userId));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to load budget onboarding", 500);
  }
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = budgetOnboardingInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Add an income estimate and at least one category allocation", 400);
  try {
    const result = await completeBudgetOnboarding(userId, parsed.data.incomeSources, parsed.data.allocations);
    scheduleHomeAlertRepair(userId);
    return NextResponse.json(result, { status: result.alreadyCompleted ? 200 : 201 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to start your budget", 400);
  }
}
