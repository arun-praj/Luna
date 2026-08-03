import { and, desc, eq, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { accounts, categories, transactions } from "@/backend/db/schema";
import { createTransaction, serializeTransaction } from "@/backend/domain/transaction-service";
import { transactionInput } from "@/backend/domain/validation";

export const runtime = "nodejs";

async function enrichTransactions(rows: (typeof transactions.$inferSelect)[], userId: string) {
  const accountRows = await db.select({ id: accounts.id, name: accounts.name, type: accounts.type, currency: accounts.currency, icon: accounts.icon, backgroundColor: accounts.backgroundColor }).from(accounts).where(eq(accounts.userId, userId));
  const categoryRows = await db.select({ id: categories.id, name: categories.name, type: categories.type, icon: categories.icon, color: categories.color }).from(categories).where(or(eq(categories.userId, userId), sql`${categories.userId} is null`));
  const accountById = new Map(accountRows.map((account) => [account.id, account]));
  const categoryById = new Map(categoryRows.map((category) => [category.id, category]));
  return rows.map((row) => ({
    ...serializeTransaction(row),
    accountName: accountById.get(row.accountId)?.name ?? "Unknown account",
    accountType: accountById.get(row.accountId)?.type ?? null,
    accountCurrency: accountById.get(row.accountId)?.currency ?? "NPR",
    accountIcon: accountById.get(row.accountId)?.icon ?? null,
    accountColor: accountById.get(row.accountId)?.backgroundColor ?? null,
    destinationAccountName: row.transferToAccountId ? accountById.get(row.transferToAccountId)?.name ?? "Unknown account" : null,
    destinationAccountType: row.transferToAccountId ? accountById.get(row.transferToAccountId)?.type ?? null : null,
    destinationAccountIcon: row.transferToAccountId ? accountById.get(row.transferToAccountId)?.icon ?? null : null,
    destinationAccountColor: row.transferToAccountId ? accountById.get(row.transferToAccountId)?.backgroundColor ?? null : null,
    categoryName: row.categoryId ? categoryById.get(row.categoryId)?.name ?? "Uncategorized" : null,
    categoryType: row.categoryId ? categoryById.get(row.categoryId)?.type ?? null : null,
    categoryIcon: row.categoryId ? categoryById.get(row.categoryId)?.icon ?? null : null,
    categoryColor: row.categoryId ? categoryById.get(row.categoryId)?.color ?? null : null,
  }));
}

export async function GET(request: Request) {
  const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401);
  const url = new URL(request.url); const accountId = url.searchParams.get("accountId"); const categoryId = url.searchParams.get("categoryId"); const savingsInstrumentId = url.searchParams.get("savingsInstrumentId"); const from = url.searchParams.get("from"); const to = url.searchParams.get("to"); const status = url.searchParams.get("syncStatus"); const search = url.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  const filters = [eq(transactions.userId, userId)];
  if (accountId) filters.push(eq(transactions.accountId, accountId));
  if (categoryId) filters.push(eq(transactions.categoryId, categoryId));
  if (savingsInstrumentId) filters.push(eq(transactions.savingsInstrumentId, savingsInstrumentId));
  if (from) filters.push(sql`${transactions.date} >= ${from}` as never);
  if (to) filters.push(sql`${transactions.date} <= ${to}` as never);
  if (status === "synced" || status === "pending" || status === "failed") filters.push(eq(transactions.syncStatus, status));
  if (search) {
    const pattern = `%${search.toLowerCase()}%`;
    filters.push(sql`(
      lower(${transactions.title}) LIKE ${pattern}
      OR lower(coalesce(${transactions.notes}, '')) LIKE ${pattern}
      OR lower(${transactions.tags}) LIKE ${pattern}
      OR lower(coalesce((SELECT name FROM categories WHERE categories.id = ${transactions.categoryId}), '')) LIKE ${pattern}
      OR lower(coalesce((SELECT name FROM accounts WHERE accounts.id = ${transactions.accountId}), '')) LIKE ${pattern}
      OR lower(coalesce((SELECT name FROM accounts AS destination_accounts WHERE destination_accounts.id = ${transactions.transferToAccountId}), '')) LIKE ${pattern}
    )` as never);
  }
  const rows = await db.select().from(transactions).where(and(...filters)).orderBy(desc(transactions.date), desc(transactions.createdAt));
  return NextResponse.json({ transactions: await enrichTransactions(rows, userId) });
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request); if (!userId) return errorResponse("Authentication required", 401);
  const parsed = transactionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const titleIssue = parsed.error.issues.find((issue) => issue.path[0] === "title");
    return errorResponse(titleIssue ? "Add a title for this transaction" : "Invalid transaction", 400);
  }
  try { return NextResponse.json({ transaction: serializeTransaction(await createTransaction(userId, parsed.data)) }, { status: 201 }); }
  catch (error) { return errorResponse(error instanceof Error ? error.message : "Unable to create transaction", 400); }
}
