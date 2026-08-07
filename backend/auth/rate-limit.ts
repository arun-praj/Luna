import "server-only";

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { authRateLimits } from "@/backend/db/schema";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

function clientAddress(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ??
    "unknown"
  );
}

function keyFor(request: Request, scope: string, identifier?: string) {
  const raw = `${scope}|${clientAddress(request)}|${identifier ?? ""}`;
  return createHash("sha256").update(raw).digest("hex");
}

export async function checkRateLimit(
  request: Request,
  scope: string,
  options: RateLimitOptions,
  identifier?: string,
) {
  const key = keyFor(request, scope, identifier);
  const now = Date.now();
  const timestamp = new Date(now).toISOString();

  await db.insert(authRateLimits).values({
    key,
    windowStartedAt: timestamp,
    attempts: 0,
    updatedAt: timestamp,
  }).onConflictDoNothing();

  const [current] = await db.select().from(authRateLimits).where(eq(authRateLimits.key, key)).limit(1);
  if (!current) return { allowed: true, retryAfterSeconds: 0 };

  const windowStartedAt = Date.parse(current.windowStartedAt);
  const windowExpired = !Number.isFinite(windowStartedAt) || now - windowStartedAt >= options.windowMs;
  if (windowExpired) {
    await db.update(authRateLimits).set({ windowStartedAt: timestamp, attempts: 1, updatedAt: timestamp }).where(eq(authRateLimits.key, key));
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.attempts >= options.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowStartedAt + options.windowMs - now) / 1000)),
    };
  }

  await db.update(authRateLimits).set({ attempts: current.attempts + 1, updatedAt: timestamp }).where(eq(authRateLimits.key, key));
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Reads a limit without recording an attempt. Login uses this before checking
 * credentials so successful sign-ins never consume a failed-login allowance.
 */
export async function peekRateLimit(
  request: Request,
  scope: string,
  options: RateLimitOptions,
  identifier?: string,
) {
  const key = keyFor(request, scope, identifier);
  const [current] = await db.select().from(authRateLimits).where(eq(authRateLimits.key, key)).limit(1);
  if (!current) return { allowed: true, retryAfterSeconds: 0 };

  const now = Date.now();
  const windowStartedAt = Date.parse(current.windowStartedAt);
  if (!Number.isFinite(windowStartedAt) || now - windowStartedAt >= options.windowMs) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.attempts < options.limit) return { allowed: true, retryAfterSeconds: 0 };
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((windowStartedAt + options.windowMs - now) / 1000)),
  };
}

export function rateLimitHeaders(retryAfterSeconds: number) {
  return { "Retry-After": String(retryAfterSeconds) };
}
