import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { users } from "@/backend/db/schema";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";


export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const [user] = await db.select({ dismissedAt: users.pwaInstallDismissedAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return errorResponse("Authentication required", 401);
  return NextResponse.json({ dismissedAt: user.dismissedAt ?? null });
}

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const dismissedAt = new Date().toISOString();
  await db.update(users).set({ pwaInstallDismissedAt: dismissedAt, updatedAt: dismissedAt }).where(eq(users.id, userId));
  return NextResponse.json({ dismissedAt });
}
