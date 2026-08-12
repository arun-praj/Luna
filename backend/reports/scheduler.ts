import "server-only";

import { and, eq, isNotNull, lte } from "drizzle-orm";

import { isSmtpConfigured, sendReportEmail } from "@/backend/auth/email";
import { db } from "@/backend/db/client";
import { reportDeliveries, users } from "@/backend/db/schema";
import { buildReport, getPreviousMonthBounds } from "./report-service";
import { buildReportPdf } from "./report-pdf";
import { writeReportCache } from "./report-cache";

function configuredHour() {
  const hour = Number(process.env.REPORT_MONTHLY_HOUR ?? "8");
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 8;
}

function monthlyReportIsDue(now: Date) {
  return now.getUTCDate() === 1 && now.getUTCHours() === configuredHour();
}

export async function runScheduledReports(now = new Date()) {
  if (!monthlyReportIsDue(now) || !isSmtpConfigured()) return { sent: 0, skipped: true };
  const bounds = getPreviousMonthBounds(now);
  const recipients = await db.select({ id: users.id, email: users.email }).from(users).where(and(eq(users.monthlyReportEnabled, true), isNotNull(users.emailVerifiedAt)));
  let sent = 0;

  for (const recipient of recipients) {
    const [existing] = await db.select().from(reportDeliveries).where(and(eq(reportDeliveries.userId, recipient.id), eq(reportDeliveries.reportType, "monthly"), eq(reportDeliveries.periodStart, bounds.start))).limit(1);
    if (existing?.status === "sent" || existing?.status === "processing") continue;
    const deliveryId = existing?.id ?? crypto.randomUUID();
    if (existing) {
      await db.update(reportDeliveries).set({ status: "processing", error: null, createdAt: new Date().toISOString() }).where(eq(reportDeliveries.id, deliveryId));
    } else {
      const [created] = await db.insert(reportDeliveries).values({ id: deliveryId, userId: recipient.id, reportType: "monthly", periodStart: bounds.start, periodEnd: bounds.end, status: "processing", error: null, createdAt: new Date().toISOString() }).onConflictDoNothing().returning({ id: reportDeliveries.id });
      if (!created) continue;
    }

    try {
      const report = await buildReport(recipient.id, "monthly", now, bounds);
      await writeReportCache(recipient.id, report);
      await sendReportEmail({
        to: recipient.email,
        periodLabel: report.period.label,
        summary: `${report.totals.spending.toLocaleString()} spent, ${report.totals.earning.toLocaleString()} earned, and ${report.totals.savings.toLocaleString()} saved.`,
        reportPdf: await buildReportPdf(report),
      });
      await db.update(reportDeliveries).set({ status: "sent", error: null, sentAt: new Date().toISOString() }).where(eq(reportDeliveries.id, deliveryId));
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "REPORT_DELIVERY_FAILED";
      await db.update(reportDeliveries).set({ status: "failed", error: message }).where(eq(reportDeliveries.id, deliveryId));
      console.error("Luna monthly report delivery failed", { userId: recipient.id, message });
    }
  }
  return { sent, skipped: false };
}

export async function runScheduledReportTests(now = new Date()) {
  if (!isSmtpConfigured()) return { sent: 0, skipped: true };

  const due = await db
    .select({ id: reportDeliveries.id, userId: reportDeliveries.userId, email: users.email })
    .from(reportDeliveries)
    .innerJoin(users, eq(users.id, reportDeliveries.userId))
    .where(and(
      eq(reportDeliveries.reportType, "monthly_test"),
      eq(reportDeliveries.status, "processing"),
      lte(reportDeliveries.createdAt, now.toISOString()),
    ))
    .limit(20);
  let sent = 0;

  for (const delivery of due) {
    const [claimed] = await db
      .update(reportDeliveries)
      .set({ status: "sending", error: null })
      .where(and(eq(reportDeliveries.id, delivery.id), eq(reportDeliveries.status, "processing")))
      .returning({ id: reportDeliveries.id });
    if (!claimed) continue;

    try {
      const bounds = getPreviousMonthBounds(now);
      const report = await buildReport(delivery.userId, "monthly", now, bounds);
      await writeReportCache(delivery.userId, report);
      await sendReportEmail({
        to: delivery.email,
        periodLabel: report.period.label,
        summary: `${report.totals.spending.toLocaleString()} spent, ${report.totals.earning.toLocaleString()} earned, and ${report.totals.savings.toLocaleString()} saved.`,
        reportPdf: await buildReportPdf(report),
      });
      await db.update(reportDeliveries).set({ status: "sent", error: null, sentAt: new Date().toISOString() }).where(eq(reportDeliveries.id, delivery.id));
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "REPORT_TEST_DELIVERY_FAILED";
      await db.update(reportDeliveries).set({ status: "failed", error: message }).where(eq(reportDeliveries.id, delivery.id));
      console.error("Luna report test delivery failed", { userId: delivery.userId, message });
    }
  }

  return { sent, skipped: false };
}
