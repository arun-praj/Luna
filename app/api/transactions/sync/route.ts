import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { createTransaction, serializeTransaction } from "@/backend/domain/transaction-service";
import { scheduleHomeAlertRepair } from "@/backend/domain/home-alert-service";
import { transactionInput } from "@/backend/domain/validation";

export const runtime = "nodejs";
const syncInput = z.object({ transactions: z.array(transactionInput).max(500) });

export async function POST(request: Request) {
  const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401);
  const parsed = syncInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return errorResponse("Invalid transaction sync payload", 400);
  const synced = [];
  for (const input of parsed.data.transactions) {
    try { synced.push(serializeTransaction(await createTransaction(userId, input))); }
    catch (error) { return errorResponse(error instanceof Error ? error.message : "Unable to sync transaction", 400); }
  }
  scheduleHomeAlertRepair(userId);
  return NextResponse.json({ transactions: synced });
}
