import { randomUUID } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/backend/db/client";
import { accountDeletionRequests, users } from "@/backend/db/schema";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { deleteUserData } from "@/backend/privacy/delete-user-data";
import { requireR2Bucket } from "@/backend/storage/r2";


const input = z.object({ mode: z.enum(["immediate", "after_30_days", "cancel"]) });

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const [scheduled] = await db.select().from(accountDeletionRequests).where(and(eq(accountDeletionRequests.userId, userId), eq(accountDeletionRequests.status, "scheduled"), gt(accountDeletionRequests.scheduledFor, new Date(0).toISOString()))).orderBy(desc(accountDeletionRequests.requestedAt)).limit(1);
  return NextResponse.json({ scheduledDeletion: scheduled ? { id: scheduled.id, scheduledFor: scheduled.scheduledFor, requestedAt: scheduled.requestedAt } : null });
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Choose a valid deletion option", 400);
  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return errorResponse("Authentication required", 401);
  if (parsed.data.mode === "cancel") {
    await db.update(accountDeletionRequests).set({ status: "cancelled" }).where(and(eq(accountDeletionRequests.userId, userId), eq(accountDeletionRequests.status, "scheduled")));
    return NextResponse.json({ cancelled: true });
  }
  const now = new Date();
  const requestId = randomUUID();
  if (parsed.data.mode === "after_30_days") {
    const scheduledFor = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await db.update(accountDeletionRequests).set({ status: "cancelled" }).where(and(eq(accountDeletionRequests.userId, userId), eq(accountDeletionRequests.status, "scheduled")));
    await db.insert(accountDeletionRequests).values({ id: requestId, userId, emailSnapshot: user.email, mode: "after_30_days", status: "scheduled", requestedAt: now.toISOString(), scheduledFor, executedAt: null });
    return NextResponse.json({ scheduledFor });
  }
  await db.insert(accountDeletionRequests).values({ id: requestId, userId, emailSnapshot: user.email, mode: "immediate", status: "scheduled", requestedAt: now.toISOString(), scheduledFor: null, executedAt: null });
  try {
    await deleteUserData(db, userId, { storage: requireR2Bucket(), deletionRequestId: requestId });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Immediate account deletion failed", error);
    // Keep the user and make this failed attempt visible as retryable rather
    // than claiming completion before the cleanup has actually succeeded.
    await db.update(accountDeletionRequests).set({ status: "cancelled" }).where(eq(accountDeletionRequests.id, requestId));
    return errorResponse("Account deletion could not be completed. Please try again.", 500);
  }
}

export async function DELETE(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  await db.update(accountDeletionRequests).set({ status: "cancelled" }).where(and(eq(accountDeletionRequests.userId, userId), eq(accountDeletionRequests.status, "scheduled")));
  return NextResponse.json({ cancelled: true });
}
