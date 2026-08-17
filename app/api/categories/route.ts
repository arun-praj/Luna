import { randomUUID } from "node:crypto";
import { and, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { categories, transactions } from "@/backend/db/schema";
import { aggregateCategoryUsage, dedupeCategoriesByName, emptyCategoryUsageFrequencyByType } from "@/backend/domain/category-usage";
import { categoryInput } from "@/backend/domain/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401);
  const [categoryRows, transactionRows] = await Promise.all([
    db.select().from(categories).where(or(eq(categories.userId, userId), isNull(categories.userId))),
    db.select({ categoryId: transactions.categoryId, type: transactions.type, splits: transactions.splits, transactionAt: transactions.transactionAt })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), or(isNotNull(transactions.categoryId), ne(transactions.splits, "[]")))),
  ]);
  const usageByCategory = aggregateCategoryUsage(transactionRows);
  const rankedCategories = dedupeCategoriesByName(categoryRows.map((category) => {
    const usage = usageByCategory.get(category.id);
    return { ...category, usageFrequency: usage?.usageFrequency ?? 0, usageFrequencyByType: usage?.usageFrequencyByType ?? emptyCategoryUsageFrequencyByType(), lastUsedAt: usage?.lastUsedAt ?? null };
  }), userId).sort((left, right) => right.usageFrequency - left.usageFrequency || left.name.localeCompare(right.name));
  return NextResponse.json({ categories: rankedCategories });
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401);
  const parsed = categoryInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) return errorResponse("Invalid category", 400);
  const id = randomUUID(); await db.insert(categories).values({ id, userId, ...parsed.data });
  const [category] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return NextResponse.json({ category }, { status: 201 });
}
