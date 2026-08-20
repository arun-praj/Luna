import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { updateLoanPayment } from "@/backend/domain/loan-service";
import { loanPaymentUpdateInput } from "@/backend/domain/validation";

type Context = { params: Promise<{ id: string; paymentId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request);
  const { id, paymentId } = await params;
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = loanPaymentUpdateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid payment", 400);
  try {
    return NextResponse.json({ loan: await updateLoanPayment(userId, id, paymentId, parsed.data) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not update payment", 400);
  }
}
