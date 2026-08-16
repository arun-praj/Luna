import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { accounts } from "@/backend/db/schema";
import { accountInput } from "@/backend/domain/validation";
import { hasDuplicateAccountName } from "@/backend/domain/account-rules";
import { createBalanceAdjustment } from "@/backend/domain/transaction-service";
import { deleteUploadIfUnreferenced, prepareStoredObjectAttachment, prepareStoredObjectDetachment, type UploadBatchStatement } from "@/backend/storage/upload-lifecycle";
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
  let attachmentStatement;
  try {
    attachmentStatement = Object.prototype.hasOwnProperty.call(updates, "icon") && current.icon !== updates.icon
      ? await prepareStoredObjectAttachment(userId, "account-images", updates.icon, "account", id)
      : null;
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Invalid account image", 400);
  }
  const detachmentStatement = Object.prototype.hasOwnProperty.call(updates, "icon") && current.icon !== updates.icon
    ? await prepareStoredObjectDetachment(userId, "account-images", current.icon, "account", id)
    : null;
  const accountStatements: UploadBatchStatement[] = [];
  if (updates.isDefault) accountStatements.push(db.update(accounts).set({ isDefault: false }).where(eq(accounts.userId, userId)) as unknown as UploadBatchStatement);
  if (Object.keys(updates).length > 0) accountStatements.push(db.update(accounts).set(updates).where(eq(accounts.id, id)) as unknown as UploadBatchStatement);
  if (attachmentStatement) accountStatements.unshift(attachmentStatement);
  if (detachmentStatement) accountStatements.push(detachmentStatement);
  if (accountStatements.length) await db.batch(accountStatements as [UploadBatchStatement, ...UploadBatchStatement[]]);
  if (openingBalance !== undefined) await createBalanceAdjustment(userId, id, openingBalance);
  const [account] = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  if (current.icon !== account?.icon) {
    await deleteUploadIfUnreferenced(userId, "account-images", current.icon).catch((error) => console.error("Account image cleanup failed", { userId, id, error }));
  }
  return NextResponse.json({ account: account ? { ...account, currentBalance: normalizeMoney(account.currentBalance) } : account });
}

export async function DELETE(request: Request, { params }: Context) {
  const userId = await requireAccessToken(request); const { id } = await params;
  if (!userId) return errorResponse("Authentication required", 401);
  const [current] = await db.select({ icon: accounts.icon }).from(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId))).limit(1);
  if (!current) return errorResponse("Account not found", 404);
  const detachmentStatement = await prepareStoredObjectDetachment(userId, "account-images", current.icon, "account", id);
  const deleteAccount = db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId))).returning({ id: accounts.id });
  await db.batch(detachmentStatement ? [deleteAccount, detachmentStatement] : [deleteAccount]);
  if (current) {
    await deleteUploadIfUnreferenced(userId, "account-images", current.icon).catch((error) => console.error("Account image cleanup failed", { userId, id, error }));
  }
  return NextResponse.json({ success: true });
}
