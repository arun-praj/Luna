import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { accounts } from "@/backend/db/schema";
import { accountInput } from "@/backend/domain/validation";
import { hasDuplicateAccountName } from "@/backend/domain/account-rules";
import { createBalanceAdjustment } from "@/backend/domain/transaction-service";
import { attachStoredObject, deleteUploadIfUnreferenced } from "@/backend/storage/upload-lifecycle";
import { normalizeMoney } from "@/lib/money";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request); const { id } = await params;
  if (!userId) return errorResponse("Authentication required", 401);
  const [account] = await db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId))).limit(1);
  return account ? NextResponse.json({ account: { ...account, currentBalance: normalizeMoney(account.currentBalance) } }) : errorResponse("Account not found", 404);
}

export async function PATCH(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request); const { id } = await params;
  if (!userId) return errorResponse("Authentication required", 401);
  const [current] = await db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId))).limit(1);
  if (!current) return errorResponse("Account not found", 404);
  const parsed = accountInput.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) return errorResponse("Invalid account update", 400);
  const { openingBalance, ...input } = parsed.data;
  if (input.name !== undefined) {
    const existingAccounts = await db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.userId, userId));
    if (hasDuplicateAccountName(existingAccounts, input.name, id)) return errorResponse("An account with this name already exists", 409);
  }
  const allowNegativeBalance = input.allowNegativeBalance ?? current.allowNegativeBalance;
  const nextBalance = openingBalance ?? current.currentBalance;
  if (nextBalance < 0 && !allowNegativeBalance) return errorResponse("Negative balances are disabled. Enable Allow negative balance before saving this balance.", 400);
  const updates = input;
  if (updates.isDefault) await db.update(accounts).set({ isDefault: false }).where(eq(accounts.userId, userId));
  if (Object.keys(updates).length > 0) await db.update(accounts).set(updates).where(eq(accounts.id, id));
  if (openingBalance !== undefined) await createBalanceAdjustment(userId, id, openingBalance);
  const [account] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  if (account?.icon) await attachStoredObject(userId, "account-images", account.icon, "account", id);
  if (current.icon !== account?.icon) {
    await deleteUploadIfUnreferenced(userId, "account-images", current.icon).catch((error) => console.error("Account image cleanup failed", { userId, id, error }));
  }
  return NextResponse.json({ account: account ? { ...account, currentBalance: normalizeMoney(account.currentBalance) } : account });
}

export async function DELETE(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request); const { id } = await params;
  if (!userId) return errorResponse("Authentication required", 401);
  const [current] = await db.select({ icon: accounts.icon }).from(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId))).limit(1);
  const deleted = await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId))).returning({ id: accounts.id });
  if (deleted.length) {
    await deleteUploadIfUnreferenced(userId, "account-images", current.icon).catch((error) => console.error("Account image cleanup failed", { userId, id, error }));
  }
  return deleted.length ? NextResponse.json({ success: true }) : errorResponse("Account not found", 404);
}
