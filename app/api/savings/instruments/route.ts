import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { savingsInstrumentTypes, savingsInstruments } from "@/backend/db/schema";
import { savingsInstrumentInput } from "@/backend/domain/validation";
import { normalizeMoney } from "@/lib/money";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const rows = await db.select().from(savingsInstruments).where(eq(savingsInstruments.userId, userId)).orderBy(asc(savingsInstruments.name));
  const types = await db.select().from(savingsInstrumentTypes).where(or(eq(savingsInstrumentTypes.userId, userId), isNull(savingsInstrumentTypes.userId)));
  const typeNames = new Map(types.map((type) => [type.id, type.name]));
  return NextResponse.json({ instruments: rows.map((instrument) => ({ ...instrument, currentBalance: normalizeMoney(instrument.currentBalance), typeName: typeNames.get(instrument.typeId) ?? "Other" })) });
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = savingsInstrumentInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid savings instrument", 400);
  const [type] = await db.select().from(savingsInstrumentTypes).where(and(eq(savingsInstrumentTypes.id, parsed.data.typeId), or(eq(savingsInstrumentTypes.userId, userId), isNull(savingsInstrumentTypes.userId)))).limit(1);
  if (!type) return errorResponse("Savings instrument type not found", 400);
  const id = randomUUID();
  await db.insert(savingsInstruments).values({ id, userId, typeId: parsed.data.typeId, name: parsed.data.name, description: parsed.data.description ?? "", currentBalance: parsed.data.currentBalance ?? 0, interestRate: parsed.data.interestRate ?? null, icon: parsed.data.icon ?? "Growth", backgroundColor: parsed.data.backgroundColor ?? "#e5f3eb", maturityDate: parsed.data.maturityDate ?? null });
  const [instrument] = await db.select().from(savingsInstruments).where(eq(savingsInstruments.id, id)).limit(1);
  return NextResponse.json({ instrument: instrument ? { ...instrument, currentBalance: normalizeMoney(instrument.currentBalance) } : instrument }, { status: 201 });
}
