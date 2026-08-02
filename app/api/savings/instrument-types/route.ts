import { randomUUID } from "node:crypto";
import { asc, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { savingsInstrumentTypes } from "@/backend/db/schema";
import { instrumentTypeInput } from "@/backend/domain/validation";

export const runtime = "nodejs";

const DEFAULT_INSTRUMENT_TYPES = [
  ["00000000-0000-4000-8000-000000000001", "Pension"],
  ["00000000-0000-4000-8000-000000000002", "SIP"],
  ["00000000-0000-4000-8000-000000000003", "Fixed Deposit"],
  ["00000000-0000-4000-8000-000000000004", "CIT"],
  ["00000000-0000-4000-8000-000000000005", "SSF"],
  ["00000000-0000-4000-8000-000000000006", "Other"],
] as const;

async function ensureDefaultInstrumentTypes() {
  for (const [id, name] of DEFAULT_INSTRUMENT_TYPES) {
    await db.insert(savingsInstrumentTypes).values({ id, name, isDefault: true, userId: null }).onConflictDoNothing();
  }
}

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  await ensureDefaultInstrumentTypes();
  return NextResponse.json({ instrumentTypes: await db.select().from(savingsInstrumentTypes).where(or(eq(savingsInstrumentTypes.userId, userId), isNull(savingsInstrumentTypes.userId))).orderBy(asc(savingsInstrumentTypes.name)) });
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = instrumentTypeInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid savings instrument type", 400);
  const id = randomUUID();
  await db.insert(savingsInstrumentTypes).values({ id, userId, name: parsed.data.name, isDefault: false });
  const [instrumentType] = await db.select().from(savingsInstrumentTypes).where(eq(savingsInstrumentTypes.id, id)).limit(1);
  return NextResponse.json({ instrumentType }, { status: 201 });
}
