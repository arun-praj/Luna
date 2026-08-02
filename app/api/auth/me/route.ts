import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { getUserById } from "@/backend/auth/tokens";
import { db } from "@/backend/db/client";
import { users } from "@/backend/db/schema";
import { toPublicUserProfile } from "@/backend/auth/profile";
import { isAvatarPreset } from "@/lib/avatar";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const user = await getUserById(userId);
  return user ? NextResponse.json({ user: toPublicUserProfile(user) }) : errorResponse("Authentication required", 401);
}

export async function PATCH(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    currency: z.string().trim().toUpperCase().length(3).optional(),
    avatarPreset: z.string().trim().max(200).refine(isAvatarPreset).optional(),
  }).refine((value) => value.name !== undefined || value.currency !== undefined || value.avatarPreset !== undefined).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid profile update", 400);
  const updates = { updatedAt: new Date().toISOString(), ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}), ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency } : {}), ...(parsed.data.avatarPreset !== undefined ? { avatarPreset: parsed.data.avatarPreset } : {}) };
  await db.update(users).set(updates).where(eq(users.id, userId));
  const user = await getUserById(userId);
  return user ? NextResponse.json({ user: toPublicUserProfile(user) }) : errorResponse("Authentication required", 401);
}
