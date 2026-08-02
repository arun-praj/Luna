import { and, eq, isNotNull, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/backend/db/client";
import { accountDeletionRequests } from "@/backend/db/schema";
import { deleteUserData } from "@/backend/privacy/delete-user-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const due = await db.select().from(accountDeletionRequests).where(and(eq(accountDeletionRequests.status, "scheduled"), isNotNull(accountDeletionRequests.userId), lte(accountDeletionRequests.scheduledFor, new Date().toISOString())));
  let completed = 0;
  for (const deletion of due) {
    if (deletion.userId) await deleteUserData(db, deletion.userId);
    await db.update(accountDeletionRequests).set({ status: "completed", executedAt: new Date().toISOString(), userId: null }).where(eq(accountDeletionRequests.id, deletion.id));
    completed += 1;
  }
  return NextResponse.json({ completed });
}
