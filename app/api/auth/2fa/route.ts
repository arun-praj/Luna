import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/backend/db/client";
import { users } from "@/backend/db/schema";
import { requireAccessToken, errorResponse } from "@/backend/auth/http";
import { decryptSecret, encryptSecret } from "@/backend/auth/crypto";
import { createTotp, createTotpSecret, verifyTotp } from "@/backend/auth/totp";
import { consumeBackupCode, createBackupCodes, parseBackupCodeHashes } from "@/backend/auth/two-factor";


const codeInput = z.object({ code: z.string().trim().min(6).max(20) });

async function currentUser(request: Request) {
  const userId = await requireAccessToken(request);
  if (!userId) return null;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return errorResponse("Authentication required", 401);
  return NextResponse.json({ enabled: user.twoFactorEnabled, backupCodesRemaining: parseBackupCodeHashes(user.twoFactorBackupCodes).length });
}

export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return errorResponse("Authentication required", 401);
  if (user.twoFactorEnabled) return errorResponse("Authenticator protection is already enabled", 409);
  const secret = createTotpSecret();
  const totp = createTotp(secret, user.email);
  await db.update(users).set({ twoFactorSetupSecretEncrypted: encryptSecret(secret.base32), updatedAt: new Date().toISOString() }).where(eq(users.id, user.id));
  return NextResponse.json({ secret: secret.base32, otpauthUri: totp.toString(), qrCodeDataUrl: await QRCode.toDataURL(totp.toString(), { width: 240, margin: 1 }) });
}

export async function PUT(request: Request) {
  const user = await currentUser(request);
  if (!user) return errorResponse("Authentication required", 401);
  if (user.twoFactorEnabled) return errorResponse("Authenticator protection is already enabled", 409);
  const parsed = codeInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !user.twoFactorSetupSecretEncrypted) return errorResponse("Start authenticator setup first", 400);
  let secret: string;
  try {
    secret = decryptSecret(user.twoFactorSetupSecretEncrypted);
  } catch {
    return errorResponse("Authenticator setup expired. Start again", 400);
  }
  if (!verifyTotp(secret, user.email, parsed.data.code)) return errorResponse("That authenticator code is not valid", 400);
  const { codes, hashes } = await createBackupCodes();
  await db.update(users).set({ twoFactorEnabled: true, otpEnabled: true, twoFactorSecretEncrypted: encryptSecret(secret), twoFactorSetupSecretEncrypted: null, twoFactorBackupCodes: JSON.stringify(hashes), twoFactorVerifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(users.id, user.id));
  return NextResponse.json({ enabled: true, backupCodes: codes });
}

export async function PATCH(request: Request) {
  const user = await currentUser(request);
  if (!user) return errorResponse("Authentication required", 401);
  if (!user.twoFactorEnabled || !user.twoFactorSecretEncrypted) return errorResponse("Authenticator protection is not enabled", 400);
  const parsed = codeInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Enter your authenticator code", 400);
  let secret: string;
  try {
    secret = decryptSecret(user.twoFactorSecretEncrypted);
  } catch {
    return errorResponse("Authenticator configuration is unavailable", 500);
  }
  const hashes = parseBackupCodeHashes(user.twoFactorBackupCodes);
  const validTotp = verifyTotp(secret, user.email, parsed.data.code);
  const backup = validTotp ? { matched: true, remaining: hashes } : await consumeBackupCode(parsed.data.code, hashes);
  if (!backup.matched) return errorResponse("That code is not valid", 400);
  await db.update(users).set({ twoFactorEnabled: false, otpEnabled: false, twoFactorSecretEncrypted: null, twoFactorSetupSecretEncrypted: null, twoFactorBackupCodes: null, twoFactorVerifiedAt: null, updatedAt: new Date().toISOString() }).where(eq(users.id, user.id));
  return NextResponse.json({ enabled: false });
}
