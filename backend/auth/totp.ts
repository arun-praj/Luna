import "server-only";

import * as OTPAuth from "otpauth";

export function createTotpSecret() {
  return new OTPAuth.Secret({ size: 20 });
}

export function createTotp(secret: OTPAuth.Secret, email: string) {
  return new OTPAuth.TOTP({
    issuer: "Luna",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });
}

export function verifyTotp(secretValue: string, email: string, code: string) {
  try {
    const secret = OTPAuth.Secret.fromBase32(secretValue);
    const totp = createTotp(secret, email);
    return totp.validate({ token: code.replace(/\s/g, ""), window: 1 }) !== null;
  } catch {
    return false;
  }
}
