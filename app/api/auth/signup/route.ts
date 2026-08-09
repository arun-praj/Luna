import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/backend/db/client";
import { users } from "@/backend/db/schema";
import { createSession } from "@/backend/auth/tokens";
import { errorResponse, setRefreshTokenCookie } from "@/backend/auth/http";
import { hashPassword } from "@/backend/auth/password";
import { toPublicUserProfile } from "@/backend/auth/profile";
import { signupInput } from "@/backend/auth/validation";
import { isSmtpConfigured, sendEmailVerificationEmail } from "@/backend/auth/email";
import { createEmailVerificationCode, EMAIL_VERIFICATION_MINUTES } from "@/backend/auth/email-verification";
import { checkRateLimit, rateLimitHeaders } from "@/backend/auth/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = signupInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid signup details", 400);
  const signupLimit = await checkRateLimit(request, "signup-ip", { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!signupLimit.allowed) return NextResponse.json({ error: "Too many signup attempts. Try again later." }, { status: 429, headers: rateLimitHeaders(signupLimit.retryAfterSeconds) });
  if (parsed.data.otpEnabled) return errorResponse("OTP delivery is not configured yet", 501);

  const [existing] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (existing) return errorResponse("Unable to create account with those details", 409);

  const timestamp = new Date().toISOString();
  const user = { id: randomUUID(), name: "", email: parsed.data.email, phone: parsed.data.phone ?? null, passwordHash: await hashPassword(parsed.data.password), currency: parsed.data.currency, hideTotalBalance: false, monthlyReportEnabled: false, onboardingCompleted: false, tutorialStartedAt: null, tutorialCompletedAt: null, otpEnabled: false, twoFactorEnabled: false, twoFactorSecretEncrypted: null, twoFactorSetupSecretEncrypted: null, twoFactorBackupCodes: null, twoFactorVerifiedAt: null, emailVerifiedAt: null, phoneVerifiedAt: null, pwaInstallDismissedAt: null, lastLoginAt: null, avatarPreset: "sunrise", createdAt: timestamp, updatedAt: timestamp };
  await db.insert(users).values(user);

  const session = await createSession(user.id);
  let verificationEmailSent = false;
  if (isSmtpConfigured()) {
    try {
      const verification = await createEmailVerificationCode(user.id);
      await sendEmailVerificationEmail({ to: user.email, code: verification.code, expiresMinutes: EMAIL_VERIFICATION_MINUTES });
      verificationEmailSent = true;
    } catch {
      // Account creation is still complete; the verification screen can retry delivery.
    }
  }
  const response = NextResponse.json({ user: toPublicUserProfile(user), accessToken: session.accessToken, expiresIn: session.expiresIn, emailVerificationRequired: true, verificationEmailSent }, { status: 201 });
  setRefreshTokenCookie(response, session.refreshToken);
  return response;
}
