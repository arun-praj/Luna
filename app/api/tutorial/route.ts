import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { users } from "@/backend/db/schema";

export const runtime = "nodejs";

const tutorialAction = z.object({
  action: z.enum(["start", "complete"]),
});

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const [user] = await db.select({ tutorialStartedAt: users.tutorialStartedAt, tutorialCompletedAt: users.tutorialCompletedAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return errorResponse("Authentication required", 401);
  return NextResponse.json({ tutorial: { startedAt: user.tutorialStartedAt, completedAt: user.tutorialCompletedAt, started: Boolean(user.tutorialStartedAt), completed: Boolean(user.tutorialCompletedAt) } });
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = tutorialAction.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid tutorial action", 400);
  const timestamp = new Date().toISOString();
  const updates = parsed.data.action === "start" ? { tutorialStartedAt: timestamp } : { tutorialCompletedAt: timestamp };
  await db.update(users).set({ ...updates, updatedAt: timestamp }).where(eq(users.id, userId));
  return NextResponse.json({ ok: true, action: parsed.data.action, at: timestamp });
}
