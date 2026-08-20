import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { createLoan, listLoans } from "@/backend/domain/loan-service";
import { loanInput } from "@/backend/domain/validation";
import { scheduleHomeAlertRepair } from "@/backend/domain/home-alert-service";

export async function GET(request: Request) { const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401); return NextResponse.json({ loans: await listLoans(userId) }); }
export async function POST(request: Request) { const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401); const parsed = loanInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid loan", 400); try { const loan = await createLoan(userId, parsed.data); scheduleHomeAlertRepair(userId); return NextResponse.json({ loan }, { status: 201 }); } catch (error) { return errorResponse(error instanceof Error ? error.message : "Could not create loan", 400); } }
