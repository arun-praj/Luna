import { randomUUID } from "node:crypto";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { accounts, transactions, users } from "@/backend/db/schema";
import { accountInput, accountOrderInput } from "@/backend/domain/validation";
import { hasDuplicateAccountName } from "@/backend/domain/account-rules";
import { normalizeMoney } from "@/lib/money";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const requestedMonth = new URL(request.url).searchParams.get("month");
  const month = requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)
    ? requestedMonth
    : new Date().toISOString().slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
  const monthStart = `${month}-01`;
  const nextMonthStart = `${nextMonth}-01`;
  const includeLoanAccounts = new URL(request.url).searchParams.get("includeLoanAccounts") === "true";
  const accountRows = await db
    .select()
    .from(accounts)
    .where(includeLoanAccounts ? eq(accounts.userId, userId) : and(eq(accounts.userId, userId), ne(accounts.type, "loan")))
    .orderBy(asc(accounts.displayOrder), asc(accounts.name))
    ;
  const monthlyRows = await db
    .select({
      accountId: transactions.accountId,
      type: transactions.type,
      total: sql<number>`round(coalesce(sum(${transactions.amount}), 0), 2)`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      sql`${transactions.date} >= ${monthStart}`,
      sql`${transactions.date} < ${nextMonthStart}`,
    ))
    .groupBy(transactions.accountId, transactions.type)
    ;
  const monthlyByAccount = new Map<string, { monthlyIncome: number; monthlyExpense: number }>();
  for (const row of monthlyRows) {
    if (!row.accountId || (row.type !== "income" && row.type !== "expense")) continue;
    const summary = monthlyByAccount.get(row.accountId) ?? { monthlyIncome: 0, monthlyExpense: 0 };
    if (row.type === "income") summary.monthlyIncome = Number(row.total ?? 0);
    if (row.type === "expense") summary.monthlyExpense = Number(row.total ?? 0);
    monthlyByAccount.set(row.accountId, summary);
  }
  return NextResponse.json({
    month,
    accounts: accountRows.map((account) => ({
      ...account,
      currentBalance: normalizeMoney(account.currentBalance),
      ...(monthlyByAccount.get(account.id) ?? { monthlyIncome: 0, monthlyExpense: 0 }),
    })),
  });
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = accountInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid account", 400);
  const { openingBalance, ...input } = parsed.data;
  const allowNegativeBalance = input.allowNegativeBalance ?? false;
  if ((openingBalance ?? 0) < 0 && !allowNegativeBalance) return errorResponse("Negative balances are disabled. Enable Allow negative balance to use a negative opening balance.", 400);
  const [user] = await db.select({ currency: users.currency }).from(users).where(eq(users.id, userId)).limit(1);
  const existingAccounts = await db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.userId, userId));
  if (hasDuplicateAccountName(existingAccounts, input.name)) return errorResponse("An account with this name already exists", 409);
  const id = randomUUID();
  const insertAccount = db.insert(accounts).values({ id, userId, name: input.name, type: input.type, currency: input.currency ?? user?.currency ?? "NPR", openingBalance: openingBalance ?? 0, currentBalance: openingBalance ?? 0, isDefault: input.isDefault ?? false, displayOrder: input.displayOrder ?? 0, backgroundColor: input.backgroundColor ?? null, icon: input.icon ?? null, includeInTotalBalance: input.includeInTotalBalance ?? true, allowNegativeBalance });
  if (input.isDefault) {
    await db.batch([
      db.update(accounts).set({ isDefault: false }).where(eq(accounts.userId, userId)),
      insertAccount,
    ]);
  } else {
    await db.batch([insertAccount]);
  }
  const [account] = await db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId))).limit(1);
  return NextResponse.json({ account: account ? { ...account, currentBalance: normalizeMoney(account.currentBalance) } : account }, { status: 201 });
}

export async function PATCH(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = accountOrderInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid account order", 400);
  const owned = (await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.userId, userId), ne(accounts.type, "loan")))).map((account) => account.id);
  const ownedSet = new Set(owned);
  const requested = parsed.data.accountIds;
  if (
    requested.length !== owned.length ||
    new Set(requested).size !== owned.length ||
    requested.some((id) => !ownedSet.has(id))
  ) return errorResponse("Account order does not match your accounts", 400);
  for (const [index, id] of requested.entries()) {
    await db.update(accounts).set({ displayOrder: index }).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  }
  return NextResponse.json({ accounts: await db.select().from(accounts).where(and(eq(accounts.userId, userId), ne(accounts.type, "loan"))).orderBy(asc(accounts.displayOrder), asc(accounts.name)) });
}
