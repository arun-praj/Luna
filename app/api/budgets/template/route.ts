import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { setupFiftyThirtyTwenty } from "@/backend/domain/budget-service";
import { budgetTemplateInput } from "@/backend/domain/validation";


export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = budgetTemplateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid 50/30/20 setup", 400);
  try {
    const assignments = parsed.data.assignments.filter((assignment): assignment is { categoryId: string; bucket: "needs" | "wants" } => Boolean(assignment.bucket));
    return NextResponse.json(await setupFiftyThirtyTwenty(userId, parsed.data.totalAmount, assignments));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to apply starter plan", 400);
  }
}
