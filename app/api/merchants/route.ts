import { and, desc, isNotNull, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { transactions } from "@/backend/db/schema";

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const rows = await db
    .select({
      name: transactions.merchantName,
      lastUsedAt: sql<string>`max(${transactions.transactionAt})`,
      usageCount: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(and(
      sql`${transactions.userId} = ${userId}`,
      isNotNull(transactions.merchantName),
      ne(transactions.merchantName, ""),
    ))
    .groupBy(transactions.merchantName)
    .orderBy(desc(sql`max(${transactions.transactionAt})`), desc(sql`count(*)`))
    .limit(50);

  return NextResponse.json({ merchants: rows });
}
