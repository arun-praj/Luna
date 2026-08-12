import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { getBudgetReview } from "@/backend/domain/budget-service";
import type { BudgetPeriod } from "@/lib/budgets";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const params = new URL(request.url).searchParams;
  const period = (params.get("period") as BudgetPeriod | null) ?? "monthly";
  try {
    return NextResponse.json(await getBudgetReview(userId, ["weekly", "monthly", "yearly"].includes(period) ? period : "monthly"));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to load budget review", 400);
  }
}
