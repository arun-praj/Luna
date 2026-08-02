import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { categories, spendingBudgets } from "@/backend/db/schema";
import { budgetInput } from "@/backend/domain/validation";

export const runtime = "nodejs";
export async function GET(request: Request) { const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401); return NextResponse.json({ budgets: await db.select().from(spendingBudgets).where(eq(spendingBudgets.userId, userId)).orderBy(asc(spendingBudgets.period), asc(spendingBudgets.name)) }); }
export async function POST(request: Request) { const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401); const parsed = budgetInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return errorResponse("Invalid budget", 400); if (parsed.data.categoryId) { const [category] = await db.select().from(categories).where(and(eq(categories.id, parsed.data.categoryId), or(eq(categories.userId, userId), isNull(categories.userId)))).limit(1); if (!category) return errorResponse("Category not found", 400); } const id = randomUUID(); await db.insert(spendingBudgets).values({ id, userId, categoryId: parsed.data.categoryId ?? null, name: parsed.data.name, limitAmount: parsed.data.limitAmount, period: parsed.data.period }); const [budget] = await db.select().from(spendingBudgets).where(eq(spendingBudgets.id, id)).limit(1); return NextResponse.json({ budget }, { status: 201 }); }
