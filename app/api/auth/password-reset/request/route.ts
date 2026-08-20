import { randomBytes, randomUUID, createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/backend/db/client";
import { passwordResetTokens, users } from "@/backend/db/schema";
import { errorResponse, requireAccessToken } from "@/backend/auth/http";
import { isSmtpConfigured, sendPasswordResetEmail } from "@/backend/auth/email";
import { z } from "zod";
import { checkRateLimit, rateLimitHeaders } from "@/backend/auth/rate-limit";


const input = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()).optional() });

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Enter a valid email address", 400);
  const ipLimit = await checkRateLimit(request, "password-reset-ip", { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!ipLimit.allowed) return NextResponse.json({ error: "Too many password reset requests. Try again later." }, { status: 429, headers: rateLimitHeaders(ipLimit.retryAfterSeconds) });
  const authenticatedUserId = await requireAccessToken(request);
  let targetEmail = parsed.data.email;
  if (authenticatedUserId) {
    const [authenticatedUser] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, authenticatedUserId)).limit(1);
    if (!authenticatedUser) return errorResponse("Authentication required", 401);
    if (targetEmail && targetEmail !== authenticatedUser.email) return errorResponse("For your security, use the email address for the signed-in account", 400);
    targetEmail = authenticatedUser.email;
  }
  if (!targetEmail) return errorResponse("Enter a valid email address", 400);
  const emailLimit = await checkRateLimit(request, "password-reset-email", { limit: 5, windowMs: 60 * 60 * 1000 }, targetEmail);
  if (!emailLimit.allowed) return NextResponse.json({ error: "Too many password reset requests. Try again later." }, { status: 429, headers: rateLimitHeaders(emailLimit.retryAfterSeconds) });
  if (!isSmtpConfigured()) return errorResponse("Password reset email is not configured yet", 503);

  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, targetEmail)).limit(1);
  if (user) {
    const rawToken = randomBytes(32).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    await db.delete(passwordResetTokens).where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
    await db.insert(passwordResetTokens).values({ id: randomUUID(), userId: user.id, tokenHash: createHash("sha256").update(rawToken).digest("hex"), expiresAt: expiresAt.toISOString(), usedAt: null, createdAt: now.toISOString() });
    const appUrl = process.env.APP_URL || new URL(request.url).origin;
    try {
      await sendPasswordResetEmail({ to: user.email, resetUrl: `${appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(rawToken)}` });
    } catch {
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, createHash("sha256").update(rawToken).digest("hex")));
      return errorResponse("Could not send the password reset email", 503);
    }
  }

  return NextResponse.json({ message: "If an account exists for that email, a password reset link is on its way." });
}
