import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { accounts, goals } from "@/backend/db/schema";
import { goalCreateInput } from "@/backend/domain/validation";

export const runtime = "nodejs";
export async function GET(request: Request) { const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401); return NextResponse.json({ goals: await db.select().from(goals).where(eq(goals.userId, userId)).orderBy(asc(goals.status), asc(goals.targetDate)) }); }
export async function POST(request: Request) { const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401); const parsed = goalCreateInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return errorResponse("Choose a goal account and add a valid target", 400); const [account] = await db.select().from(accounts).where(and(eq(accounts.id, parsed.data.accountId), eq(accounts.userId, userId))).limit(1); if (!account) return errorResponse("Goal account not found", 400); const id = randomUUID(); await db.insert(goals).values({ id, userId, name: parsed.data.name, targetAmount: parsed.data.targetAmount, allocatedAmount: 0, status: parsed.data.status ?? "active", targetDate: parsed.data.targetDate ?? null, accountId: account.id }); const [goal] = await db.select().from(goals).where(eq(goals.id, id)).limit(1); return NextResponse.json({ goal }, { status: 201 }); }
