import { NextResponse } from "next/server";
import { eq, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { reportGenerationLimits, users } from "@/backend/db/schema";
import { isSmtpConfigured, sendReportEmail } from "@/backend/auth/email";
import { buildReport, getPeriodBounds, REPORT_PERIODS, type ReportData, type ReportPeriod } from "@/backend/reports/report-service";
import { buildReportPdf } from "@/backend/reports/report-pdf";
import { readCachedReport, writeReportCache } from "@/backend/reports/report-cache";


function requestedPeriod(value: string | null): ReportPeriod {
  return REPORT_PERIODS.includes(value as ReportPeriod) ? value as ReportPeriod : "monthly";
}

function reportFilename(period: ReportPeriod, label: string) {
  return `luna-${period}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
}

const postedReportSchema = z.object({
  period: z.object({
    type: z.enum(REPORT_PERIODS),
    start: z.string(),
    end: z.string(),
    label: z.string(),
  }),
  generatedAt: z.string(),
  currency: z.string().min(1),
  transactionCount: z.number().int().nonnegative(),
  totals: z.object({
    spending: z.number().finite(),
    earning: z.number().finite(),
    savings: z.number().finite(),
    net: z.number().finite(),
  }),
  categorySpending: z.array(z.object({
    name: z.string(),
    icon: z.string().nullable(),
    color: z.string().nullable(),
    amount: z.number().finite(),
    share: z.number().finite(),
  })),
  topExpense: z.object({
    title: z.string(),
    category: z.string(),
    amount: z.number().finite(),
    date: z.string(),
  }).nullable(),
  forecast: z.object({
    label: z.string(),
    spending: z.number().finite(),
    earning: z.number().finite(),
    savings: z.number().finite(),
    basis: z.string(),
  }),
  insights: z.array(z.object({
    icon: z.enum(["sparkles", "trend", "wallet", "shield", "target", "lightbulb"]),
    title: z.string(),
    body: z.string(),
  })),
  suggestions: z.array(z.string()),
  ai: z.object({ enabled: z.boolean(), source: z.enum(["nvidia", "local"]) }),
});

const MAX_REPORT_GENERATIONS_PER_DAY = 3;

class ReportGenerationLimitError extends Error {
  constructor() {
    super("REPORT_GENERATION_LIMIT");
  }
}

class ReportCacheMissError extends Error {
  constructor() {
    super("REPORT_CACHE_MISS");
  }
}

function parseReportJson(value: string) {
  try {
    const parsed = postedReportSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data as ReportData : null;
  } catch {
    return null;
  }
}

async function claimReportGeneration(userId: string) {
  const day = new Date().toISOString().slice(0, 10);
  const [claim] = await db.insert(reportGenerationLimits).values({
    id: `${userId}:${day}`,
    userId,
    day,
    count: 1,
  }).onConflictDoUpdate({
    target: [reportGenerationLimits.userId, reportGenerationLimits.day],
    set: { count: sql`${reportGenerationLimits.count} + 1` },
    setWhere: lt(reportGenerationLimits.count, MAX_REPORT_GENERATIONS_PER_DAY),
  }).returning({ count: reportGenerationLimits.count });
  if (!claim) throw new ReportGenerationLimitError();
}

async function getCachedReport(userId: string, period: ReportPeriod) {
  const bounds = getPeriodBounds(period);
  const cached = await readCachedReport(userId, period, bounds);
  const report = cached ? parseReportJson(JSON.stringify(cached)) : null;
  if (report) return report;
  throw new ReportCacheMissError();
}

async function refreshReport(userId: string, period: ReportPeriod) {
  await claimReportGeneration(userId);
  const bounds = getPeriodBounds(period);
  const report = await buildReport(userId, period, new Date(), bounds);
  await writeReportCache(userId, report);
  return report;
}

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const url = new URL(request.url);
  const period = requestedPeriod(url.searchParams.get("period"));
  let report: ReportData;
  try {
    report = await getCachedReport(userId, period);
  } catch (error) {
    if (error instanceof ReportCacheMissError) return NextResponse.json({ status: "preparing", period }, { status: 202, headers: { "Cache-Control": "no-store" } });
    if (error instanceof ReportGenerationLimitError) return errorResponse("You have reached the limit of 3 new report generations today. Try again tomorrow.", 429);
    throw error;
  }
  if (url.searchParams.get("format") !== "pdf") {
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  }
  const pdf = await buildReportPdf(report);
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${reportFilename(period, report.period.start)}"`,
    },
  });
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const body = (await request.json().catch(() => null)) as { period?: string; format?: string; sendEmail?: boolean; refresh?: boolean; report?: unknown } | null;
  const period = requestedPeriod(body?.period ?? null);
  const postedReport = postedReportSchema.safeParse(body?.report);
  let report: ReportData;
  if (body?.refresh) {
    try {
      report = await refreshReport(userId, period);
    } catch (error) {
      if (error instanceof ReportGenerationLimitError) return errorResponse("You have reached the limit of 3 new report generations today. Try again tomorrow.", 429);
      throw error;
    }
  } else if (postedReport.success && postedReport.data.period.type === period) {
    report = postedReport.data as ReportData;
  } else {
    try {
      report = await getCachedReport(userId, period);
    } catch (error) {
      if (error instanceof ReportCacheMissError) return errorResponse("Report is still being prepared. Try again shortly.", 409);
      throw error;
    }
  }
  if (body?.format === "pdf") {
    const pdf = await buildReportPdf(report);
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${reportFilename(period, report.period.start)}"`,
      },
    });
  }
  if (body?.sendEmail) {
    if (!isSmtpConfigured()) return errorResponse("Email delivery is not configured yet", 503);
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return errorResponse("User not found", 404);
    await sendReportEmail({
      to: user.email,
      periodLabel: report.period.label,
      summary: `${report.totals.spending.toLocaleString()} spent, ${report.totals.earning.toLocaleString()} earned, and ${report.totals.savings.toLocaleString()} saved.`,
      reportPdf: await buildReportPdf(report),
    });
    return NextResponse.json({ sent: true, report }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ report }, { headers: { "Cache-Control": "no-store" } });
}
