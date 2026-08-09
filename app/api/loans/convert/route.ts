import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { accounts, loans } from "@/backend/db/schema";
import { getLoan } from "@/backend/domain/loan-service";

const input = z.object({ accountId: z.string().uuid(), direction: z.enum(["borrowed", "lent"]), counterparty: z.string().trim().max(120).nullable().optional() });
export const runtime = "nodejs";
export async function POST(request: Request) { const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401); const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return errorResponse("Invalid conversion", 400); const [account] = await db.select().from(accounts).where(and(eq(accounts.id, parsed.data.accountId), eq(accounts.userId, userId), eq(accounts.type, "loan"))).limit(1); if (!account) return errorResponse("Loan account not found", 404); const existing = await db.select({ id: loans.id }).from(loans).where(eq(loans.accountId, account.id)).limit(1); if (existing.length) return errorResponse("This account is already a detailed loan", 409); const id = randomUUID(); const now = new Date().toISOString(); await db.batch([db.update(accounts).set({ currentBalance: parsed.data.direction === "borrowed" ? -Math.abs(account.currentBalance) : Math.abs(account.currentBalance), includeInTotalBalance: false, allowNegativeBalance: parsed.data.direction === "borrowed" }).where(eq(accounts.id, account.id)), db.insert(loans).values({ id, userId, accountId: account.id, name: account.name, counterparty: parsed.data.counterparty ?? null, direction: parsed.data.direction, currency: account.currency, originalPrincipal: Math.abs(account.currentBalance), interestMethod: "none", startDate: new Date().toISOString().slice(0, 10), createdAt: now, updatedAt: now })]); return NextResponse.json({ loan: await getLoan(userId, id) }, { status: 201 }); }
