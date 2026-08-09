import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { loanInstallments, loanRatePeriods } from "@/backend/db/schema";
import { buildLoanSchedule, getLoan } from "@/backend/domain/loan-service";
import { loanRateInput } from "@/backend/domain/validation";

export const runtime = "nodejs"; type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) { const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401); const parsed = loanRateInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return errorResponse("Invalid rate", 400); const detail = await getLoan(userId, id); if (!detail) return errorResponse("Loan not found", 404); await db.insert(loanRatePeriods).values({ id: randomUUID(), loanId: id, ...parsed.data, createdAt: new Date().toISOString() }).onConflictDoUpdate({ target: [loanRatePeriods.loanId, loanRatePeriods.effectiveDate], set: { annualRate: parsed.data.annualRate } }); const pending = detail.installments.filter((item) => item.status === "pending" && item.dueDate >= parsed.data.effectiveDate); if (pending.length && detail.paymentFrequency && detail.interestMethod !== "none") { const schedule = buildLoanSchedule({ principal: detail.outstandingPrincipal, annualRate: parsed.data.annualRate, method: detail.interestMethod, frequency: detail.paymentFrequency, termCount: pending.length, firstDueDate: pending[0].dueDate, scheduledPayment: detail.scheduledPayment }); for (const [index, item] of pending.entries()) await db.update(loanInstallments).set({ expectedPrincipal: schedule[index].expectedPrincipal, expectedInterest: schedule[index].expectedInterest }).where(eq(loanInstallments.id, item.id)); } return NextResponse.json({ loan: await getLoan(userId, id) }, { status: 201 }); }
