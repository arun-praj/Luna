import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { getBudgetCategoryBuckets, saveBudgetCategoryBuckets } from "@/backend/domain/budget-service";
import { budgetBucketInput } from "@/backend/domain/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  return NextResponse.json({ assignments: await getBudgetCategoryBuckets(userId) });
}

export async function PUT(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body)) return errorResponse("Invalid category bucket assignments", 400);
  const assignments = body.map((item) => budgetBucketInput.safeParse(item)).filter((result): result is { success: true; data: { categoryId: string; bucket: "needs" | "wants" | null } } => result.success).map((result) => result.data);
  if (assignments.length !== body.length) return errorResponse("Invalid category bucket assignments", 400);
  try {
    return NextResponse.json({ assignments: await saveBudgetCategoryBuckets(userId, assignments) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to save category buckets", 400);
  }
}
