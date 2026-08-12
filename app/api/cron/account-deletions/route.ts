import { and, eq, isNotNull, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/backend/db/client";
import { accountDeletionRequests } from "@/backend/db/schema";
import { deleteUserData } from "@/backend/privacy/delete-user-data";
import { r2Bucket, r2Configured } from "@/backend/storage/r2";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const due = await db.select().from(accountDeletionRequests).where(and(eq(accountDeletionRequests.status, "scheduled"), isNotNull(accountDeletionRequests.userId), lte(accountDeletionRequests.scheduledFor, new Date().toISOString())));
  let completed = 0;
  let failed = 0;
  for (const deletion of due) {
    if (!deletion.userId) continue;
    try {
      await deleteUserData(db, deletion.userId, { storage: r2Configured() ? r2Bucket() : undefined, deletionRequestId: deletion.id });
      completed += 1;
    } catch (error) {
      failed += 1;
      console.error("Scheduled account deletion failed", { deletionId: deletion.id, error });
    }
  }
  if (failed > 0) return NextResponse.json({ completed, failed }, { status: 500 });
  return NextResponse.json({ completed, failed });
}
