import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { applyBudgetRecommendations, getBudgetRecommendations } from "@/backend/domain/budget-service";
import type { BudgetPeriod } from "@/lib/budgets";


function periodFrom(request: Request): BudgetPeriod {
  return new URL(request.url).searchParams.get("period") === "monthly" ? "monthly" : "monthly";
}

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const months = Number(new URL(request.url).searchParams.get("months") ?? "6");
  try {
    return NextResponse.json(await getBudgetRecommendations(userId, periodFrom(request), Number.isFinite(months) ? months : 6));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to calculate recommendations", 400);
  }
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const body = await request.json().catch(() => null) as { period?: BudgetPeriod } | null;
  try {
    return NextResponse.json(await applyBudgetRecommendations(userId, body?.period ?? "monthly"));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to apply recommendations", 400);
  }
}
