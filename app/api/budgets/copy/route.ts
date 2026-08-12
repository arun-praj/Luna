import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { copyPreviousBudgetPeriod, previewPreviousBudgetPeriod } from "@/backend/domain/budget-service";
import { scheduleHomeAlertRepair } from "@/backend/domain/home-alert-service";

export const runtime = "nodejs";
const input = z.object({ period: z.enum(["weekly", "monthly", "yearly"]) });

async function getPeriod(request: Request) {
  const requested = new URL(request.url).searchParams.get("period");
  return input.shape.period.safeParse(requested).success ? requested as "weekly" | "monthly" | "yearly" : null;
}

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const period = await getPeriod(request);
  if (!period) return errorResponse("Invalid budget period", 400);
  return NextResponse.json(await previewPreviousBudgetPeriod(userId, period));
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid budget period", 400);
  const result = await copyPreviousBudgetPeriod(userId, parsed.data.period);
  scheduleHomeAlertRepair(userId);
  return NextResponse.json(result);
}
