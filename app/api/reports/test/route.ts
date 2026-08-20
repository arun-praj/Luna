import { NextResponse } from "next/server";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { reportDeliveries, users } from "@/backend/db/schema";
import { isSmtpConfigured } from "@/backend/auth/email";


export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  if (!isSmtpConfigured()) return errorResponse("Email delivery is not configured yet", 503);

  const [user] = await db
    .select({ email: users.email, monthlyReportEnabled: users.monthlyReportEnabled })
    .from(users)
    .where(and(eq(users.id, userId), isNotNull(users.emailVerifiedAt)))
    .limit(1);
  if (!user) return errorResponse("A verified email address is required", 400);
  if (!user.monthlyReportEnabled) return errorResponse("Enable monthly reports before sending a test", 400);

  const [pending] = await db
    .select({ id: reportDeliveries.id })
    .from(reportDeliveries)
    .where(and(
      eq(reportDeliveries.userId, userId),
      eq(reportDeliveries.reportType, "monthly_test"),
      inArray(reportDeliveries.status, ["processing", "sending"]),
    ))
    .limit(1);
  if (pending) return errorResponse("A report test is already scheduled", 409);

  const deliveryId = crypto.randomUUID();
  const scheduledFor = new Date(Date.now() + 30_000).toISOString();
  await db.insert(reportDeliveries).values({
    id: deliveryId,
    userId,
    reportType: "monthly_test",
    periodStart: `test:${deliveryId}`,
    periodEnd: scheduledFor,
    status: "processing",
    error: null,
    createdAt: scheduledFor,
  });

  return NextResponse.json({ scheduled: true, scheduledFor }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
