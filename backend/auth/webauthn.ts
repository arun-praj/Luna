import "server-only";

export function webAuthnConfig(request?: Request) {
  const configuredOrigin = process.env.APP_URL?.replace(/\/$/, "");
  if (configuredOrigin) {
    const url = new URL(configuredOrigin);
    return { origin: configuredOrigin, rpID: process.env.WEBAUTHN_RP_ID || url.hostname };
  }
  if (process.env.NODE_ENV === "production") throw new Error("APP_URL must be configured for WebAuthn");
  const origin = request ? new URL(request.url).origin : "http://localhost:3000";
  return { origin, rpID: new URL(origin).hostname };
}

export function bytesToBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

export function base64UrlToBytes(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}
