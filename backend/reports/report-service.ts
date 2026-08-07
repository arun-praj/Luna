import "server-only";

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";

import { categories, transactions, users } from "@/backend/db/schema";
import { db } from "@/backend/db/client";

export const REPORT_PERIODS = ["weekly", "monthly", "yearly"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];
export type ReportIcon = "sparkles" | "trend" | "wallet" | "shield" | "target" | "lightbulb";

type PeriodBounds = {
  start: string;
  end: string;
  label: string;
};

type ReportRow = {
  id: string;
  type: "expense" | "income" | "savings" | "transfer" | "adjust_balance" | "goal_spend";
  amount: number;
  title: string;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  date: string;
};

type Totals = {
  spending: number;
  earning: number;
  savings: number;
  net: number;
};

type Forecast = {
  label: string;
  spending: number;
  earning: number;
  savings: number;
  basis: string;
};

type AiInsight = {
  icon: ReportIcon;
  title: string;
  body: string;
};

type AiOutput = {
  insights: AiInsight[];
  suggestions: string[];
  forecastNote: string;
};

export type ReportData = {
  period: { type: ReportPeriod; start: string; end: string; label: string };
  generatedAt: string;
  currency: string;
  transactionCount: number;
  totals: Totals;
  categorySpending: Array<{
    name: string;
    icon: string | null;
    color: string | null;
    amount: number;
    share: number;
  }>;
  topExpense: {
    title: string;
    category: string;
    amount: number;
    date: string;
  } | null;
  forecast: Forecast;
  insights: AiInsight[];
  suggestions: string[];
  ai: { enabled: boolean; source: "nvidia" | "local" };
};

const aiOutputSchema = z.object({
  insights: z.array(z.object({
    icon: z.enum(["sparkles", "trend", "wallet", "shield", "target", "lightbulb"]),
    title: z.string().trim().min(1).max(80),
    body: z.string().trim().min(1).max(300),
  })).min(1).max(5),
  suggestions: z.array(z.string().trim().min(1).max(240)).min(1).max(5),
  forecastNote: z.string().trim().min(1).max(300),
});

function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function startOfWeek(date: Date) {
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return addDays(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())), -mondayOffset);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parseDateKey(value));
}

function periodLabel(period: ReportPeriod, start: string, end: string) {
  if (period === "yearly") return `Yearly report - ${start.slice(0, 4)}`;
  if (period === "monthly") return `Monthly report - ${new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(parseDateKey(start))}`;
  return `Weekly report - ${displayDate(start)} to ${displayDate(end)}`;
}

export function getPeriodBounds(period: ReportPeriod, now = new Date()): PeriodBounds {
  const current = new Date(now);
  const start = period === "weekly"
    ? startOfWeek(current)
    : period === "monthly"
      ? new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1))
      : new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
  const end = period === "weekly"
    ? addDays(start, 6)
    : period === "monthly"
      ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
      : new Date(Date.UTC(start.getUTCFullYear(), 11, 31));
  const startKey = dateKey(start);
  const endKey = dateKey(end);
  return { start: startKey, end: endKey, label: periodLabel(period, startKey, endKey) };
}

export function getPreviousMonthBounds(now = new Date()): PeriodBounds {
  const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = addMonths(currentMonth, -1);
  const end = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 0));
  const startKey = dateKey(start);
  const endKey = dateKey(end);
  return { start: startKey, end: endKey, label: periodLabel("monthly", startKey, endKey) };
}

function historyStart(period: ReportPeriod, bounds: PeriodBounds) {
  const start = parseDateKey(bounds.start);
  const amount = period === "weekly" ? -112 : period === "monthly" ? -18 : -5;
  const date = period === "yearly" ? addMonths(start, amount * 12) : period === "monthly" ? addMonths(start, amount) : addDays(start, amount * 7);
  return dateKey(date);
}

function roundAmount(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function sum(rows: ReportRow[], type: ReportRow["type"]) {
  return rows.filter((row) => row.type === type).reduce((total, row) => total + Math.abs(row.amount), 0);
}

function totalsFor(rows: ReportRow[]): Totals {
  const earning = sum(rows, "income");
  const spending = sum(rows, "expense");
  const savings = sum(rows, "savings");
  return {
    spending: roundAmount(spending),
    earning: roundAmount(earning),
    savings: roundAmount(savings),
    net: roundAmount(earning - spending - savings),
  };
}

function bucketKey(value: string, period: ReportPeriod) {
  const date = parseDateKey(value);
  if (period === "yearly") return String(date.getUTCFullYear());
  if (period === "monthly") return value.slice(0, 7);
  return dateKey(startOfWeek(date));
}

function forecastLabel(period: ReportPeriod) {
  return period === "weekly" ? "Next week" : period === "monthly" ? "Next month" : "Next year";
}

function forecastFor(rows: ReportRow[], period: ReportPeriod): Forecast {
  const buckets = new Map<string, Totals>();
  for (const row of rows) {
    const key = bucketKey(row.date, period);
    const current = buckets.get(key) ?? { spending: 0, earning: 0, savings: 0, net: 0 };
    const amount = Math.abs(row.amount);
    if (row.type === "expense") current.spending += amount;
    if (row.type === "income") current.earning += amount;
    if (row.type === "savings") current.savings += amount;
    current.net = current.earning - current.spending - current.savings;
    buckets.set(key, current);
  }
  const values = [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-6).map(([, value]) => value);
  const estimate = (field: keyof Totals) => {
    if (!values.length) return 0;
    if (values.length === 1) return roundAmount(values[0][field]);
    const n = values.length;
    const meanX = (n - 1) / 2;
    const meanY = values.reduce((total, value) => total + value[field], 0) / n;
    const denominator = values.reduce((total, _, index) => total + (index - meanX) ** 2, 0);
    const slope = denominator ? values.reduce((total, value, index) => total + (index - meanX) * (value[field] - meanY), 0) / denominator : 0;
    return roundAmount(Math.max(0, values[n - 1][field] + slope));
  };
  return {
    label: forecastLabel(period),
    spending: estimate("spending"),
    earning: estimate("earning"),
    savings: estimate("savings"),
    basis: values.length >= 2 ? `Based on the latest ${values.length} comparable periods.` : "Based on the available transaction history.",
  };
}

function localInsights(report: Omit<ReportData, "insights" | "suggestions" | "ai">): AiOutput {
  const { totals, categorySpending, topExpense, forecast } = report;
  const insights: AiInsight[] = [];
  if (totals.earning === 0 && totals.spending === 0) {
    insights.push({ icon: "sparkles", title: "A quiet period", body: "There is not enough activity in this period for a strong spending pattern yet." });
  } else if (totals.net < 0) {
    insights.push({ icon: "trend", title: "Spending ran ahead", body: `You spent ${totals.spending.toLocaleString()} against ${totals.earning.toLocaleString()} earned in this period.` });
  } else {
    insights.push({ icon: "wallet", title: "Positive cash flow", body: `You kept ${totals.net.toLocaleString()} after spending and savings.` });
  }
  if (categorySpending[0]) {
    insights.push({ icon: "target", title: `${categorySpending[0].name} led spending`, body: `This category accounted for ${categorySpending[0].share}% of your recorded spending.` });
  }
  if (topExpense) {
    insights.push({ icon: "shield", title: "Largest expense", body: `${topExpense.title} was your highest single expense at ${topExpense.amount.toLocaleString()}.` });
  }
  insights.push({ icon: "trend", title: `${forecast.label} estimate`, body: `Spending may be around ${forecast.spending.toLocaleString()} and savings around ${forecast.savings.toLocaleString()}.` });
  const suggestions = [
    totals.net < 0 ? "Set a small spending limit for your top category before the next period." : "Move part of the positive balance toward a named savings goal.",
    categorySpending[0] ? `Review recurring charges in ${categorySpending[0].name} and keep only the ones you still use.` : "Add categories to make your next report more useful.",
    forecast.spending > totals.spending * 1.1 ? "Your trend is rising; consider a weekly check-in before the next period closes." : "Keep a short weekly check-in so small changes stay visible.",
  ];
  return {
    insights: insights.slice(0, 5),
    suggestions,
    forecastNote: forecast.basis,
  };
}

function nvidiaEndpoint() {
  const raw = process.env.NVIDIA_AI_API_URL?.trim();
  if (!raw) return null;
  const url = raw.replace(/\/$/, "");
  if (url.endsWith("/chat/completions")) return url;
  return `${url}/chat/completions`;
}

function extractJson(value: string) {
  const unfenced = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  return start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;
}

async function loadReportSource(userId: string, period: ReportPeriod, bounds: PeriodBounds) {
  const [user] = await db.select({ currency: users.currency }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found");

  const rows = await db.select({
    id: transactions.id,
    type: transactions.type,
    amount: transactions.amount,
    title: transactions.title,
    date: transactions.date,
    categoryName: categories.name,
    categoryIcon: categories.icon,
    categoryColor: categories.color,
  }).from(transactions).leftJoin(categories, eq(transactions.categoryId, categories.id)).where(and(eq(transactions.userId, userId), gte(transactions.date, historyStart(period, bounds)), lte(transactions.date, bounds.end))).orderBy(desc(transactions.date), desc(transactions.createdAt));

  return { currency: user.currency, rows: rows as ReportRow[] };
}

export async function getReportFingerprint(userId: string, period: ReportPeriod, now = new Date(), overrideBounds?: PeriodBounds) {
  const bounds = overrideBounds ?? getPeriodBounds(period, now);
  const source = await loadReportSource(userId, period, bounds);
  const payload = JSON.stringify({ currency: source.currency, bounds, rows: source.rows });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function aiInsights(report: Omit<ReportData, "insights" | "suggestions" | "ai">): Promise<{ output: AiOutput; enabled: boolean }> {
  const endpoint = nvidiaEndpoint();
  const apiKey = process.env.NVIDIA_AI_API_KEY?.trim();
  if (!endpoint || !apiKey) return { output: localInsights(report), enabled: false };

  const prompt = {
    period: report.period,
    currency: report.currency,
    transactionCount: report.transactionCount,
    totals: report.totals,
    categorySpending: report.categorySpending.slice(0, 10),
    topExpense: report.topExpense,
    forecast: report.forecast,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.NVIDIA_AI_MODEL || "meta/llama-3.3-70b-instruct",
        temperature: 0.2,
        max_tokens: 1200,
        reasoning_effort: "medium",
        stream: false,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are Luna, a careful personal finance reporting assistant. Use only the supplied aggregate data. Do not invent transactions, causes, or certainty. Return concise valid JSON only with exactly three fields: insights (exactly 3 objects with icon, title, body), suggestions (exactly 3 strings), forecastNote (one string). Allowed icons: sparkles, trend, wallet, shield, target, lightbulb. Keep every body and suggestion concise, practical, and non-judgmental. Forecasts are estimates, not financial advice." },
          { role: "user", content: JSON.stringify(prompt) },
        ],
      }),
    });
    if (!response.ok) throw new Error(`NVIDIA_AI_HTTP_${response.status}`);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = payload.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((part) => typeof part === "string" ? part : typeof part === "object" && part !== null && "text" in part && typeof part.text === "string" ? part.text : "").join("") : "";
    const parsed = aiOutputSchema.safeParse(JSON.parse(extractJson(text)));
    if (!parsed.success) throw new Error("NVIDIA_AI_INVALID_JSON");
    return { output: parsed.data, enabled: true };
  } catch (error) {
    console.error("Luna AI report insights failed; using local insights", error);
    return { output: localInsights(report), enabled: false };
  } finally {
    clearTimeout(timeout);
  }
}

export async function buildReport(userId: string, period: ReportPeriod, now = new Date(), overrideBounds?: PeriodBounds): Promise<ReportData> {
  const bounds = overrideBounds ?? getPeriodBounds(period, now);
  const { currency, rows: normalizedRows } = await loadReportSource(userId, period, bounds);
  const currentRows = normalizedRows.filter((row) => row.date >= bounds.start && row.date <= bounds.end);
  const totals = totalsFor(currentRows);
  const expenseTotal = totals.spending;
  const categoryMap = new Map<string, { amount: number; icon: string | null; color: string | null }>();
  for (const row of currentRows) {
    if (row.type !== "expense") continue;
    const key = row.categoryName || "Uncategorized";
    const current = categoryMap.get(key) ?? { amount: 0, icon: row.categoryIcon, color: row.categoryColor };
    current.amount += Math.abs(row.amount);
    categoryMap.set(key, current);
  }
  const categorySpending = [...categoryMap.entries()].map(([name, value]) => ({ name, icon: value.icon, color: value.color, amount: roundAmount(value.amount), share: expenseTotal ? Math.round((value.amount / expenseTotal) * 1000) / 10 : 0 })).sort((left, right) => right.amount - left.amount);
  const largest = currentRows.filter((row) => row.type === "expense").sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount))[0];
  const base = {
    period: { type: period, start: bounds.start, end: bounds.end, label: bounds.label },
    generatedAt: new Date().toISOString(),
    currency,
    transactionCount: currentRows.length,
    totals,
    categorySpending,
    topExpense: largest ? { title: largest.title || largest.categoryName || "Expense", category: largest.categoryName || "Uncategorized", amount: roundAmount(Math.abs(largest.amount)), date: largest.date } : null,
    forecast: forecastFor(normalizedRows, period),
  };
  const ai = await aiInsights(base);
  return { ...base, ...ai.output, ai: { enabled: ai.enabled, source: ai.enabled ? "nvidia" : "local" } };
}
