import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { reverseBudgetMove } from "@/backend/domain/budget-service";


export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const { id } = await params;
  try {
    return NextResponse.json(await reverseBudgetMove(userId, id));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to reverse budget move", 400);
  }
}
