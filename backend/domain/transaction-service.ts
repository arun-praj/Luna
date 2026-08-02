import { randomUUID } from "node:crypto";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { accounts, categories, goals, recurringTemplates, savingsInstruments, transactionHistory, transactions } from "@/backend/db/schema";
import type { z } from "zod";
import { transactionInput } from "@/backend/domain/validation";

export type TransactionInput = z.infer<typeof transactionInput>;
type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const BALANCE_ADJUSTMENT_CATEGORY = "Balance adjustment";

export function serializeTransaction(row: typeof transactions.$inferSelect) {
  return { ...row, tags: JSON.parse(row.tags) as string[] };
}

function balanceDelta(type: typeof transactions.$inferSelect["type"], amount: number) {
  return type === "income" || type === "adjust_balance" ? amount : -amount;
}

type AccountBalanceChange = {
  accountId: string;
  type: typeof transactions.$inferSelect["type"];
  amount: number;
  transferToAccountId?: string | null;
  direction: 1 | -1;
};

async function assertProjectedAccountBalances(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  changes: AccountBalanceChange[],
) {
  const deltas = new Map<string, number>();
  for (const change of changes) {
    const delta = balanceDelta(change.type, change.amount) * change.direction;
    deltas.set(change.accountId, (deltas.get(change.accountId) ?? 0) + delta);
    if (change.type === "transfer" && change.transferToAccountId) {
      deltas.set(change.transferToAccountId, (deltas.get(change.transferToAccountId) ?? 0) - delta);
    }
  }
  for (const [accountId, delta] of deltas) {
    const [account] = await tx.select().from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId))).limit(1);
    if (!account) throw new Error("Account not found");
    if (!account.allowNegativeBalance && account.currentBalance + delta < -0.000001) {
      throw new Error(`Account "${account.name}" cannot go below zero. Enable Allow negative balance in account settings.`);
    }
  }
}

function assertPositiveAmount(input: TransactionInput) {
  if (input.type !== "adjust_balance" && input.amount <= 0) throw new Error("Transaction amount must be positive");
}

async function assertReferences(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string, input: TransactionInput) {
  const [account] = await tx.select().from(accounts).where(and(eq(accounts.id, input.accountId), eq(accounts.userId, userId))).limit(1);
  if (!account) throw new Error("Account not found");
  if (input.transferToAccountId) {
    const [target] = await tx.select().from(accounts).where(and(eq(accounts.id, input.transferToAccountId), eq(accounts.userId, userId))).limit(1);
    if (!target) throw new Error("Transfer account not found");
    if (target.id === account.id) throw new Error("Transfer accounts must be different");
  }
  if (input.type === "transfer" && !input.transferToAccountId) throw new Error("Transfer account is required");
  if (input.type !== "transfer" && input.transferToAccountId) throw new Error("Transfer account is only valid for transfers");
  if (input.categoryId) {
    const [category] = await tx.select().from(categories).where(and(eq(categories.id, input.categoryId), or(eq(categories.userId, userId), isNull(categories.userId)))).limit(1);
    if (!category) throw new Error("Category not found");
  }
  if (input.recurringTemplateId) {
    const [template] = await tx.select().from(recurringTemplates).where(and(eq(recurringTemplates.id, input.recurringTemplateId), eq(recurringTemplates.userId, userId))).limit(1);
    if (!template) throw new Error("Recurring template not found");
  }
  if (input.goalId) {
    const [goal] = await tx.select().from(goals).where(and(eq(goals.id, input.goalId), eq(goals.userId, userId))).limit(1);
    if (!goal) throw new Error("Goal not found");
  }
  if (input.savingsInstrumentId) {
    const [instrument] = await tx.select().from(savingsInstruments).where(and(eq(savingsInstruments.id, input.savingsInstrumentId), eq(savingsInstruments.userId, userId))).limit(1);
    if (!instrument) throw new Error("Savings instrument not found");
  }
}

async function applyEffect(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], row: typeof transactions.$inferSelect, direction: 1 | -1) {
  const delta = balanceDelta(row.type, row.amount) * direction;
  await tx.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} + ${delta}` }).where(eq(accounts.id, row.accountId));
  if (row.type === "transfer" && row.transferToAccountId) await tx.update(accounts).set({ currentBalance: sql`${accounts.currentBalance} + ${-delta}` }).where(eq(accounts.id, row.transferToAccountId));
  if (row.goalId) {
    await tx.update(goals).set({ allocatedAmount: sql`${goals.allocatedAmount} + ${row.amount * direction}` }).where(eq(goals.id, row.goalId));
    const [goal] = await tx.select().from(goals).where(eq(goals.id, row.goalId)).limit(1);
    if (goal) await tx.update(goals).set({ status: goal.allocatedAmount >= goal.targetAmount ? "completed" : "active" }).where(eq(goals.id, goal.id));
  }
  if (row.savingsInstrumentId && row.type === "savings") await tx.update(savingsInstruments).set({ currentBalance: sql`${savingsInstruments.currentBalance} + ${row.amount * direction}` }).where(eq(savingsInstruments.id, row.savingsInstrumentId));
}

async function history(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], transactionId: string, userId: string, changeType: "created" | "updated" | "deleted", oldValues?: unknown, newValues?: unknown) {
  await tx.insert(transactionHistory).values({ id: randomUUID(), transactionId, changedBy: userId, changeType, oldValues: oldValues ? JSON.stringify(oldValues) : null, newValues: newValues ? JSON.stringify(newValues) : null, changedAt: new Date().toISOString() });
}

async function getOrCreateBalanceAdjustmentCategory(tx: DatabaseTransaction, userId: string) {
  const [existing] = await tx
    .select()
    .from(categories)
    .where(and(
      eq(categories.userId, userId),
      eq(categories.name, BALANCE_ADJUSTMENT_CATEGORY),
      eq(categories.type, "expense"),
    ))
    .limit(1);
  if (existing) return existing;

  const [created] = await tx.insert(categories).values({
    id: randomUUID(),
    userId,
    name: BALANCE_ADJUSTMENT_CATEGORY,
    type: "expense",
    icon: "Cash",
    color: "#e3eee9",
  }).returning();
  if (!created) throw new Error("Unable to create the balance adjustment category");
  return created;
}

export async function createBalanceAdjustment(
  tx: DatabaseTransaction,
  userId: string,
  accountId: string,
  nextBalance: number,
) {
  const [account] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);
  if (!account) throw new Error("Account not found");

  const amount = nextBalance - account.currentBalance;
  if (Math.abs(amount) < 0.000001) return null;

  await assertProjectedAccountBalances(tx, userId, [{
    accountId,
    type: "adjust_balance",
    amount,
    direction: 1,
  }]);

  const category = await getOrCreateBalanceAdjustmentCategory(tx, userId);
  const timestamp = new Date().toISOString();
  const [created] = await tx.insert(transactions).values({
    id: randomUUID(),
    userId,
    accountId,
    type: "adjust_balance",
    amount,
    categoryId: category.id,
    title: BALANCE_ADJUSTMENT_CATEGORY,
    notes: `Balance changed from ${account.currentBalance} to ${nextBalance}.`,
    tags: "[]",
    isRecurring: false,
    recurringTemplateId: null,
    receiptImageUrl: null,
    goalId: null,
    savingsInstrumentId: null,
    transferToAccountId: null,
    date: timestamp.slice(0, 10),
    transactionAt: timestamp,
    syncStatus: "synced",
    clientGeneratedId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).returning();
  if (!created) throw new Error("Unable to create the balance adjustment transaction");

  await applyEffect(tx, created, 1);
  await history(tx, created.id, userId, "created", undefined, serializeTransaction(created));
  return created;
}

export async function createTransaction(userId: string, input: TransactionInput) {
  assertPositiveAmount(input);
  return db.transaction(async (tx) => {
    if (input.clientGeneratedId) {
      const [existing] = await tx.select().from(transactions).where(eq(transactions.clientGeneratedId, input.clientGeneratedId)).limit(1);
      if (existing && existing.userId === userId) return existing;
    }
    await assertReferences(tx, userId, input);
    await assertProjectedAccountBalances(tx, userId, [{ accountId: input.accountId, type: input.type, amount: input.amount, transferToAccountId: input.transferToAccountId, direction: 1 }]);
    const timestamp = new Date().toISOString();
    const row = {
      id: randomUUID(), userId, accountId: input.accountId, type: input.type, amount: input.amount,
      categoryId: input.categoryId ?? null, title: input.title, notes: input.notes ?? null, tags: JSON.stringify(input.tags ?? []),
      isRecurring: input.isRecurring ?? false, recurringTemplateId: input.recurringTemplateId ?? null,
      receiptImageUrl: input.receiptImageUrl ?? null, goalId: input.goalId ?? null,
      savingsInstrumentId: input.savingsInstrumentId ?? null, transferToAccountId: input.transferToAccountId ?? null,
      date: input.date, transactionAt: input.transactionAt ?? `${input.date}T12:00:00.000Z`, syncStatus: "synced" as const, clientGeneratedId: input.clientGeneratedId ?? null,
      createdAt: timestamp, updatedAt: timestamp,
    };
    const [created] = await tx.insert(transactions).values(row).returning();
    if (!created) throw new Error("Unable to create transaction");
    await applyEffect(tx, created, 1);
    await history(tx, created.id, userId, "created", undefined, serializeTransaction(created));
    return created;
  });
}

export async function updateTransaction(userId: string, id: string, input: TransactionInput) {
  assertPositiveAmount(input);
  return db.transaction(async (tx) => {
    const [old] = await tx.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId))).limit(1);
    if (!old) throw new Error("Transaction not found");
    await assertReferences(tx, userId, input);
    await assertProjectedAccountBalances(tx, userId, [
      { accountId: old.accountId, type: old.type, amount: old.amount, transferToAccountId: old.transferToAccountId, direction: -1 },
      { accountId: input.accountId, type: input.type, amount: input.amount, transferToAccountId: input.transferToAccountId, direction: 1 },
    ]);
    await applyEffect(tx, old, -1);
    const updatedAt = new Date().toISOString();
    const [next] = await tx.update(transactions).set({ accountId: input.accountId, type: input.type, amount: input.amount, categoryId: input.categoryId ?? null, title: input.title, notes: input.notes ?? null, tags: JSON.stringify(input.tags ?? []), isRecurring: input.isRecurring ?? false, recurringTemplateId: input.recurringTemplateId ?? null, receiptImageUrl: input.receiptImageUrl ?? null, goalId: input.goalId ?? null, savingsInstrumentId: input.savingsInstrumentId ?? null, transferToAccountId: input.transferToAccountId ?? null, date: input.date, transactionAt: input.transactionAt ?? `${input.date}T12:00:00.000Z`, updatedAt }).where(eq(transactions.id, id)).returning();
    if (!next) throw new Error("Unable to update transaction");
    await applyEffect(tx, next, 1);
    await history(tx, id, userId, "updated", serializeTransaction(old), serializeTransaction(next));
    return next;
  });
}

export async function deleteTransaction(userId: string, id: string) {
  return db.transaction(async (tx) => {
    const [old] = await tx.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId))).limit(1);
    if (!old) throw new Error("Transaction not found");
    await assertProjectedAccountBalances(tx, userId, [{ accountId: old.accountId, type: old.type, amount: old.amount, transferToAccountId: old.transferToAccountId, direction: -1 }]);
    await applyEffect(tx, old, -1);
    await history(tx, id, userId, "deleted", serializeTransaction(old));
    await tx.delete(transactions).where(eq(transactions.id, id));
    return old;
  });
}
