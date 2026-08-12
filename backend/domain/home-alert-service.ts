import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/backend/db/client";
import {
  accounts,
  budgetAllocations,
  budgetPeriods,
  categories,
  goals,
  homeAlerts,
  loanInstallments,
  loans,
  recurringOccurrences,
  recurringTemplates,
  transactions,
  users,
} from "@/backend/db/schema";
import { formatCurrencyAmount } from "@/lib/currency";
import { addMoney, normalizeMoney } from "@/lib/money";
import {
  addDays,
  budgetAlertThreshold,
  daysUntil,
  previousPaymentAge,
  recurringFrequencyWindows,
  urgencyForDate,
} from "@/backend/domain/home-alert-rules";

export type HomeAlertKind = "budget" | "goal" | "loan" | "recurring";

export type HomeAlertPayload = {
  href: string;
  feature: "Budget" | "Goal" | "Loan" | "Recurring";
  kind: HomeAlertKind;
  label: string;
  value: string;
  detail: string;
  tone: "info" | "warning" | "primary";
  icon: "budget" | "goal" | "loan" | "recurring";
  progress?: number;
  goalId?: string;
  goalName?: string;
  recurringTemplateId?: string;
  occurrenceId?: string;
  loanId?: string;
  installmentId?: string;
  previousPayment?: string;
  action?: "goal" | "recurring" | "loan" | "budget";
};

type Candidate = {
  kind: HomeAlertKind;
  sourceId: string;
  occurrenceKey: string;
  showAt: string;
  expiresAt?: string | null;
  payload: HomeAlertPayload;
  hardUrgency: number;
  deterministicRank: number;
};

const aiOutputSchema = z.object({
  alerts: z.array(z.object({
    id: z.string().min(1),
    show: z.boolean(),
    rank: z.number().int().min(0).max(100),
    title: z.string().trim().min(1).max(120).optional(),
    detail: z.string().trim().min(1).max(180).optional(),
  })).max(100),
});

function dateOnly(now: Date) {
  return now.toISOString().slice(0, 10);
}

function dateAtStart(value: string) {
  return `${value}T00:00:00.000Z`;
}

function money(currency: string, value: number) {
  return `${currency} ${formatCurrencyAmount(normalizeMoney(value))}`;
}

function reminder(value: string, today: string) {
  const days = daysUntil(value, today);
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  return `Due ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`))}`;
}

function parsePayload(value: string) {
  try {
    return JSON.parse(value) as HomeAlertPayload;
  } catch {
    return null;
  }
}

async function buildCandidates(userId: string, now: Date): Promise<Candidate[]> {
  const today = dateOnly(now);
  const [user, accountRows, goalRows, loanRows, installmentRows, templateRows, occurrenceRows, budgetRows, recentTransactions] = await Promise.all([
    db.select({ currency: users.currency }).from(users).where(eq(users.id, userId)).limit(1),
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(goals).where(eq(goals.userId, userId)),
    db.select({ loan: loans, balance: accounts.currentBalance }).from(loans).innerJoin(accounts, eq(loans.accountId, accounts.id)).where(eq(loans.userId, userId)),
    db.select().from(loanInstallments),
    db.select().from(recurringTemplates).where(eq(recurringTemplates.userId, userId)),
    db.select().from(recurringOccurrences).where(eq(recurringOccurrences.userId, userId)),
    db.select({ allocation: budgetAllocations, budgetPeriod: budgetPeriods, category: categories })
      .from(budgetAllocations)
      .innerJoin(budgetPeriods, eq(budgetAllocations.periodId, budgetPeriods.id))
      .leftJoin(categories, eq(budgetAllocations.categoryId, categories.id))
      .where(and(eq(budgetPeriods.userId, userId), eq(budgetPeriods.status, "open"))),
    db.select().from(transactions).where(and(eq(transactions.userId, userId), gte(transactions.date, addDays(today, -366)), lte(transactions.date, today))),
  ]);
  const currency = user[0]?.currency ?? "NPR";
  const candidates: Candidate[] = [];
  const activeGoals = goalRows.filter((goal) => goal.status === "active" && goal.targetAmount > goal.allocatedAmount);

  for (const goal of activeGoals) {
    const progress = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.allocatedAmount / goal.targetAmount) * 100)) : 0;
    if (goal.targetDate) {
      const timing = urgencyForDate(goal.targetDate, today, 0);
      if (timing.hardUrgency > 0) {
        candidates.push({
          kind: "goal",
          sourceId: goal.id,
          occurrenceKey: `target:${goal.targetDate}`,
          showAt: dateAtStart(goal.targetDate),
          hardUrgency: timing.hardUrgency,
          deterministicRank: timing.rank,
          payload: {
            href: `/goals/${goal.id}`,
            feature: "Goal",
            kind: "goal",
            label: timing.hardUrgency === 3 ? "Goal date passed" : timing.hardUrgency === 2 ? "Goal due today" : "Goal due soon",
            value: `${money(currency, goal.allocatedAmount)} / ${formatCurrencyAmount(goal.targetAmount)}`,
            detail: `${goal.name} · ${reminder(goal.targetDate, today)}`,
            tone: timing.hardUrgency === 3 ? "warning" : "primary",
            icon: "goal",
            progress,
            goalId: goal.id,
            goalName: goal.name,
            action: "goal",
          },
        });
      }
    }
  }

  const installmentsByLoan = new Map<string, typeof installmentRows>();
  for (const installment of installmentRows) installmentsByLoan.set(installment.loanId, [...(installmentsByLoan.get(installment.loanId) ?? []), installment]);
  for (const row of loanRows) {
    if (row.loan.status !== "active") continue;
    const pending = (installmentsByLoan.get(row.loan.id) ?? []).filter((item) => item.status === "pending" || item.status === "partial");
    const schedule = pending.length ? pending : row.loan.nextDueDate ? [{ id: `fallback:${row.loan.id}:${row.loan.nextDueDate}`, sequence: null, dueDate: row.loan.nextDueDate, expectedPrincipal: row.loan.scheduledPayment ?? Math.abs(row.balance), expectedInterest: 0, expectedFees: 0, paidPrincipal: 0, paidInterest: 0, paidFees: 0, status: "pending" as const, loanId: row.loan.id }] : [];
    const item = schedule[0];
    if (!item) continue;
    // Loan payments are actionable when due, not during an advance reminder window.
    if (daysUntil(item.dueDate, today) > 0) continue;
    const timing = urgencyForDate(item.dueDate, today, 0);
    const expected = addMoney(addMoney(item.expectedPrincipal, item.expectedInterest), item.expectedFees);
    candidates.push({
      kind: "loan",
      sourceId: row.loan.id,
      occurrenceKey: `installment:${item.id}`,
      showAt: dateAtStart(item.dueDate),
      hardUrgency: timing.hardUrgency,
      deterministicRank: timing.rank + 20,
      payload: {
        href: `/loans/${row.loan.id}`,
        feature: "Loan",
        kind: "loan",
        label: timing.hardUrgency === 3 ? "Loan payment overdue" : "Loan payment due",
        value: money(row.loan.currency, expected || Math.abs(row.balance)),
        detail: `${row.loan.direction === "borrowed" ? "I owe" : "Owed to me"} · ${reminder(item.dueDate, today)}${item.sequence ? ` · Payment ${item.sequence}${row.loan.termCount ? ` of ${row.loan.termCount}` : ""}` : ""}`,
        tone: timing.hardUrgency === 3 ? "warning" : "info",
        icon: "loan",
        loanId: row.loan.id,
        installmentId: item.id.startsWith("fallback:") ? undefined : item.id,
        action: "loan",
      },
    });
  }

  const occurrencesByTemplate = new Map<string, typeof occurrenceRows>();
  for (const occurrence of occurrenceRows) occurrencesByTemplate.set(occurrence.recurringTemplateId, [...(occurrencesByTemplate.get(occurrence.recurringTemplateId) ?? []), occurrence]);
  const goalById = new Map(goalRows.map((goal) => [goal.id, goal]));
  for (const template of templateRows.filter((item) => item.isActive)) {
    const pending = (occurrencesByTemplate.get(template.id) ?? []).filter((occurrence) => occurrence.status === "pending").sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    const date = pending[0]?.scheduledDate ?? template.nextDueDate;
    if (template.endDate && date > template.endDate) continue;
    const timing = urgencyForDate(date, today, recurringFrequencyWindows[template.frequency] ?? 7);
    if (timing.hardUrgency <= 0) continue;
    const account = accountRows.find((item) => item.id === template.accountId);
    const linkedGoal = template.goalId ? goalById.get(template.goalId) : null;
    const previousDates = (occurrencesByTemplate.get(template.id) ?? []).filter((item) => item.status === "posted").map((item) => item.scheduledDate);
    candidates.push({
      kind: "recurring",
      sourceId: template.id,
      occurrenceKey: `occurrence:${pending[0]?.id ?? date}`,
      showAt: dateAtStart(addDays(date, -(recurringFrequencyWindows[template.frequency] ?? 7))),
      hardUrgency: timing.hardUrgency,
      deterministicRank: timing.rank,
      payload: {
        href: "/recurring",
        feature: "Recurring",
        kind: "recurring",
        label: linkedGoal ? (template.title || "Monthly payment") : timing.hardUrgency === 3 ? "Recurring payment overdue" : "Upcoming recurring transaction",
        value: `${template.type === "income" ? "+" : ""}${money(account?.currency ?? currency, linkedGoal?.monthlyContribution ?? template.amount)}`,
        detail: linkedGoal ? `${money(account?.currency ?? currency, linkedGoal.monthlyContribution || template.amount)} will be added to your goal · ${linkedGoal.name}` : `${template.title || "Recurring transaction"} · ${reminder(date, today)}`,
        tone: timing.hardUrgency === 3 ? "warning" : "primary",
        icon: linkedGoal ? "recurring" : "recurring",
        recurringTemplateId: template.id,
        occurrenceId: pending[0]?.id,
        previousPayment: previousPaymentAge(previousDates, today),
        goalName: linkedGoal?.name,
        action: "recurring",
      },
    });
  }

  for (const { allocation, budgetPeriod, category } of budgetRows) {
    const periodStart = budgetPeriod.periodStart;
    const limitAmount = normalizeMoney(allocation.adjustedAmount + allocation.rolloverAmount);
    const spent = recentTransactions.reduce((total, transaction) => {
      if (transaction.type !== "expense" || transaction.date < periodStart) return total;
      if (!allocation.categoryId) return addMoney(total, transaction.amount);
      if (transaction.categoryId === allocation.categoryId) return addMoney(total, transaction.amount);
      try {
        const splits = JSON.parse(transaction.splits) as Array<{ categoryId: string; amount: number }>;
        return splits.filter((split) => split.categoryId === allocation.categoryId).reduce((sum, split) => addMoney(sum, split.amount), total);
      } catch {
        return total;
      }
    }, 0);
    const percentage = limitAmount > 0 ? Math.round((spent / limitAmount) * 100) : 0;
    // Do not let rounding create a false alert just below the limit. The
    // threshold is based on the normalized ledger total, not the display %.
    const threshold = limitAmount > 0 && spent >= limitAmount ? budgetAlertThreshold(percentage) : null;
    if (threshold === null) continue;
    const exceeded = spent > limitAmount;
    candidates.push({
      kind: "budget",
      sourceId: allocation.id,
      // Reaching the limit and exceeding it are distinct occurrences. This
      // lets an over-limit alert surface even if the user dismissed the
      // earlier “limit reached” reminder.
      occurrenceKey: `period:${periodStart}:threshold:${exceeded ? "exceeded" : threshold}`,
      showAt: dateAtStart(periodStart),
      expiresAt: dateAtStart(budgetPeriod.periodEnd),
      hardUrgency: exceeded ? 3 : 2,
      deterministicRank: exceeded ? 900 : 850,
      payload: {
        href: `/budgets?period=${budgetPeriod.recurrence}&budget=${allocation.id}`,
        feature: "Budget",
        kind: "budget",
        label: exceeded ? "Budget exceeded" : "Budget limit reached",
        value: `${currency} ${formatCurrencyAmount(spent)} / ${formatCurrencyAmount(limitAmount)}`,
        detail: `${category?.name ? `${category.name} budget` : "Overall budget"} · ${percentage}% used`,
        tone: "warning",
        icon: "budget",
        progress: Math.min(100, percentage),
        action: "budget",
      },
    });
  }
  return candidates;
}

async function insertCandidates(userId: string, candidates: Candidate[], now: Date) {
  if (!candidates.length) return;
  const timestamp = now.toISOString();
  const values = candidates.map((candidate) => ({
      id: randomUUID(),
      userId,
      kind: candidate.kind,
      sourceId: candidate.sourceId,
      occurrenceKey: candidate.occurrenceKey,
      showAt: candidate.showAt,
      expiresAt: candidate.expiresAt ?? null,
      shownAt: null,
      dismissedAt: null,
      resolvedAt: null,
      payload: JSON.stringify(candidate.payload),
      hardUrgency: candidate.hardUrgency,
      deterministicRank: candidate.deterministicRank,
      aiStatus: "pending" as const,
      aiRank: null,
      aiSuppressed: false,
      aiTitle: null,
      aiDetail: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
  // D1/SQLite has a much smaller bound-parameter limit than PostgreSQL.
  // Keep each insert below that limit while preserving idempotent conflicts.
  for (let offset = 0; offset < values.length; offset += 5) {
    await db.insert(homeAlerts).values(values.slice(offset, offset + 5)).onConflictDoNothing();
  }
  for (const candidate of candidates) {
    const payload = JSON.stringify(candidate.payload);
    await db.update(homeAlerts).set({
      showAt: candidate.showAt,
      expiresAt: candidate.expiresAt ?? null,
      payload,
      hardUrgency: candidate.hardUrgency,
      deterministicRank: candidate.deterministicRank,
      aiStatus: "pending",
      aiRank: null,
      aiSuppressed: false,
      aiTitle: null,
      aiDetail: null,
      resolvedAt: null,
      updatedAt: timestamp,
    }).where(and(
      eq(homeAlerts.userId, userId),
      eq(homeAlerts.kind, candidate.kind),
      eq(homeAlerts.sourceId, candidate.sourceId),
      eq(homeAlerts.occurrenceKey, candidate.occurrenceKey),
      isNull(homeAlerts.dismissedAt),
      or(isNotNull(homeAlerts.resolvedAt), ne(homeAlerts.payload, payload)),
    ));
  }
}

async function resolveClosedAlerts(userId: string, candidates: Candidate[]) {
  const active = await db.select().from(homeAlerts).where(and(eq(homeAlerts.userId, userId), isNull(homeAlerts.resolvedAt)));
  if (!active.length) return;
  const [activeGoals, activeOccurrences, activeInstallments, activeLoans, activeTemplates] = await Promise.all([
    db.select({ id: goals.id, status: goals.status, targetAmount: goals.targetAmount, allocatedAmount: goals.allocatedAmount, targetDate: goals.targetDate }).from(goals).where(eq(goals.userId, userId)),
    db.select({ id: recurringOccurrences.id, status: recurringOccurrences.status }).from(recurringOccurrences).where(eq(recurringOccurrences.userId, userId)),
    db.select({ id: loanInstallments.id, status: loanInstallments.status }).from(loanInstallments),
    db.select({ id: loans.id, status: loans.status, nextDueDate: loans.nextDueDate }).from(loans).where(eq(loans.userId, userId)),
    db.select({ id: recurringTemplates.id, isActive: recurringTemplates.isActive, nextDueDate: recurringTemplates.nextDueDate }).from(recurringTemplates).where(eq(recurringTemplates.userId, userId)),
  ]);
  const goalById = new Map(activeGoals.map((row) => [row.id, row]));
  const occurrenceStatus = new Map(activeOccurrences.map((row) => [row.id, row.status]));
  const installmentStatus = new Map(activeInstallments.map((row) => [row.id, row.status]));
  const loanById = new Map(activeLoans.map((row) => [row.id, row]));
  const templateById = new Map(activeTemplates.map((row) => [row.id, row]));
  const activeCandidateKeys = new Set(candidates.map((candidate) => `${candidate.kind}:${candidate.sourceId}:${candidate.occurrenceKey}`));
  const timestamp = new Date().toISOString();
  for (const alert of active) {
    const payload = parsePayload(alert.payload);
    const goal = goalById.get(alert.sourceId);
    const goalTargetDate = alert.occurrenceKey.startsWith("target:") ? alert.occurrenceKey.slice("target:".length) : null;
    const goalClosed = alert.kind === "goal" && (!activeCandidateKeys.has(`${alert.kind}:${alert.sourceId}:${alert.occurrenceKey}`) || !goal || goal.status !== "active" || goal.targetAmount <= goal.allocatedAmount || (goalTargetDate !== null && goal.targetDate !== goalTargetDate));
    const occurrenceId = payload?.occurrenceId;
    const installmentId = payload?.installmentId;
    const template = templateById.get(alert.sourceId);
    const recurringDate = alert.occurrenceKey.startsWith("occurrence:") ? alert.occurrenceKey.slice("occurrence:".length) : null;
    const recurringClosed = alert.kind === "recurring" && (!template || !template.isActive || (occurrenceId ? occurrenceStatus.get(occurrenceId) !== "pending" : template.nextDueDate !== recurringDate));
    const loan = loanById.get(alert.sourceId);
    const fallbackDueDate = alert.occurrenceKey.startsWith("installment:fallback:") ? alert.occurrenceKey.split(":").at(-1) : null;
    const loanClosed = alert.kind === "loan" && (!activeCandidateKeys.has(`${alert.kind}:${alert.sourceId}:${alert.occurrenceKey}`) || (installmentId
      ? !["pending", "partial"].includes(installmentStatus.get(installmentId) ?? "")
      : !loan || loan.status !== "active" || (fallbackDueDate !== null && loan.nextDueDate !== fallbackDueDate)));
    const budgetClosed = alert.kind === "budget" && !activeCandidateKeys.has(`${alert.kind}:${alert.sourceId}:${alert.occurrenceKey}`);
    if (goalClosed || recurringClosed || loanClosed || budgetClosed) await db.update(homeAlerts).set({ resolvedAt: timestamp, updatedAt: timestamp }).where(eq(homeAlerts.id, alert.id));
  }
}

export async function repairHomeAlerts(userId: string, now = new Date()) {
  const candidates = await buildCandidates(userId, now);
  await insertCandidates(userId, candidates, now);
  await resolveClosedAlerts(userId, candidates);
}

export function scheduleHomeAlertRepair(userId: string) {
  void repairHomeAlerts(userId).catch((error) => {
    console.error("Luna home alert repair failed", { userId, error: error instanceof Error ? error.message : String(error) });
  });
}

export async function getHomeAlerts(userId: string, options?: { now?: Date }) {
  const now = options?.now ?? new Date();
  await repairHomeAlerts(userId, now);
  const timestamp = now.toISOString();
  const rows = await db.select().from(homeAlerts).where(and(
    eq(homeAlerts.userId, userId),
    lte(homeAlerts.showAt, timestamp),
    or(isNull(homeAlerts.expiresAt), gte(homeAlerts.expiresAt, timestamp)),
    isNull(homeAlerts.dismissedAt),
    isNull(homeAlerts.resolvedAt),
    eq(homeAlerts.aiSuppressed, false),
  )).orderBy(desc(homeAlerts.hardUrgency), desc(homeAlerts.aiRank), desc(homeAlerts.deterministicRank), asc(homeAlerts.showAt)).limit(3);
  return rows.map((row) => {
    const payload = parsePayload(row.payload);
    if (!payload) return null;
    return {
      id: row.id,
      showAt: row.showAt,
      expiresAt: row.expiresAt,
      shownAt: row.shownAt,
      dismissedAt: row.dismissedAt,
      resolvedAt: row.resolvedAt,
      hardUrgency: row.hardUrgency,
      aiStatus: row.aiStatus,
      aiRank: row.aiRank,
      ...payload,
      label: row.aiTitle ?? payload.label,
      detail: row.aiDetail ?? payload.detail,
    };
  }).filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function getActivityHomeAlerts(userId: string, options?: { now?: Date }) {
  const now = options?.now ?? new Date();
  await repairHomeAlerts(userId, now);
  const timestamp = now.toISOString();
  const rows = await db.select().from(homeAlerts).where(and(
    eq(homeAlerts.userId, userId),
    lte(homeAlerts.showAt, timestamp),
    or(isNull(homeAlerts.expiresAt), gte(homeAlerts.expiresAt, timestamp)),
    isNull(homeAlerts.resolvedAt),
    eq(homeAlerts.aiSuppressed, false),
  )).orderBy(desc(homeAlerts.hardUrgency), desc(homeAlerts.deterministicRank), desc(homeAlerts.showAt)).limit(40);
  const seenSources = new Set<string>();
  const activityAlerts = [];
  for (const row of rows) {
    const sourceKey = `${row.kind}:${row.sourceId}`;
    if (seenSources.has(sourceKey)) continue;
    const payload = parsePayload(row.payload);
    if (!payload) continue;
    seenSources.add(sourceKey);
    activityAlerts.push({
      id: row.id,
      createdAt: row.createdAt,
      showAt: row.showAt,
      expiresAt: row.expiresAt,
      shownAt: row.shownAt,
      dismissedAt: row.dismissedAt,
      resolvedAt: row.resolvedAt,
      hardUrgency: row.hardUrgency,
      aiStatus: row.aiStatus,
      aiRank: row.aiRank,
      ...payload,
      label: row.aiTitle ?? payload.label,
      detail: row.aiDetail ?? payload.detail,
    });
    if (activityAlerts.length === 5) break;
  }
  return activityAlerts;
}

export async function markHomeAlertShown(userId: string, alertId: string) {
  const [row] = await db.update(homeAlerts).set({ shownAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(homeAlerts.id, alertId), eq(homeAlerts.userId, userId), isNull(homeAlerts.shownAt))).returning({ id: homeAlerts.id });
  return Boolean(row);
}

export async function dismissHomeAlert(userId: string, alertId: string) {
  const [row] = await db.update(homeAlerts).set({ dismissedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(homeAlerts.id, alertId), eq(homeAlerts.userId, userId), isNull(homeAlerts.dismissedAt), isNull(homeAlerts.resolvedAt))).returning({ id: homeAlerts.id });
  return Boolean(row);
}

export async function resolveHomeAlert(userId: string, alertId: string) {
  const timestamp = new Date().toISOString();
  const [row] = await db.update(homeAlerts).set({ resolvedAt: timestamp, updatedAt: timestamp }).where(and(eq(homeAlerts.id, alertId), eq(homeAlerts.userId, userId), isNull(homeAlerts.resolvedAt), isNull(homeAlerts.dismissedAt))).returning({ id: homeAlerts.id });
  return Boolean(row);
}

export async function resolveHomeAlerts(userId: string, kind: HomeAlertKind, sourceId: string) {
  const timestamp = new Date().toISOString();
  await db.update(homeAlerts).set({ resolvedAt: timestamp, updatedAt: timestamp }).where(and(eq(homeAlerts.userId, userId), eq(homeAlerts.kind, kind), eq(homeAlerts.sourceId, sourceId), isNull(homeAlerts.resolvedAt), isNull(homeAlerts.dismissedAt)));
}

function nvidiaEndpoint() {
  const raw = process.env.NVIDIA_AI_API_URL?.trim();
  if (!raw) return null;
  const url = raw.replace(/\/$/, "");
  return url.endsWith("/chat/completions") ? url : `${url}/chat/completions`;
}

function extractJson(value: string) {
  const unfenced = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  return start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;
}

function safeAiCopy(value: string | undefined, payload: HomeAlertPayload | null) {
  if (!value || !payload) return null;
  const knownNumbers = new Set([payload.label, payload.value, payload.detail, payload.goalName, payload.previousPayment].filter(Boolean).join(" ").match(/\d[\d,.]*/g) ?? []);
  const outputNumbers = value.match(/\d[\d,.]*/g) ?? [];
  return outputNumbers.every((number) => knownNumbers.has(number)) ? value : null;
}

export async function enrichPendingHomeAlerts(limit = 50) {
  const endpoint = nvidiaEndpoint();
  const apiKey = process.env.NVIDIA_AI_API_KEY?.trim();
  const pending = await db.select().from(homeAlerts).where(eq(homeAlerts.aiStatus, "pending")).orderBy(asc(homeAlerts.createdAt)).limit(limit);
  if (!pending.length) return;
  if (!endpoint || !apiKey) {
    await db.update(homeAlerts).set({ aiStatus: "fallback", updatedAt: new Date().toISOString() }).where(eq(homeAlerts.aiStatus, "pending"));
    return;
  }
  const grouped = new Map<string, typeof pending>();
  for (const row of pending) grouped.set(row.userId, [...(grouped.get(row.userId) ?? []), row]);
  for (const rows of grouped.values()) {
    const input = rows.map((row) => ({ id: row.id, hardUrgency: row.hardUrgency, deterministicRank: row.deterministicRank, alert: parsePayload(row.payload) }));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
        body: JSON.stringify({
          model: process.env.NVIDIA_AI_MODEL || "meta/llama-3.3-70b-instruct",
          temperature: 0.1,
          max_tokens: 900,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You are Luna's careful homepage reminder ranker. Use only the supplied alert facts. Return valid JSON with an alerts array. Rank the most useful alerts from 0 to 100. You may suppress only low-urgency duplicates; never suppress hardUrgency 2 or 3. Never invent or change amounts, dates, feature names, or actions. Keep title and detail concise and non-judgmental." },
            { role: "user", content: JSON.stringify({ alerts: input }) },
          ],
        }),
      });
      if (!response.ok) throw new Error(`NVIDIA_AI_HTTP_${response.status}`);
      const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
      const content = payload.choices?.[0]?.message?.content;
      const text = typeof content === "string" ? content : "";
      const parsed = aiOutputSchema.safeParse(JSON.parse(extractJson(text)));
      if (!parsed.success) throw new Error("NVIDIA_AI_INVALID_JSON");
      const updates = new Map(parsed.data.alerts.map((item) => [item.id, item]));
      const timestamp = new Date().toISOString();
      for (const row of rows) {
        const result = updates.get(row.id);
        const hardUrgency = row.hardUrgency;
        const parsedPayload = parsePayload(row.payload);
        await db.update(homeAlerts).set({
          aiStatus: "ready",
          aiRank: result?.rank ?? row.deterministicRank,
          aiSuppressed: hardUrgency >= 2 ? false : result?.show === false,
          aiTitle: safeAiCopy(result?.title, parsedPayload),
          aiDetail: safeAiCopy(result?.detail, parsedPayload),
          updatedAt: timestamp,
        }).where(eq(homeAlerts.id, row.id));
      }
    } catch (error) {
      console.error("Luna home alert AI enrichment failed; using deterministic alerts", error);
      await db.update(homeAlerts).set({ aiStatus: "fallback", updatedAt: new Date().toISOString() }).where(and(
        eq(homeAlerts.aiStatus, "pending"),
        inArray(homeAlerts.id, rows.map((row) => row.id)),
      ));
    } finally {
      clearTimeout(timeout);
    }
  }
}

export async function runScheduledHomeAlerts(now = new Date()) {
  const userRows = await db.select({ userId: users.id }).from(users);
  for (const row of userRows) await repairHomeAlerts(row.userId, now);
  await enrichPendingHomeAlerts();
}
