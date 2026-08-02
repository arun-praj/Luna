import { randomUUID } from "node:crypto";
import { count, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { categories, transactions } from "@/backend/db/schema";
import { categoryInput } from "@/backend/domain/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401);
  const [categoryRows, usageRows] = await Promise.all([
    db.select().from(categories).where(or(eq(categories.userId, userId), isNull(categories.userId))),
    db.select({ categoryId: transactions.categoryId, frequency: count(transactions.id) })
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .groupBy(transactions.categoryId),
  ]);
  const usageFrequency = new Map<string, number>();
  for (const row of usageRows) {
    if (row.categoryId) usageFrequency.set(row.categoryId, Number(row.frequency));
  }
  const rankedCategories = categoryRows
    .map((category) => ({ ...category, usageFrequency: usageFrequency.get(category.id) ?? 0 }))
    .sort((left, right) => right.usageFrequency - left.usageFrequency || left.type.localeCompare(right.type) || left.name.localeCompare(right.name));
  return NextResponse.json({ categories: rankedCategories });
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401);
  const parsed = categoryInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return errorResponse("Invalid category", 400);
  const id = randomUUID(); await db.insert(categories).values({ id, userId, ...parsed.data });
  const [category] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return NextResponse.json({ category }, { status: 201 });
}
