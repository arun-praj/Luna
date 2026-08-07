import "server-only";

export const ACCESS_TOKEN_TTL_SECONDS = 30 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 180 * 24 * 60 * 60;
// A short grace period makes refresh rotation idempotent across tabs, mobile
// browsers, and service-worker retries without weakening replay detection for
// genuinely old refresh tokens.
export const REFRESH_TOKEN_ROTATION_GRACE_SECONDS = 15;
export const REFRESH_TOKEN_COOKIE = "budget_refresh_token";

export function getJwtSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_JWT_SECRET must be configured with at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}
