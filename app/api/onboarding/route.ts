import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { db } from "@/backend/db/client";
import { accounts, categories, users } from "@/backend/db/schema";
import { accountType } from "@/backend/domain/validation";
import { z } from "zod";
import { isAvatarPreset } from "@/lib/avatar";

export const runtime = "nodejs";

const onboardingInput = z.object({
  name: z.string().trim().min(1).max(100),
  currency: z.string().trim().toUpperCase().length(3).default("NPR"),
  avatarPreset: z.string().trim().max(200).refine(isAvatarPreset).default("sunrise"),
  accounts: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    type: accountType,
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
  })).min(1).max(12),
  categories: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    type: z.enum(["expense", "income"]),
    icon: z.string().trim().max(100),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
  })).min(1).max(50),
});

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = onboardingInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Please complete your profile, accounts, and categories", 400);

  const timestamp = new Date().toISOString();
  const [user] = await db.select({ currency: users.currency }).from(users).where(eq(users.id, userId)).limit(1);
  await db.update(users).set({ name: parsed.data.name, currency: parsed.data.currency, avatarPreset: parsed.data.avatarPreset, onboardingCompleted: true, updatedAt: timestamp }).where(eq(users.id, userId));
  for (const [index, account] of parsed.data.accounts.entries()) {
    await db.insert(accounts).values({
      id: randomUUID(), userId, name: account.name, type: account.type, currency: user?.currency ?? "NPR",
      openingBalance: 0, currentBalance: 0, isDefault: index === 0, displayOrder: index, backgroundColor: account.color,
      icon: null, includeInTotalBalance: true,
    });
  }
  for (const category of parsed.data.categories) {
    await db.insert(categories).values({ id: randomUUID(), userId, name: category.name, type: category.type, icon: category.icon, color: category.color });
  }

  const [updatedUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return updatedUser ? NextResponse.json({ user: { id: updatedUser.id, name: updatedUser.name, onboardingCompleted: updatedUser.onboardingCompleted } }) : errorResponse("Authentication required", 401);
}
