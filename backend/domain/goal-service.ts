import { and, asc, eq } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { accounts, goals } from "@/backend/db/schema";
import { createTransaction } from "@/backend/domain/transaction-service";

const EPSILON = 0.000001;

async function getGoal(userId: string, goalId: string) {
  const [goal] = await db.select().from(goals).where(and(eq(goals.id, goalId), eq(goals.userId, userId))).limit(1);
  if (!goal) throw new Error("Goal not found");
  return goal;
}

async function getUsableAccount(userId: string, accountId?: string) {
  const rows = await db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(asc(accounts.displayOrder), asc(accounts.name));
  const account = accountId ? rows.find((item) => item.id === accountId) : rows.find((item) => item.isDefault) ?? rows[0];
  if (accountId && !account) throw new Error("Account not found");
  if (!account) throw new Error("Create an account before using a goal");
  return account;
}

async function getGoalAccount(userId: string, goal: typeof goals.$inferSelect) {
  if (!goal.accountId) throw new Error("Assign a goal account before moving funds");
  const [account] = await db.select().from(accounts).where(and(eq(accounts.id, goal.accountId), eq(accounts.userId, userId))).limit(1);
  if (!account) throw new Error("The goal account no longer exists");
  return account;
}

function assertAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= EPSILON) throw new Error("Goal amount must be greater than zero");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function contributeToGoal(userId: string, goalId: string, accountId: string, amount: number, notes?: string | null) {
  const goal = await getGoal(userId, goalId);
  const goalAccount = await getGoalAccount(userId, goal);
  if (accountId === goalAccount.id) throw new Error("Choose a spendable account, not the goal account");
  assertAmount(amount);
  if (goal.status === "archived") throw new Error("Archived goals cannot receive funds");
  return createTransaction(userId, {
    accountId,
    type: "savings",
    amount,
    title: `Add funds · ${goal.name}`,
    notes: notes?.trim() || null,
    goalId,
    categoryId: null,
    tags: [],
    isRecurring: false,
    recurringTemplateId: null,
    receiptImageUrl: null,
    savingsInstrumentId: null,
    transferToAccountId: goalAccount.id,
    date: today(),
    transactionAt: new Date().toISOString(),
  });
}

export async function withdrawFromGoal(userId: string, goalId: string, amount: number, notes?: string | null, accountId?: string) {
  const goal = await getGoal(userId, goalId);
  const goalAccount = await getGoalAccount(userId, goal);
  assertAmount(amount);
  if (goal.status === "archived") throw new Error("Archived goals cannot return funds");
  if (amount > goal.allocatedAmount + EPSILON) throw new Error("Withdrawal cannot exceed the goal allocation");
  const account = await getUsableAccount(userId, accountId);
  if (account.id === goalAccount.id) throw new Error("Choose a receiving account, not the goal account");
  return createTransaction(userId, {
    accountId: account.id,
    type: "savings",
    amount: -amount,
    title: `Withdraw from goal · ${goal.name}`,
    notes: notes?.trim() || null,
    goalId,
    categoryId: null,
    tags: [],
    isRecurring: false,
    recurringTemplateId: null,
    receiptImageUrl: null,
    savingsInstrumentId: null,
    transferToAccountId: goalAccount.id,
    date: today(),
    transactionAt: new Date().toISOString(),
  });
}

export async function spendFromGoal(userId: string, goalId: string, amount: number, categoryId?: string | null, notes?: string | null) {
  const goal = await getGoal(userId, goalId);
  const goalAccount = await getGoalAccount(userId, goal);
  assertAmount(amount);
  if (goal.status !== "completed") throw new Error("A goal must be fully funded before it can be marked as spent");
  if (amount > goal.allocatedAmount + EPSILON) throw new Error("Spend amount cannot exceed the goal allocation");
  return createTransaction(userId, {
    accountId: goalAccount.id,
    type: "goal_spend",
    amount,
    title: `Spent · ${goal.name}`,
    notes: notes?.trim() || null,
    goalId,
    categoryId: categoryId ?? null,
    tags: [],
    isRecurring: false,
    recurringTemplateId: null,
    receiptImageUrl: null,
    savingsInstrumentId: null,
    transferToAccountId: null,
    date: today(),
    transactionAt: new Date().toISOString(),
  });
}
