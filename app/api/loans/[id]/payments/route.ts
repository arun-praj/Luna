import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { recordLoanPayment } from "@/backend/domain/loan-service";
import { loanPaymentInput } from "@/backend/domain/validation";
import { scheduleHomeAlertRepair } from "@/backend/domain/home-alert-service";

export const runtime = "nodejs"; type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) { const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401); const parsed = loanPaymentInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid payment", 400); try { const loan = await recordLoanPayment(userId, id, parsed.data); scheduleHomeAlertRepair(userId); return NextResponse.json({ loan }, { status: 201 }); } catch (error) { return errorResponse(error instanceof Error ? error.message : "Could not record payment", 400); } }
