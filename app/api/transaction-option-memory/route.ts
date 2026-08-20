import { and, asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { transactionOptionMemory } from "@/backend/db/schema";
import { transactionType } from "@/backend/domain/validation";

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);

  const requestedType = new URL(request.url).searchParams.get("type");
  const parsedType = transactionType.safeParse(requestedType);
  if (!parsedType.success) return errorResponse("Invalid transaction type", 400);

  const rows = await db
    .select({
      optionKind: transactionOptionMemory.optionKind,
      optionId: transactionOptionMemory.optionId,
      frequency: transactionOptionMemory.frequency,
      lastUsedAt: transactionOptionMemory.lastUsedAt,
    })
    .from(transactionOptionMemory)
    .where(and(eq(transactionOptionMemory.userId, userId), eq(transactionOptionMemory.transactionType, parsedType.data)))
    .orderBy(desc(transactionOptionMemory.lastUsedAt), desc(transactionOptionMemory.frequency), asc(transactionOptionMemory.optionId));

  const memory = {
    accounts: rows.filter((row) => row.optionKind === "account").map(({ optionId, frequency, lastUsedAt }) => ({ optionId, frequency: Number(frequency), lastUsedAt })),
    categories: rows.filter((row) => row.optionKind === "category").map(({ optionId, frequency, lastUsedAt }) => ({ optionId, frequency: Number(frequency), lastUsedAt })),
    savingsInstruments: rows.filter((row) => row.optionKind === "savings_instrument").map(({ optionId, frequency, lastUsedAt }) => ({ optionId, frequency: Number(frequency), lastUsedAt })),
  };

  return NextResponse.json({ type: parsedType.data, memory });
}
