import "server-only";

export const ACCESS_TOKEN_TTL_SECONDS = 30 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const REFRESH_TOKEN_COOKIE = "budget_refresh_token";

export function getJwtSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_JWT_SECRET must be configured with at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}
