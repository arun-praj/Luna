import "server-only";

import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
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

  const windowCutoff = new Date(now - options.windowMs).toISOString();
  const [updated] = await db
    .update(authRateLimits)
    .set({
      windowStartedAt: sql`CASE WHEN ${authRateLimits.windowStartedAt} < ${windowCutoff} THEN ${timestamp} ELSE ${authRateLimits.windowStartedAt} END`,
      attempts: sql`CASE WHEN ${authRateLimits.windowStartedAt} < ${windowCutoff} THEN 1 ELSE ${authRateLimits.attempts} + 1 END`,
      updatedAt: timestamp,
    })
    .where(eq(authRateLimits.key, key))
    .returning({
      windowStartedAt: authRateLimits.windowStartedAt,
      attempts: authRateLimits.attempts,
    });

  if (!updated) return { allowed: true, retryAfterSeconds: 0 };

  const windowStartedAt = Date.parse(updated.windowStartedAt);
  const retryAfterSeconds = Number.isFinite(windowStartedAt)
    ? Math.max(1, Math.ceil((windowStartedAt + options.windowMs - now) / 1000))
    : Math.max(1, Math.ceil(options.windowMs / 1000));
  return {
    allowed: updated.attempts <= options.limit,
    retryAfterSeconds: updated.attempts > options.limit ? retryAfterSeconds : 0,
  };
}

/** Remove stale counters from completed rate-limit windows. */
export async function pruneExpiredRateLimitRows(now = Date.now()) {
  const retentionMs = 24 * 60 * 60 * 1000;
  await db.delete(authRateLimits).where(
    sql`${authRateLimits.updatedAt} < ${new Date(now - retentionMs).toISOString()}`,
  );
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
