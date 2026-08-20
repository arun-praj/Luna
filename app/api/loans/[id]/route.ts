import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { loans } from "@/backend/db/schema";
import { deleteLoan, getLoan } from "@/backend/domain/loan-service";
import { loanUpdateInput } from "@/backend/domain/validation";
import { scheduleHomeAlertRepair } from "@/backend/domain/home-alert-service";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) { const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401); const loan = await getLoan(userId, id); return loan ? NextResponse.json({ loan }) : errorResponse("Loan not found", 404); }
export async function PATCH(request: Request, { params }: Context) { const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401); const parsed = loanUpdateInput.safeParse(await request.json().catch(() => null)); if (!parsed.success || !Object.keys(parsed.data).length) return errorResponse("Invalid loan update", 400); const [updated] = await db.update(loans).set({ ...parsed.data, updatedAt: new Date().toISOString() }).where(and(eq(loans.id, id), eq(loans.userId, userId))).returning(); if (updated) scheduleHomeAlertRepair(userId); return updated ? NextResponse.json({ loan: await getLoan(userId, id) }) : errorResponse("Loan not found", 404); }
export async function DELETE(request: Request, { params }: Context) { const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401); try { return NextResponse.json(await deleteLoan(userId, id)); } catch (error) { return errorResponse(error instanceof Error ? error.message : "Could not delete loan", 400); } }
