import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { savingsInstrumentTypes } from "@/backend/db/schema";
import { instrumentTypeInput } from "@/backend/domain/validation";

export const runtime = "nodejs"; type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) { const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401); const parsed = instrumentTypeInput.partial().safeParse(await request.json().catch(() => null)); if (!parsed.success || Object.keys(parsed.data).length === 0) return errorResponse("Invalid instrument type update", 400); const updated = await db.update(savingsInstrumentTypes).set(parsed.data).where(and(eq(savingsInstrumentTypes.id, id), eq(savingsInstrumentTypes.userId, userId))).returning(); if (!updated.length) return errorResponse("Savings instrument type not found", 404); return NextResponse.json({ instrumentType: updated[0] }); }
export async function DELETE(request: Request, { params }: Context) { const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401); const deleted = await db.delete(savingsInstrumentTypes).where(and(eq(savingsInstrumentTypes.id, id), eq(savingsInstrumentTypes.userId, userId))).returning({ id: savingsInstrumentTypes.id }); return deleted.length ? NextResponse.json({ success: true }) : errorResponse("Savings instrument type not found", 404); }
