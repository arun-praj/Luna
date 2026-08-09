import { and, eq, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { accounts, categories, transactions } from "@/backend/db/schema";
import { deleteTransaction, serializeTransaction, updateTransaction } from "@/backend/domain/transaction-service";
import { transactionInput } from "@/backend/domain/validation";

export const runtime = "nodejs"; type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request); const { id } = await params;
  if (!userId) return errorResponse("Authentication required", 401);
  const [transaction] = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId))).limit(1);
  if (!transaction) return errorResponse("Transaction not found", 404);
  const accountRows = await db.select({ id: accounts.id, name: accounts.name, type: accounts.type, currency: accounts.currency, icon: accounts.icon, backgroundColor: accounts.backgroundColor }).from(accounts).where(eq(accounts.userId, userId));
  const categoryRows = await db.select({ id: categories.id, name: categories.name, type: categories.type, icon: categories.icon, color: categories.color }).from(categories).where(or(eq(categories.userId, userId), sql`${categories.userId} is null`));
  const accountById = new Map(accountRows.map((account) => [account.id, account]));
  const categoryById = new Map(categoryRows.map((category) => [category.id, category]));
  const serialized = serializeTransaction(transaction);
  return NextResponse.json({ transaction: {
    ...serialized,
    accountName: accountById.get(transaction.accountId)?.name ?? "Unknown account",
    accountType: accountById.get(transaction.accountId)?.type ?? null,
    accountCurrency: accountById.get(transaction.accountId)?.currency ?? "NPR",
    accountIcon: accountById.get(transaction.accountId)?.icon ?? null,
    accountColor: accountById.get(transaction.accountId)?.backgroundColor ?? null,
    destinationAccountName: transaction.transferToAccountId ? accountById.get(transaction.transferToAccountId)?.name ?? "Unknown account" : null,
    destinationAccountType: transaction.transferToAccountId ? accountById.get(transaction.transferToAccountId)?.type ?? null : null,
    destinationAccountIcon: transaction.transferToAccountId ? accountById.get(transaction.transferToAccountId)?.icon ?? null : null,
    destinationAccountColor: transaction.transferToAccountId ? accountById.get(transaction.transferToAccountId)?.backgroundColor ?? null : null,
    categoryName: transaction.categoryId ? categoryById.get(transaction.categoryId)?.name ?? "Uncategorized" : null,
    categoryType: transaction.categoryId ? categoryById.get(transaction.categoryId)?.type ?? null : null,
    categoryIcon: transaction.categoryId ? categoryById.get(transaction.categoryId)?.icon ?? null : null,
    categoryColor: transaction.categoryId ? categoryById.get(transaction.categoryId)?.color ?? null : null,
    splits: serialized.splits.map((split) => ({
      ...split,
      categoryName: categoryById.get(split.categoryId)?.name ?? "Uncategorized",
      categoryIcon: categoryById.get(split.categoryId)?.icon ?? null,
      categoryColor: categoryById.get(split.categoryId)?.color ?? null,
    })),
  } });
}
export async function PATCH(request: Request, { params }: Context) { const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401); const parsed = transactionInput.safeParse(await request.json().catch(() => null)); if (!parsed.success) { const titleIssue = parsed.error.issues.find((issue) => issue.path[0] === "title"); return errorResponse(titleIssue ? "Add a title for this transaction" : "Invalid transaction", 400); } try { return NextResponse.json({ transaction: serializeTransaction(await updateTransaction(userId, id, parsed.data)) }); } catch (error) { return errorResponse(error instanceof Error ? error.message : "Unable to update transaction", 400); } }
export async function DELETE(request: Request, { params }: Context) { const userId = await requireAccessToken(request); const { id } = await params; if (!userId) return errorResponse("Authentication required", 401); try { await deleteTransaction(userId, id); return NextResponse.json({ success: true }); } catch (error) { return errorResponse(error instanceof Error ? error.message : "Unable to delete transaction", 400); } }
