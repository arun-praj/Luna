import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, lte, or } from "drizzle-orm";

import { db } from "@/backend/db/client";
import { accounts, categories, goals, recurringOccurrences, recurringTemplates } from "@/backend/db/schema";
import { shouldAdvanceRecurringTemplate } from "@/backend/domain/recurring-template-rules";
import { createTransaction } from "@/backend/domain/transaction-service";
import { addMoney } from "@/lib/money";

type RecurringTemplate = typeof recurringTemplates.$inferSelect;

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function nextRecurringDate(date: string, frequency: RecurringTemplate["frequency"]) {
  const [year, month, day] = date.split("-").map(Number);
  if (frequency === "daily") return dateOnly(new Date(Date.UTC(year, month - 1, day + 1)));
  if (frequency === "weekly") return dateOnly(new Date(Date.UTC(year, month - 1, day + 7)));
  if (frequency === "yearly") return dateOnly(new Date(Date.UTC(year + 1, month - 1, day)));
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate();
  return dateOnly(new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), Math.min(day, lastDay))));
}

function isPastOrToday(date: string, today: string) {
  return date <= today;
}

async function createOccurrence(template: RecurringTemplate, scheduledDate: string) {
  const existing = await db.select().from(recurringOccurrences).where(and(
    eq(recurringOccurrences.recurringTemplateId, template.id),
    eq(recurringOccurrences.scheduledDate, scheduledDate),
  )).limit(1);
  if (existing[0]) return existing[0];

  const timestamp = new Date().toISOString();
  const [created] = await db.insert(recurringOccurrences).values({
    id: randomUUID(),
    userId: template.userId,
    recurringTemplateId: template.id,
    scheduledDate,
    status: "pending",
    transactionId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).onConflictDoNothing().returning();
  if (created) return created;
  const [retried] = await db.select().from(recurringOccurrences).where(and(
    eq(recurringOccurrences.recurringTemplateId, template.id),
    eq(recurringOccurrences.scheduledDate, scheduledDate),
  )).limit(1);
  if (!retried) throw new Error("Unable to create recurring occurrence");
  return retried;
}

async function advanceTemplate(template: RecurringTemplate, fromDate: string) {
  if (!shouldAdvanceRecurringTemplate(template.nextDueDate, fromDate)) return;
  const nextDueDate = nextRecurringDate(fromDate, template.frequency);
  const isActive = !template.endDate || nextDueDate <= template.endDate;
  // An older occurrence may be acted on after cron or another device has
  // already moved the schedule forward. Only advance when the stored cursor
  // is still at or before the occurrence being handled.
  await db.update(recurringTemplates).set({ nextDueDate, isActive }).where(and(
    eq(recurringTemplates.id, template.id),
    lte(recurringTemplates.nextDueDate, fromDate),
  ));
}

async function postOccurrence(template: RecurringTemplate, occurrence: typeof recurringOccurrences.$inferSelect) {
  if (occurrence.status === "posted") return occurrence;
  if (occurrence.status === "skipped") throw new Error("This recurring occurrence was skipped");
  const [goal] = template.goalId
    ? await db.select({ monthlyContribution: goals.monthlyContribution }).from(goals).where(and(eq(goals.id, template.goalId), eq(goals.userId, template.userId))).limit(1)
    : [];
  const amount = goal?.monthlyContribution ?? template.amount;

  const transaction = await createTransaction(template.userId, {
    accountId: template.accountId,
    type: template.type,
    amount,
    categoryId: template.categoryId,
    title: template.title || "Recurring transaction",
    notes: template.notes,
    tags: [],
    isRecurring: true,
    recurringTemplateId: template.id,
    transferToAccountId: template.transferToAccountId,
    savingsInstrumentId: template.savingsInstrumentId,
    receiptImageUrl: null,
    goalId: template.goalId,
    date: occurrence.scheduledDate,
    transactionAt: `${occurrence.scheduledDate}T12:00:00.000Z`,
    clientGeneratedId: occurrence.id,
  });
  const updatedAt = new Date().toISOString();
  const [updated] = await db.update(recurringOccurrences).set({ status: "posted", transactionId: transaction.id, updatedAt }).where(eq(recurringOccurrences.id, occurrence.id)).returning();
  return updated ?? occurrence;
}

export async function ensureDueOccurrences(userId: string, now = new Date()) {
  const today = dateOnly(now);
  const templates = await db.select().from(recurringTemplates).where(and(eq(recurringTemplates.userId, userId), eq(recurringTemplates.isActive, true)));
  for (const template of templates) {
    let dueDate = template.nextDueDate;
    let iterations = 0;
    while (isPastOrToday(dueDate, today) && iterations < 366) {
      if (template.endDate && dueDate > template.endDate) {
        await db.update(recurringTemplates).set({ isActive: false }).where(eq(recurringTemplates.id, template.id));
        break;
      }
      const occurrence = await createOccurrence(template, dueDate);
      await advanceTemplate(template, dueDate);
      if (!template.approvalRequired && occurrence.status === "pending") {
        try { await postOccurrence(template, occurrence); } catch (error) {
          console.error("Recurring transaction could not be posted", { templateId: template.id, occurrenceId: occurrence.id, error: error instanceof Error ? error.message : String(error) });
        }
      }
      dueDate = nextRecurringDate(dueDate, template.frequency);
      iterations += 1;
    }
  }
}

export async function runScheduledRecurringTransactions(now = new Date()) {
  const templates = await db.select({ userId: recurringTemplates.userId }).from(recurringTemplates).where(eq(recurringTemplates.isActive, true));
  for (const userId of [...new Set(templates.map((template) => template.userId))]) await ensureDueOccurrences(userId, now);
}

export async function recurringOverview(userId: string, now = new Date()) {
  await ensureDueOccurrences(userId, now);
  const [templates, occurrences, accountRows, categoryRows] = await Promise.all([
    db.select().from(recurringTemplates).where(eq(recurringTemplates.userId, userId)).orderBy(asc(recurringTemplates.nextDueDate)),
    db.select().from(recurringOccurrences).where(eq(recurringOccurrences.userId, userId)).orderBy(asc(recurringOccurrences.scheduledDate)),
    db.select({ id: accounts.id, name: accounts.name, currency: accounts.currency, icon: accounts.icon, backgroundColor: accounts.backgroundColor }).from(accounts).where(eq(accounts.userId, userId)),
    db.select({ id: categories.id, name: categories.name, icon: categories.icon, color: categories.color }).from(categories).where(or(eq(categories.userId, userId), isNull(categories.userId))),
  ]);
  const goalRows = await db.select({ id: goals.id, name: goals.name, monthlyContribution: goals.monthlyContribution }).from(goals).where(eq(goals.userId, userId));
  const accountById = new Map(accountRows.map((row) => [row.id, row]));
  const categoryById = new Map(categoryRows.map((row) => [row.id, row]));
  const goalById = new Map(goalRows.map((row) => [row.id, row]));
  const occurrenceByTemplate = new Map<string, typeof occurrences>();
  for (const occurrence of occurrences) occurrenceByTemplate.set(occurrence.recurringTemplateId, [...(occurrenceByTemplate.get(occurrence.recurringTemplateId) ?? []), occurrence]);
  return templates.map((template) => ({
    ...template,
    amount: addMoney(template.goalId ? goalById.get(template.goalId)?.monthlyContribution ?? template.amount : template.amount, 0),
    account: accountById.get(template.accountId) ?? null,
    transferToAccount: template.transferToAccountId ? accountById.get(template.transferToAccountId) ?? null : null,
    category: template.categoryId ? categoryById.get(template.categoryId) ?? null : null,
    goal: template.goalId ? goalById.get(template.goalId) ?? null : null,
    occurrences: occurrenceByTemplate.get(template.id) ?? [],
  }));
}

export async function actOnRecurringTemplate(userId: string, templateId: string, action: "approve" | "post" | "skip" | "pause" | "resume", occurrenceId?: string) {
  const [template] = await db.select().from(recurringTemplates).where(and(eq(recurringTemplates.id, templateId), eq(recurringTemplates.userId, userId))).limit(1);
  if (!template) throw new Error("Recurring template not found");
  if (action === "pause" || action === "resume") {
    const [updated] = await db.update(recurringTemplates).set({ isActive: action === "resume" }).where(eq(recurringTemplates.id, template.id)).returning();
    return { template: updated };
  }
  await ensureDueOccurrences(userId);
  let occurrence = occurrenceId
    ? (await db.select().from(recurringOccurrences).where(and(eq(recurringOccurrences.id, occurrenceId), eq(recurringOccurrences.recurringTemplateId, template.id), eq(recurringOccurrences.userId, userId))).limit(1))[0]
    : (await db.select().from(recurringOccurrences).where(and(eq(recurringOccurrences.recurringTemplateId, template.id), eq(recurringOccurrences.status, "pending"))).orderBy(asc(recurringOccurrences.scheduledDate)).limit(1))[0];
  if (!occurrence && action === "post") {
    occurrence = await createOccurrence(template, template.nextDueDate);
    await advanceTemplate(template, template.nextDueDate);
  }
  if (!occurrence) throw new Error("No pending occurrence is ready");
  if (action === "skip") {
    if (occurrence.status === "posted") throw new Error("This recurring occurrence has already been posted");
    if (occurrence.status === "skipped") {
      await advanceTemplate(template, occurrence.scheduledDate);
      return { occurrence };
    }
    const [updated] = await db.update(recurringOccurrences).set({ status: "skipped", updatedAt: new Date().toISOString() }).where(and(
      eq(recurringOccurrences.id, occurrence.id),
      eq(recurringOccurrences.status, "pending"),
    )).returning();
    if (!updated) throw new Error("This recurring occurrence changed. Please refresh and try again.");
    await advanceTemplate(template, occurrence.scheduledDate);
    return { occurrence: updated };
  }
  const posted = await postOccurrence(template, occurrence);
  // A card can be acted on before its due date, so ensure manual posting also
  // advances the schedule when the cron path has not done so yet.
  await advanceTemplate(template, occurrence.scheduledDate);
  return { occurrence: posted };
}
