import { NextResponse } from "next/server";
import { and, eq, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { reportCache, reportGenerationLimits, users } from "@/backend/db/schema";
import { isSmtpConfigured, sendReportEmail } from "@/backend/auth/email";
import { buildReport, getPeriodBounds, getReportFingerprint, REPORT_PERIODS, type ReportData, type ReportPeriod } from "@/backend/reports/report-service";
import { buildReportPdf } from "@/backend/reports/report-pdf";

export const runtime = "nodejs";

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

async function getCachedOrGenerateReport(userId: string, period: ReportPeriod) {
  const bounds = getPeriodBounds(period);
  const fingerprint = await getReportFingerprint(userId, period, new Date(), bounds);
  const [cached] = await db.select({ transactionFingerprint: reportCache.transactionFingerprint, reportJson: reportCache.reportJson }).from(reportCache).where(and(eq(reportCache.userId, userId), eq(reportCache.periodType, period), eq(reportCache.periodStart, bounds.start))).limit(1);
  if (cached?.transactionFingerprint === fingerprint) {
    const report = parseReportJson(cached.reportJson);
    if (report) return report;
  }

  await claimReportGeneration(userId);
  const report = await buildReport(userId, period, new Date(), bounds);
  const cacheValues = {
    id: `${userId}:${period}:${bounds.start}`,
    userId,
    periodType: period,
    periodStart: bounds.start,
    periodEnd: bounds.end,
    transactionFingerprint: fingerprint,
    reportJson: JSON.stringify(report),
    generatedAt: new Date().toISOString(),
  };
  await db.insert(reportCache).values(cacheValues).onConflictDoUpdate({
    target: [reportCache.userId, reportCache.periodType, reportCache.periodStart],
    set: {
      periodEnd: cacheValues.periodEnd,
      transactionFingerprint: cacheValues.transactionFingerprint,
      reportJson: cacheValues.reportJson,
      generatedAt: cacheValues.generatedAt,
    },
  });
  return report;
}

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const url = new URL(request.url);
  const period = requestedPeriod(url.searchParams.get("period"));
  let report: ReportData;
  try {
    report = await getCachedOrGenerateReport(userId, period);
  } catch (error) {
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
  const body = (await request.json().catch(() => null)) as { period?: string; format?: string; sendEmail?: boolean; report?: unknown } | null;
  const period = requestedPeriod(body?.period ?? null);
  const postedReport = postedReportSchema.safeParse(body?.report);
  let report: ReportData;
  if (postedReport.success && postedReport.data.period.type === period) {
    report = postedReport.data as ReportData;
  } else {
    try {
      report = await getCachedOrGenerateReport(userId, period);
    } catch (error) {
      if (error instanceof ReportGenerationLimitError) return errorResponse("You have reached the limit of 3 new report generations today. Try again tomorrow.", 429);
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
