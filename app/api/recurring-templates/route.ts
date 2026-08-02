import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { accounts, categories, recurringTemplates } from "@/backend/db/schema";
import { recurringTemplateInput } from "@/backend/domain/validation";

export const runtime = "nodejs";
export async function GET(request: Request) { const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401); return NextResponse.json({ recurringTemplates: await db.select().from(recurringTemplates).where(eq(recurringTemplates.userId, userId)).orderBy(asc(recurringTemplates.nextDueDate)) }); }
export async function POST(request: Request) { const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401); const parsed = recurringTemplateInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return errorResponse("Invalid recurring template", 400); const [account] = await db.select().from(accounts).where(and(eq(accounts.id, parsed.data.accountId), eq(accounts.userId, userId))).limit(1); if (!account) return errorResponse("Account not found", 400); if (parsed.data.categoryId) { const [category] = await db.select().from(categories).where(and(eq(categories.id, parsed.data.categoryId), or(eq(categories.userId, userId), isNull(categories.userId)))).limit(1); if (!category) return errorResponse("Category not found", 400); } const id = randomUUID(); await db.insert(recurringTemplates).values({ id, userId, ...parsed.data, categoryId: parsed.data.categoryId ?? null, notes: parsed.data.notes ?? null, isActive: parsed.data.isActive ?? true }); const [recurringTemplate] = await db.select().from(recurringTemplates).where(eq(recurringTemplates.id, id)).limit(1); return NextResponse.json({ recurringTemplate }, { status: 201 }); }
