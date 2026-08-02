import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { userTags } from "@/backend/db/schema";
import { tagInput } from "@/backend/domain/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  return NextResponse.json({ tags: await db.select().from(userTags).where(eq(userTags.userId, userId)).orderBy(asc(userTags.name)) });
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = tagInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid tag", 400);
  const existing = (await db.select().from(userTags).where(eq(userTags.userId, userId))).find((tag) => tag.name.toLowerCase() === parsed.data.name.toLowerCase());
  if (existing) return NextResponse.json({ tag: existing });
  const id = randomUUID();
  await db.insert(userTags).values({ id, userId, name: parsed.data.name, createdAt: new Date().toISOString() });
  const [tag] = await db.select().from(userTags).where(eq(userTags.id, id)).limit(1);
  return NextResponse.json({ tag }, { status: 201 });
}
