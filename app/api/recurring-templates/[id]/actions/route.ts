import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { actOnRecurringTemplate } from "@/backend/domain/recurring-service";
import { z } from "zod";
import { resolveHomeAlert, scheduleHomeAlertRepair } from "@/backend/domain/home-alert-service";

type Context = { params: Promise<{ id: string }> };
// Occurrence IDs are database text keys. Production writes are UUIDs, but
// imported/legacy schedules can use stable provider keys.
const actionInput = z.object({ action: z.enum(["approve", "post", "skip", "pause", "resume"]), occurrenceId: z.string().min(1).optional(), alertId: z.string().uuid().optional() });

export async function POST(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request);
  const { id } = await params;
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = actionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid recurring action", 400);
  try {
    const result = await actOnRecurringTemplate(userId, id, parsed.data.action, parsed.data.occurrenceId);
    if ((parsed.data.action === "post" || parsed.data.action === "skip") && parsed.data.alertId) await resolveHomeAlert(userId, parsed.data.alertId);
    scheduleHomeAlertRepair(userId);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to update recurring transaction", 400);
  }
}
