import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { serializeTransaction } from "@/backend/domain/transaction-service";
import { contributeToGoal, spendFromGoal, withdrawFromGoal } from "@/backend/domain/goal-service";
import { positiveMoneyInput } from "@/backend/domain/validation";
import { resolveHomeAlert, scheduleHomeAlertRepair } from "@/backend/domain/home-alert-service";

type Context = { params: Promise<{ id: string }> };

const actionInput = z.object({
  action: z.enum(["contribute", "withdraw", "spend"]),
  amount: positiveMoneyInput,
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  alertId: z.string().uuid().optional(),
});

export async function POST(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request);
  const { id } = await params;
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = actionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid goal action", 400);

  try {
    const input = parsed.data;
    const transaction = input.action === "contribute"
      ? await contributeToGoal(userId, id, input.accountId ?? "", input.amount, input.notes)
      : input.action === "withdraw"
        ? await withdrawFromGoal(userId, id, input.amount, input.notes, input.accountId)
        : await spendFromGoal(userId, id, input.amount, input.categoryId, input.notes);
    if (input.action === "contribute" && input.alertId) await resolveHomeAlert(userId, input.alertId);
    scheduleHomeAlertRepair(userId);
    return NextResponse.json({ transaction: serializeTransaction(transaction) }, { status: 201 });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unable to update goal", 400);
  }
}
