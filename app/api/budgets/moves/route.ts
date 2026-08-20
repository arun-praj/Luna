import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { listBudgetMoves, moveBudgetMoney } from "@/backend/domain/budget-service";
import { budgetMoveInput } from "@/backend/domain/validation";


export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const periodId = new URL(request.url).searchParams.get("periodId");
  if (!periodId) return errorResponse("Budget period is required", 400);
  return NextResponse.json({ moves: await listBudgetMoves(userId, periodId) });
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = budgetMoveInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid budget move", 400);
  try {
    return NextResponse.json(await moveBudgetMoney(userId, parsed.data), { status: 201 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to move budget money", 400);
  }
}
