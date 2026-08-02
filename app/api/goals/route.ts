import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { goals } from "@/backend/db/schema";
import { goalInput } from "@/backend/domain/validation";

export const runtime = "nodejs";
export async function GET(request: Request) { const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401); return NextResponse.json({ goals: await db.select().from(goals).where(eq(goals.userId, userId)).orderBy(asc(goals.status), asc(goals.targetDate)) }); }
export async function POST(request: Request) { const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401); const parsed = goalInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return errorResponse("Invalid goal", 400); const id = randomUUID(); await db.insert(goals).values({ id, userId, name: parsed.data.name, targetAmount: parsed.data.targetAmount, allocatedAmount: 0, status: parsed.data.status ?? "active", targetDate: parsed.data.targetDate ?? null }); const [goal] = await db.select().from(goals).where(eq(goals.id, id)).limit(1); return NextResponse.json({ goal }, { status: 201 }); }
