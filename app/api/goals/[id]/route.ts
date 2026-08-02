import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { goals } from "@/backend/db/schema";
import { goalInput } from "@/backend/domain/validation";

export const runtime = "nodejs"; type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) { const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401); const [goal] = await db.select().from(goals).where(and(eq(goals.id, id), eq(goals.userId, userId))).limit(1); return goal ? NextResponse.json({ goal }) : errorResponse("Goal not found", 404); }
export async function PATCH(request: Request, { params }: Context) { const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401); const parsed = goalInput.partial().safeParse(await request.json().catch(() => null)); if (!parsed.success || Object.keys(parsed.data).length === 0) return errorResponse("Invalid goal update", 400); const updated = await db.update(goals).set(parsed.data).where(and(eq(goals.id, id), eq(goals.userId, userId))).returning(); if (!updated.length) return errorResponse("Goal not found", 404); return NextResponse.json({ goal: updated[0] }); }
export async function DELETE(request: Request, { params }: Context) { const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401); const deleted = await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId))).returning({ id: goals.id }); return deleted.length ? NextResponse.json({ success: true }) : errorResponse("Goal not found", 404); }
