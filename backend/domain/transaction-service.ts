import { randomUUID } from "node:crypto";
import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { accounts, categories, goals, recurringTemplates, savingsInstruments, transactionHistory, transactions } from "@/backend/db/schema";
import { savingsInstrumentReferenceError } from "@/backend/domain/transaction-semantics";
import type { z } from "zod";
import { transactionInput } from "@/backend/domain/validation";
import { addMoney, normalizeMoney, subtractMoney } from "@/lib/money";
import { prepareStoredObjectAttachment, prepareStoredObjectDetachment } from "@/backend/storage/upload-lifecycle";

export type TransactionInput = z.infer<typeof transactionInput>;
type DatabaseExecutor = typeof db;
type BatchStatement = Parameters<typeof db.batch>[0][number];
type TransactionRow = typeof transactions.$inferSelect;
type TransactionChange = {
  row: TransactionRow;
  direction: 1 | -1;
};

const BALANCE_ADJUSTMENT_CATEGORY = "Balance adjustment";

function normalizeTransactionAt(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

export function serializeTransaction(row: TransactionRow) {
  return {
    ...row,
    amount: normalizeMoney(row.amount),
    tags: JSON.parse(row.tags) as string[],
    splits: (JSON.parse(row.splits) as Array<{ categoryId: string; amount: number; note?: string | null }>).map((split) => ({
      ...split,
      amount: normalizeMoney(split.amount),
    })),
  };
}

function balanceDelta(type: TransactionRow["type"], amount: number) {
  if (type === "goal_spend") return 0;
  return normalizeMoney(type === "income" || type === "adjust_balance" ? amount : -amount);
}

function goalAllocationDelta(type: TransactionRow["type"], amount: number) {
  if (type === "savings" || type === "goal_spend") {
    return normalizeMoney(type === "goal_spend" ? -amount : amount);
  }
  return 0;
}

function instrumentDelta(row: TransactionRow, direction: 1 | -1) {
  if (row.type !== "savings" || !row.savingsInstrumentId) return 0;
  return direction === 1 ? row.amount : -row.amount;
}

function executeBatch(statements: BatchStatement[]) {
  if (!statements.length) return Promise.resolve([]);
  return db.batch(statements as [BatchStatement, ...BatchStatement[]]);
}

function isAtomicPreconditionError(error: unknown) {
  return error instanceof Error && error.message.includes("transaction_history.id");
}

async function executeFinancialBatch(statements: BatchStatement[]) {
  try {
    return await executeBatch(statements);
  } catch (error) {
    if (isAtomicPreconditionError(error)) {
      throw new Error("Financial data changed while saving. Please retry.");
    }
    throw error;
  }
}

/**
 * D1 batch() is the transaction boundary. D1 does not expose a conditional
 * rollback primitive, so a failed compare-and-set is converted into a
 * deliberately rolled-back unique-key violation inside the same batch.
 */
function addAtomicGuard(statements: BatchStatement[], transactionId: string, userId: string, condition: SQL, timestamp: string, source: "transaction" | "goal" = "transaction") {
  const guardId = randomUUID();
  const guardValues = {
    id: sql<string>`${guardId}`.as("id"),
    transactionId: sql<string>`${transactionId}`.as("transaction_id"),
    changedBy: sql<string>`${userId}`.as("changed_by"),
    changeType: sql<"created">`'created'`.as("change_type"),
    oldValues: sql<string | null>`NULL`.as("old_values"),
    newValues: sql<string | null>`NULL`.as("new_values"),
    changedAt: sql<string>`${timestamp}`.as("changed_at"),
  };
  const guardInsert = source === "goal"
    ? db.insert(transactionHistory).select(db.select(guardValues).from(goals).where(and(eq(goals.userId, userId), sql`NOT (${condition})`)))
    : db.insert(transactionHistory).select(db.select(guardValues).from(transactions).where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId), sql`NOT (${condition})`)));
  const guardRollback = db.insert(transactionHistory).select(db.select({
    id: transactionHistory.id,
    transactionId: transactionHistory.transactionId,
    changedBy: transactionHistory.changedBy,
    changeType: transactionHistory.changeType,
    oldValues: transactionHistory.oldValues,
    newValues: transactionHistory.newValues,
    changedAt: transactionHistory.changedAt,
  }).from(transactionHistory).where(eq(transactionHistory.id, guardId)));
  statements.push(guardInsert, guardRollback);
}

function assertPositiveAmount(input: TransactionInput) {
  if (input.type === "adjust_balance") {
    if (Math.abs(input.amount) < 0.000001) throw new Error("Balance adjustment must change the balance");
    return;
  }
  if (input.type === "savings" && input.goalId) {
    if (Math.abs(input.amount) < 0.000001) throw new Error("Goal amount must be greater than zero");
    return;
  }
  if (input.amount <= 0) throw new Error("Transaction amount must be positive");
}

async function assertReferences(tx: DatabaseExecutor, userId: string, input: TransactionInput) {
  const [account] = await tx.select().from(accounts).where(and(eq(accounts.id, input.accountId), eq(accounts.userId, userId))).limit(1);
  if (!account) throw new Error("Account not found");
  let goal: typeof goals.$inferSelect | undefined;
  if (input.goalId) {
    [goal] = await tx.select().from(goals).where(and(eq(goals.id, input.goalId), eq(goals.userId, userId))).limit(1);
    if (!goal) throw new Error("Goal not found");
  }
  if (input.transferToAccountId) {
    const [target] = await tx.select().from(accounts).where(and(eq(accounts.id, input.transferToAccountId), eq(accounts.userId, userId))).limit(1);
    if (!target) throw new Error("Transfer account not found");
    if (target.id === account.id) throw new Error("Transfer accounts must be different");
    if ((input.type === "transfer" || (input.type === "savings" && input.goalId)) && target.currency !== account.currency) {
      throw new Error(`Goal transfers must use the same currency. Both accounts must use ${account.currency}.`);
    }
  }
  if (input.type === "transfer" && !input.transferToAccountId) throw new Error("Transfer account is required");
  if (input.type !== "transfer" && !(input.type === "savings" && input.goalId) && input.transferToAccountId) throw new Error("Transfer account is only valid for transfers");
  if (input.goalId && input.type !== "savings" && input.type !== "goal_spend") throw new Error("Goals can only be linked to savings or goal spend transactions");
  if (input.type === "goal_spend" && !input.goalId) throw new Error("Goal is required for goal spending");
  if (input.type === "savings" && input.goalId) {
    if (!goal?.accountId) throw new Error("Assign a goal account before moving funds");
    if (!input.transferToAccountId) throw new Error("Goal account is required");
    if (input.transferToAccountId !== goal.accountId) throw new Error("Funds must move through this goal's account");
  }
  if (input.type === "goal_spend") {
    if (!goal?.accountId) throw new Error("Assign a goal account before marking it as spent");
    if (input.accountId !== goal.accountId) throw new Error("Goal spending must reference the goal account");
    if (input.transferToAccountId) throw new Error("Goal spending cannot transfer funds");
  }
  if (input.categoryId) {
    const [category] = await tx.select().from(categories).where(and(eq(categories.id, input.categoryId), or(eq(categories.userId, userId), isNull(categories.userId)))).limit(1);
    if (!category) throw new Error("Category not found");
  }
  for (const split of input.splits ?? []) {
    const [category] = await tx.select().from(categories).where(and(eq(categories.id, split.categoryId), or(eq(categories.userId, userId), isNull(categories.userId)))).limit(1);
    if (!category) throw new Error("Split category not found");
  }
  if (input.recurringTemplateId) {
    const [template] = await tx.select().from(recurringTemplates).where(and(eq(recurringTemplates.id, input.recurringTemplateId), eq(recurringTemplates.userId, userId))).limit(1);
    if (!template) throw new Error("Recurring template not found");
  }
  if (goal && input.type === "savings" && goal.status === "archived") throw new Error("Archived goals cannot receive or return funds");
  if (input.savingsInstrumentId) {
    const instrumentReferenceError = savingsInstrumentReferenceError(input.type);
    if (instrumentReferenceError) throw new Error(instrumentReferenceError);
    const [instrument] = await tx.select().from(savingsInstruments).where(and(eq(savingsInstruments.id, input.savingsInstrumentId), eq(savingsInstruments.userId, userId))).limit(1);
    if (!instrument) throw new Error("Savings instrument not found");
  }
}

type AccountBalanceChange = {
  accountId: string;
  type: TransactionRow["type"];
  amount: number;
  transferToAccountId?: string | null;
  direction: 1 | -1;
};

function accountChanges(changes: TransactionChange[]): AccountBalanceChange[] {
  return changes.map(({ row, direction }) => ({
    accountId: row.accountId,
    type: row.type,
    amount: row.amount,
    transferToAccountId: row.transferToAccountId,
    direction,
  }));
}

async function assertProjectedAccountBalances(tx: DatabaseExecutor, userId: string, changes: AccountBalanceChange[]) {
  const deltas = new Map<string, number>();
  for (const change of changes) {
    const delta = change.direction === 1 ? balanceDelta(change.type, change.amount) : -balanceDelta(change.type, change.amount);
    deltas.set(change.accountId, addMoney(deltas.get(change.accountId) ?? 0, delta));
    if ((change.type === "transfer" || change.type === "savings") && change.transferToAccountId) {
      deltas.set(change.transferToAccountId, addMoney(deltas.get(change.transferToAccountId) ?? 0, -delta));
    }
  }
  for (const [accountId, delta] of deltas) {
    const [account] = await tx.select().from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId))).limit(1);
    if (!account) throw new Error("Account not found");
    if (!account.allowNegativeBalance && addMoney(account.currentBalance, delta) < 0) {
      throw new Error(`Account "${account.name}" cannot go below zero. Enable Allow negative balance in account settings.`);
    }
  }
}

async function assertProjectedGoalAllocations(tx: DatabaseExecutor, userId: string, changes: TransactionChange[]) {
  const deltas = new Map<string, number>();
  for (const { row, direction } of changes) {
    if (!row.goalId) continue;
    const baseDelta = goalAllocationDelta(row.type, row.amount);
    const delta = direction === 1 ? baseDelta : -baseDelta;
    if (delta === 0) continue;
    deltas.set(row.goalId, addMoney(deltas.get(row.goalId) ?? 0, delta));
  }
  for (const [goalId, delta] of deltas) {
    const [goal] = await tx.select().from(goals).where(and(eq(goals.id, goalId), eq(goals.userId, userId))).limit(1);
    if (!goal) throw new Error("Goal not found");
    if (addMoney(goal.allocatedAmount, delta) < 0) throw new Error(`Goal "${goal.name}" cannot have a negative allocation.`);
  }
}

async function assertGoalActionForCreate(tx: DatabaseExecutor, userId: string, input: TransactionInput) {
  if (!input.goalId) return;
  const [goal] = await tx.select().from(goals).where(and(eq(goals.id, input.goalId), eq(goals.userId, userId))).limit(1);
  if (!goal) throw new Error("Goal not found");
  if (input.type === "goal_spend") {
    if (goal.status !== "completed") throw new Error("A goal must be fully funded before it can be marked as spent");
    if (input.amount > normalizeMoney(goal.allocatedAmount)) throw new Error("Spend amount cannot exceed the goal allocation");
  }
  if (input.type === "savings" && input.amount < 0 && addMoney(goal.allocatedAmount, input.amount) < 0) {
    throw new Error("Withdrawal cannot exceed the goal allocation");
  }
}

async function assertGoalActionForUpdate(tx: DatabaseExecutor, userId: string, old: TransactionRow, input: TransactionInput) {
  if (input.type !== "goal_spend" || !input.goalId) return;
  const [goal] = await tx.select().from(goals).where(and(eq(goals.id, input.goalId), eq(goals.userId, userId))).limit(1);
  if (!goal) throw new Error("Goal not found");
  const allocationAfterReversingOld = subtractMoney(goal.allocatedAmount, old.goalId === goal.id ? goalAllocationDelta(old.type, old.amount) : 0);
  if (allocationAfterReversingOld < goal.targetAmount) throw new Error("A goal must be fully funded before it can be marked as spent");
  if (input.amount > allocationAfterReversingOld) throw new Error("Spend amount cannot exceed the goal allocation");
}

function goalActionCondition(input: TransactionInput, old?: TransactionRow) {
  if (!input.goalId) return null;
  const oldContribution = old && old.goalId === input.goalId ? goalAllocationDelta(old.type, old.amount) : 0;
  const available = sql`round(${goals.allocatedAmount} - ${oldContribution}, 2)`;
  if (input.type === "goal_spend") return sql`${available} >= ${input.amount} AND ${available} >= ${goals.targetAmount}`;
  if (input.type === "savings" && input.amount < 0) return sql`${available} + ${input.amount} >= 0`;
  return null;
}

async function getSnapshots(userId: string) {
  const [accountRows, goalRows, instrumentRows] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(goals).where(eq(goals.userId, userId)),
    db.select().from(savingsInstruments).where(eq(savingsInstruments.userId, userId)),
  ]);
  return {
    accounts: new Map(accountRows.map((row) => [row.id, row])),
    goals: new Map(goalRows.map((row) => [row.id, row])),
    instruments: new Map(instrumentRows.map((row) => [row.id, row])),
  };
}

function buildEffectStatements(
  statements: BatchStatement[],
  transactionId: string,
  userId: string,
  timestamp: string,
  changes: TransactionChange[],
  snapshots: Awaited<ReturnType<typeof getSnapshots>>,
  goalActions: Map<string, SQL>,
) {
  const accountDeltas = new Map<string, number>();
  const goalDeltas = new Map<string, number>();
  const instrumentDeltas = new Map<string, number>();
  const goalSpendApplied = new Map<string, boolean>();

  for (const { row, direction } of changes) {
    const sourceDelta = direction === 1 ? balanceDelta(row.type, row.amount) : -balanceDelta(row.type, row.amount);
    accountDeltas.set(row.accountId, addMoney(accountDeltas.get(row.accountId) ?? 0, sourceDelta));
    if ((row.type === "transfer" || row.type === "savings") && row.transferToAccountId) {
      accountDeltas.set(row.transferToAccountId, addMoney(accountDeltas.get(row.transferToAccountId) ?? 0, -sourceDelta));
    }
    if (row.goalId) {
      const goalDelta = direction === 1 ? goalAllocationDelta(row.type, row.amount) : -goalAllocationDelta(row.type, row.amount);
      goalDeltas.set(row.goalId, addMoney(goalDeltas.get(row.goalId) ?? 0, goalDelta));
      if (row.type === "goal_spend") goalSpendApplied.set(row.goalId, direction === 1);
    }
    if (row.savingsInstrumentId) {
      instrumentDeltas.set(row.savingsInstrumentId, addMoney(instrumentDeltas.get(row.savingsInstrumentId) ?? 0, instrumentDelta(row, direction)));
    }
  }

  for (const [accountId, delta] of accountDeltas) {
    if (delta === 0) continue;
    const account = snapshots.accounts.get(accountId);
    if (!account) throw new Error("Account not found");
    const where = and(
      eq(accounts.id, accountId),
      eq(accounts.userId, userId),
      sql`round(${accounts.currentBalance}, 2) = round(${normalizeMoney(account.currentBalance)}, 2)`,
      or(eq(accounts.allowNegativeBalance, true), sql`round(${accounts.currentBalance} + ${delta}, 2) >= 0`),
    );
    statements.push(db.update(accounts).set({ currentBalance: sql`round(${accounts.currentBalance} + ${delta}, 2)` }).where(where));
    addAtomicGuard(statements, transactionId, userId, sql`changes() = 1`, timestamp);
  }

  for (const [goalId, delta] of goalDeltas) {
    const goal = snapshots.goals.get(goalId);
    if (!goal) throw new Error("Goal not found");
    const finalAllocation = sql`round(${goals.allocatedAmount} + ${delta}, 2)`;
    const status = goalSpendApplied.get(goalId)
      ? sql`CASE WHEN ${finalAllocation} <= 0 THEN 'archived' WHEN ${finalAllocation} >= ${goals.targetAmount} THEN 'completed' ELSE 'active' END`
      : sql`CASE WHEN ${finalAllocation} >= ${goals.targetAmount} THEN 'completed' ELSE 'active' END`;
    const conditions = [
      eq(goals.id, goalId),
      eq(goals.userId, userId),
      sql`round(${goals.allocatedAmount}, 2) = round(${normalizeMoney(goal.allocatedAmount)}, 2)`,
      sql`${finalAllocation} >= 0`,
    ];
    const action = goalActions.get(goalId);
    if (action) conditions.push(action);
    statements.push(db.update(goals).set({ allocatedAmount: finalAllocation, status: status as never }).where(and(...conditions)));
    addAtomicGuard(statements, transactionId, userId, sql`changes() = 1`, timestamp);
  }

  for (const [goalId, condition] of goalActions) {
    if (goalDeltas.has(goalId)) continue;
    const goal = snapshots.goals.get(goalId);
    if (!goal) throw new Error("Goal not found");
    const actionCondition = and(eq(goals.id, goalId), eq(goals.userId, userId), condition!) ?? sql`0`;
    addAtomicGuard(statements, transactionId, userId, actionCondition, timestamp, "goal");
  }

  for (const [instrumentId, delta] of instrumentDeltas) {
    if (delta === 0) continue;
    const instrument = snapshots.instruments.get(instrumentId);
    if (!instrument) throw new Error("Savings instrument not found");
    statements.push(db.update(savingsInstruments).set({ currentBalance: sql`round(${savingsInstruments.currentBalance} + ${delta}, 2)` }).where(and(
      eq(savingsInstruments.id, instrumentId),
      eq(savingsInstruments.userId, userId),
      sql`round(${savingsInstruments.currentBalance}, 2) = round(${normalizeMoney(instrument.currentBalance)}, 2)`,
    )));
    addAtomicGuard(statements, transactionId, userId, sql`changes() = 1`, timestamp);
  }
}

async function getBalanceAdjustmentCategory(userId: string) {
  const [existing] = await db.select().from(categories).where(and(
    eq(categories.userId, userId),
    eq(categories.name, BALANCE_ADJUSTMENT_CATEGORY),
    eq(categories.type, "expense"),
  )).limit(1);
  return existing;
}

async function commitCreatedTransaction(userId: string, row: TransactionRow, changes: TransactionChange[], goalActions = new Map<string, SQL>(), categoryToCreate?: typeof categories.$inferInsert, attachmentStatement?: BatchStatement | null) {
  const snapshots = await getSnapshots(userId);
  const timestamp = row.updatedAt;
  const statements: BatchStatement[] = [];
  if (categoryToCreate) statements.push(db.insert(categories).values(categoryToCreate));
  if (attachmentStatement) statements.push(attachmentStatement);
  statements.push(db.insert(transactions).values(row));
  addAtomicGuard(statements, row.id, userId, sql`changes() = 1`, timestamp);
  buildEffectStatements(statements, row.id, userId, timestamp, changes, snapshots, goalActions);
  statements.push(db.insert(transactionHistory).values({
    id: randomUUID(),
    transactionId: row.id,
    changedBy: userId,
    changeType: "created",
    oldValues: null,
    newValues: JSON.stringify(serializeTransaction(row)),
    changedAt: timestamp,
  }));
  await executeFinancialBatch(statements);
  return row;
}

export async function createBalanceAdjustment(userId: string, accountId: string, nextBalance: number) {
  const [account] = await db.select().from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId))).limit(1);
  if (!account) throw new Error("Account not found");
  const normalizedNextBalance = normalizeMoney(nextBalance);
  const amount = subtractMoney(normalizedNextBalance, account.currentBalance);
  if (amount === 0) return null;
  const timestamp = new Date().toISOString();
  const row = {
    id: randomUUID(), userId, accountId, type: "adjust_balance" as const, amount,
    categoryId: null, splits: "[]", title: BALANCE_ADJUSTMENT_CATEGORY, merchantName: null,
    notes: `Balance changed from ${normalizeMoney(account.currentBalance)} to ${normalizedNextBalance}.`, tags: "[]",
    isRecurring: false, recurringTemplateId: null, receiptImageUrl: null, goalId: null,
    savingsInstrumentId: null, transferToAccountId: null, date: timestamp.slice(0, 10),
    transactionAt: timestamp, syncStatus: "synced" as const, clientGeneratedId: null,
    createdAt: timestamp, updatedAt: timestamp,
  } as TransactionRow;
  const category = await getBalanceAdjustmentCategory(userId);
  const categoryId = category?.id ?? randomUUID();
  row.categoryId = categoryId;
  await assertProjectedAccountBalances(db, userId, [{ accountId, type: row.type, amount, direction: 1 }]);
  return commitCreatedTransaction(userId, row, [{ row, direction: 1 }], new Map(), category ? undefined : {
    id: categoryId, userId, name: BALANCE_ADJUSTMENT_CATEGORY, type: "expense", icon: "Cash", color: "#e3eee9",
  });
}

export async function createTransaction(userId: string, input: TransactionInput) {
  const normalizedInput = { ...input, amount: normalizeMoney(input.amount), splits: input.splits?.map((split) => ({ ...split, amount: normalizeMoney(split.amount) })) };
  assertPositiveAmount(normalizedInput);
  if (normalizedInput.clientGeneratedId) {
    const [existing] = await db.select().from(transactions).where(eq(transactions.clientGeneratedId, normalizedInput.clientGeneratedId)).limit(1);
    if (existing && existing.userId === userId) return existing;
  }
  await assertReferences(db, userId, normalizedInput);
  await assertGoalActionForCreate(db, userId, normalizedInput);
  const timestamp = new Date().toISOString();
  const row = {
    id: randomUUID(), userId, accountId: normalizedInput.accountId, type: normalizedInput.type, amount: normalizedInput.amount,
    categoryId: normalizedInput.splits?.length ? null : normalizedInput.categoryId ?? null, splits: JSON.stringify(normalizedInput.splits ?? []),
    title: normalizedInput.title, merchantName: normalizedInput.merchantName ?? null, notes: normalizedInput.notes ?? null,
    tags: JSON.stringify(normalizedInput.tags ?? []), isRecurring: normalizedInput.isRecurring ?? false,
    recurringTemplateId: normalizedInput.recurringTemplateId ?? null, receiptImageUrl: normalizedInput.receiptImageUrl ?? null,
    goalId: normalizedInput.goalId ?? null, savingsInstrumentId: normalizedInput.savingsInstrumentId ?? null,
    transferToAccountId: normalizedInput.transferToAccountId ?? null, date: normalizedInput.date,
    transactionAt: normalizeTransactionAt(normalizedInput.transactionAt, timestamp), syncStatus: "synced" as const,
    clientGeneratedId: normalizedInput.clientGeneratedId ?? null, createdAt: timestamp, updatedAt: timestamp,
  } as TransactionRow;
  const changes = [{ row, direction: 1 as const }];
  await assertProjectedGoalAllocations(db, userId, changes);
  await assertProjectedAccountBalances(db, userId, accountChanges(changes));
  const goalActions = new Map<string, SQL>();
  const action = goalActionCondition(normalizedInput);
  if (normalizedInput.goalId && action) goalActions.set(normalizedInput.goalId, action);
  const attachmentStatement = await prepareStoredObjectAttachment(userId, "transaction-receipts", normalizedInput.receiptImageUrl, "transaction", row.id);
  return commitCreatedTransaction(userId, row, changes, goalActions, undefined, attachmentStatement);
}

function transactionCas(old: TransactionRow, userId: string) {
  return and(
    eq(transactions.id, old.id), eq(transactions.userId, userId), eq(transactions.updatedAt, old.updatedAt),
    eq(transactions.accountId, old.accountId), eq(transactions.type, old.type), eq(transactions.amount, old.amount),
    sql`${transactions.goalId} IS ${old.goalId}`,
    sql`${transactions.savingsInstrumentId} IS ${old.savingsInstrumentId}`,
    sql`${transactions.transferToAccountId} IS ${old.transferToAccountId}`,
  );
}

export async function updateTransaction(userId: string, id: string, input: TransactionInput) {
  const normalizedInput = { ...input, amount: normalizeMoney(input.amount), splits: input.splits?.map((split) => ({ ...split, amount: normalizeMoney(split.amount) })) };
  assertPositiveAmount(normalizedInput);
  const [old] = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId))).limit(1);
  if (!old) throw new Error("Transaction not found");
  if (old.loanPaymentEventId) throw new Error("Edit this transaction from its loan payment");
  await assertReferences(db, userId, normalizedInput);
  await assertGoalActionForUpdate(db, userId, old, normalizedInput);
  const next = {
    ...old, accountId: normalizedInput.accountId, type: normalizedInput.type, amount: normalizedInput.amount,
    categoryId: normalizedInput.splits?.length ? null : normalizedInput.categoryId ?? null, splits: JSON.stringify(normalizedInput.splits ?? []),
    title: normalizedInput.title, merchantName: normalizedInput.merchantName ?? null, notes: normalizedInput.notes ?? null,
    tags: JSON.stringify(normalizedInput.tags ?? []), isRecurring: normalizedInput.isRecurring ?? false,
    recurringTemplateId: normalizedInput.recurringTemplateId ?? null, receiptImageUrl: normalizedInput.receiptImageUrl ?? null,
    goalId: normalizedInput.goalId ?? null, savingsInstrumentId: normalizedInput.savingsInstrumentId ?? null,
    transferToAccountId: normalizedInput.transferToAccountId ?? null, date: normalizedInput.date,
    transactionAt: normalizeTransactionAt(normalizedInput.transactionAt ?? old.transactionAt, new Date().toISOString()),
    updatedAt: new Date().toISOString(),
  };
  const changes = [{ row: old, direction: -1 as const }, { row: next, direction: 1 as const }];
  await assertProjectedGoalAllocations(db, userId, changes);
  await assertProjectedAccountBalances(db, userId, accountChanges(changes));
  const snapshots = await getSnapshots(userId);
  const timestamp = next.updatedAt;
  const statements: BatchStatement[] = [];
  const goalActions = new Map<string, SQL>();
  const action = goalActionCondition(normalizedInput, old);
  if (normalizedInput.goalId && action) goalActions.set(normalizedInput.goalId, action);
  const attachmentStatement = await prepareStoredObjectAttachment(userId, "transaction-receipts", normalizedInput.receiptImageUrl, "transaction", id);
  const detachmentStatement = old.receiptImageUrl !== next.receiptImageUrl
    ? await prepareStoredObjectDetachment(userId, "transaction-receipts", old.receiptImageUrl, "transaction", id)
    : null;
  buildEffectStatements(statements, id, userId, timestamp, changes, snapshots, goalActions);
  if (attachmentStatement) statements.unshift(attachmentStatement);
  statements.push(db.update(transactions).set({
    accountId: next.accountId, type: next.type, amount: next.amount, categoryId: next.categoryId, splits: next.splits,
    title: next.title, merchantName: next.merchantName, notes: next.notes, tags: next.tags, isRecurring: next.isRecurring,
    recurringTemplateId: next.recurringTemplateId, receiptImageUrl: next.receiptImageUrl, goalId: next.goalId,
    savingsInstrumentId: next.savingsInstrumentId, transferToAccountId: next.transferToAccountId, date: next.date,
    transactionAt: next.transactionAt, updatedAt: next.updatedAt,
  }).where(transactionCas(old, userId)));
  if (detachmentStatement) statements.push(detachmentStatement);
  addAtomicGuard(statements, id, userId, sql`changes() = 1`, timestamp);
  statements.push(db.insert(transactionHistory).values({
    id: randomUUID(), transactionId: id, changedBy: userId, changeType: "updated",
    oldValues: JSON.stringify(serializeTransaction(old)), newValues: JSON.stringify(serializeTransaction(next)), changedAt: timestamp,
  }));
  await executeFinancialBatch(statements);
  return next;
}

export async function deleteTransaction(userId: string, id: string) {
  const [old] = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId))).limit(1);
  if (!old) throw new Error("Transaction not found");
  if (old.loanPaymentEventId) throw new Error("Reverse this transaction from its loan payment");
  const changes = [{ row: old, direction: -1 as const }];
  await assertProjectedGoalAllocations(db, userId, changes);
  await assertProjectedAccountBalances(db, userId, accountChanges(changes));
  const snapshots = await getSnapshots(userId);
  const timestamp = new Date().toISOString();
  const statements: BatchStatement[] = [];
  const detachmentStatement = await prepareStoredObjectDetachment(userId, "transaction-receipts", old.receiptImageUrl, "transaction", id);
  buildEffectStatements(statements, id, userId, timestamp, changes, snapshots, new Map());
  statements.push(db.insert(transactionHistory).values({
    id: randomUUID(), transactionId: id, changedBy: userId, changeType: "deleted",
    oldValues: JSON.stringify(serializeTransaction(old)), newValues: null, changedAt: timestamp,
  }));
  statements.push(db.delete(transactions).where(transactionCas(old, userId)));
  if (detachmentStatement) statements.push(detachmentStatement);
  addAtomicGuard(statements, id, userId, sql`changes() = 1`, timestamp);
  await executeFinancialBatch(statements);
  return old;
}
