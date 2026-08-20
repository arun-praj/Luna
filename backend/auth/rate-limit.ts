import "server-only";

import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/backend/db/client";
import { authRateLimits } from "@/backend/db/schema";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  keyBy?: "ip" | "identifier" | "ip-and-identifier";
  cooldownSeconds?: (attempts: number) => number;
};

function clientAddress(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ??
    "unknown"
  );
}

function keyFor(request: Request, scope: string, identifier: string | undefined, keyBy: RateLimitOptions["keyBy"] = "ip-and-identifier") {
  const address = keyBy === "identifier" ? "" : clientAddress(request);
  const subject = keyBy === "ip" ? "" : identifier ?? "";
  const raw = `${scope}|${address}|${subject}`;
  return createHash("sha256").update(raw).digest("hex");
}

export async function checkRateLimit(
  request: Request,
  scope: string,
  options: RateLimitOptions,
  identifier?: string,
) {
  const key = keyFor(request, scope, identifier, options.keyBy);
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
      updatedAt: authRateLimits.updatedAt,
    });

  if (!updated) return { allowed: true, retryAfterSeconds: 0, attempts: 0 };

  const windowStartedAt = Date.parse(updated.windowStartedAt);
  const windowRetryAfterSeconds = Number.isFinite(windowStartedAt)
    ? Math.max(1, Math.ceil((windowStartedAt + options.windowMs - now) / 1000))
    : Math.max(1, Math.ceil(options.windowMs / 1000));
  const cooldownRetryAfterSeconds = options.cooldownSeconds
    ? Math.max(0, Math.ceil((Date.parse(updated.updatedAt) + options.cooldownSeconds(updated.attempts) * 1000 - now) / 1000))
    : 0;
  const retryAfterSeconds = Math.max(cooldownRetryAfterSeconds, updated.attempts > options.limit ? windowRetryAfterSeconds : 0);
  return {
    allowed: updated.attempts <= options.limit && cooldownRetryAfterSeconds === 0,
    retryAfterSeconds: updated.attempts <= options.limit && cooldownRetryAfterSeconds === 0 ? 0 : retryAfterSeconds,
    attempts: updated.attempts,
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
  const key = keyFor(request, scope, identifier, options.keyBy);
  const [current] = await db.select().from(authRateLimits).where(eq(authRateLimits.key, key)).limit(1);
  if (!current) return { allowed: true, retryAfterSeconds: 0 };

  const now = Date.now();
  const windowStartedAt = Date.parse(current.windowStartedAt);
  if (!Number.isFinite(windowStartedAt) || now - windowStartedAt >= options.windowMs) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.attempts < options.limit) {
    const cooldownSeconds = options.cooldownSeconds?.(current.attempts) ?? 0;
    const cooldownRetryAfterSeconds = cooldownSeconds
      ? Math.max(0, Math.ceil((Date.parse(current.updatedAt) + cooldownSeconds * 1000 - now) / 1000))
      : 0;
    if (cooldownRetryAfterSeconds > 0) return { allowed: false, retryAfterSeconds: cooldownRetryAfterSeconds };
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((windowStartedAt + options.windowMs - now) / 1000)),
  };
}

export function verificationResendCooldownSeconds(attempts: number) {
  return Math.min(15 * 60, 30 * 2 ** Math.max(0, attempts - 1));
}

export function rateLimitHeaders(retryAfterSeconds: number) {
  return { "Retry-After": String(retryAfterSeconds) };
}
