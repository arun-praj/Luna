import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { transactions, userTags } from "@/backend/db/schema";
import { tagInput } from "@/backend/domain/validation";


export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const [savedTags, transactionRows] = await Promise.all([
    db.select({ name: userTags.name }).from(userTags).where(eq(userTags.userId, userId)).orderBy(asc(userTags.name)),
    db.select({ tags: transactions.tags }).from(transactions).where(eq(transactions.userId, userId)),
  ]);
  const names = new Map(savedTags.map((tag) => [tag.name.toLowerCase(), tag.name]));
  for (const row of transactionRows) {
    try {
      for (const value of JSON.parse(row.tags) as unknown[]) {
        if (typeof value === "string" && value.trim()) names.set(value.toLowerCase(), value.trim());
      }
    } catch {
      // Ignore malformed legacy tag data; it should not prevent the picker from opening.
    }
  }
  return NextResponse.json({ tags: [...names.values()].sort((left, right) => left.localeCompare(right)).map((name) => ({ name })) });
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
