import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/backend/db/client";
import { users } from "@/backend/db/schema";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { verifyEmailVerificationCode } from "@/backend/auth/email-verification";

export const runtime = "nodejs";

const input = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") });

export async function POST(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return errorResponse("Authentication required", 401);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Enter the 6-digit verification code", 400);
  const [user] = await db.select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return errorResponse("Authentication required", 401);
  if (user.emailVerifiedAt) return NextResponse.json({ verified: true, message: "Your email is already verified." });
  const result = await verifyEmailVerificationCode(userId, parsed.data.code);
  if (!result.valid) return errorResponse(result.exhausted ? "That code has expired. Request a new one." : "That code is not correct", 400);
  const now = new Date().toISOString();
  await db.update(users).set({ emailVerifiedAt: now, updatedAt: now }).where(eq(users.id, userId));
  return NextResponse.json({ verified: true, message: "Email verified." });
}
