import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { accounts, categories, dataExports, goals, notificationSettings, recurringTemplates, savingsInstrumentTypes, savingsInstruments, spendingBudgets, transactionHistory, transactions, userTags, users } from "@/backend/db/schema";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone, currency: users.currency, emailVerifiedAt: users.emailVerifiedAt, createdAt: users.createdAt, avatarPreset: users.avatarPreset }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return errorResponse("Authentication required", 401);
  const exportId = randomUUID();
  const requestedAt = new Date().toISOString();
  await db.insert(dataExports).values({ id: exportId, userId, emailSnapshot: user.email, format: "json", status: "requested", requestedAt, completedAt: null, bytes: null });
  try {
    const [userAccounts, userCategories, tags, settings, types, instruments, userGoals, budgets, templates, userTransactions] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.userId, userId)),
      db.select().from(categories).where(eq(categories.userId, userId)),
      db.select().from(userTags).where(eq(userTags.userId, userId)),
      db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId)),
      db.select().from(savingsInstrumentTypes).where(eq(savingsInstrumentTypes.userId, userId)),
      db.select().from(savingsInstruments).where(eq(savingsInstruments.userId, userId)),
      db.select().from(goals).where(eq(goals.userId, userId)),
      db.select().from(spendingBudgets).where(eq(spendingBudgets.userId, userId)),
      db.select().from(recurringTemplates).where(eq(recurringTemplates.userId, userId)),
      db.select().from(transactions).where(eq(transactions.userId, userId)),
    ]);
    const history = userTransactions.length ? await db.select().from(transactionHistory).where(inArray(transactionHistory.transactionId, userTransactions.map((transaction) => transaction.id))) : [];
    const payload = { exportedAt: requestedAt, user, accounts: userAccounts, categories: userCategories, tags, notificationSettings: settings, savingsInstrumentTypes: types, savingsInstruments: instruments, goals: userGoals, budgets, recurringTemplates: templates, transactions: userTransactions, transactionHistory: history };
    const body = JSON.stringify(payload, null, 2);
    const bytes = Buffer.byteLength(body, "utf8");
    await db.update(dataExports).set({ status: "completed", completedAt: new Date().toISOString(), bytes }).where(and(eq(dataExports.id, exportId), eq(dataExports.userId, userId)));
    return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="luna-data-export-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" } });
  } catch {
    await db.update(dataExports).set({ status: "failed", completedAt: new Date().toISOString() }).where(eq(dataExports.id, exportId));
    return errorResponse("We could not prepare your export. Please try again.", 500);
  }
}
