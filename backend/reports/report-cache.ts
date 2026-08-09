import "server-only";

import { and, eq, lt } from "drizzle-orm";

import { db } from "@/backend/db/client";
import { reportCache } from "@/backend/db/schema";
import { getReportFingerprint, type PeriodBounds, type ReportData, type ReportPeriod } from "@/backend/reports/report-service";

const REPORT_CACHE_RETENTION_DAYS = 365;

function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function cacheCutoff(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - REPORT_CACHE_RETENTION_DAYS);
  return dateKey(cutoff);
}

export async function readCachedReport(userId: string, period: ReportPeriod, bounds: PeriodBounds) {
  const [cached] = await db.select({ reportJson: reportCache.reportJson }).from(reportCache).where(and(eq(reportCache.userId, userId), eq(reportCache.periodType, period), eq(reportCache.periodStart, bounds.start))).limit(1);
  if (!cached) return null;
  try {
    const report = JSON.parse(cached.reportJson) as ReportData;
    return report.period?.type === period ? report : null;
  } catch {
    return null;
  }
}

export async function writeReportCache(userId: string, report: ReportData) {
  const bounds = report.period;
  const transactionFingerprint = await getReportFingerprint(userId, report.period.type, new Date(), bounds);
  const generatedAt = new Date().toISOString();
  const cacheValues = {
    id: `${userId}:${report.period.type}:${bounds.start}`,
    userId,
    periodType: report.period.type,
    periodStart: bounds.start,
    periodEnd: bounds.end,
    transactionFingerprint,
    reportJson: JSON.stringify(report),
    generatedAt,
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

  await db.delete(reportCache).where(and(eq(reportCache.userId, userId), lt(reportCache.periodEnd, cacheCutoff())));
}
