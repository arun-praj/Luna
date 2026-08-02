import { and, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { categories, spendingBudgets } from "@/backend/db/schema";
import { budgetInput } from "@/backend/domain/validation";

export const runtime = "nodejs"; type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) { const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401); const parsed = budgetInput.partial().safeParse(await request.json().catch(() => null)); if (!parsed.success || Object.keys(parsed.data).length === 0) return errorResponse("Invalid budget update", 400); if (parsed.data.categoryId) { const [category] = await db.select().from(categories).where(and(eq(categories.id, parsed.data.categoryId), or(eq(categories.userId, userId), isNull(categories.userId)))).limit(1); if (!category) return errorResponse("Category not found", 400); } const updated = await db.update(spendingBudgets).set(parsed.data).where(and(eq(spendingBudgets.id, id), eq(spendingBudgets.userId, userId))).returning(); if (!updated.length) return errorResponse("Budget not found", 404); return NextResponse.json({ budget: updated[0] }); }
export async function DELETE(request: Request, { params }: Context) { const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401); const deleted = await db.delete(spendingBudgets).where(and(eq(spendingBudgets.id, id), eq(spendingBudgets.userId, userId))).returning({ id: spendingBudgets.id }); return deleted.length ? NextResponse.json({ success: true }) : errorResponse("Budget not found", 404); }
