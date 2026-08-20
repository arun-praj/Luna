import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { transactionHistory, transactions } from "@/backend/db/schema";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) { const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401); const [transaction] = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId))).limit(1); if (!transaction) return errorResponse("Transaction not found", 404); const history = await db.select().from(transactionHistory).where(eq(transactionHistory.transactionId, id)).orderBy(asc(transactionHistory.changedAt)); return NextResponse.json({ history }); }
