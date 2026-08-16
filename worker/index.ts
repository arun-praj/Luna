import handler from "vinext/server/app-router-entry";
import { runWithExecutionContext } from "vinext/shims/request-context";
import { runScheduledNotifications } from "@/backend/notifications/scheduler";
import { runScheduledReports, runScheduledReportTests } from "@/backend/reports/scheduler";
import { runScheduledRecurringTransactions } from "@/backend/domain/recurring-service";
import { runScheduledHomeAlerts } from "@/backend/domain/home-alert-service";
import { pruneExpiredRateLimitRows } from "@/backend/auth/rate-limit";
import { runScheduledUploadMaintenance } from "@/backend/storage/upload-lifecycle";
import { runScheduledAuthMaintenance } from "@/backend/auth/maintenance";

function contentSecurityPolicy(nonce: string) {
  return [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ].join('; ');
}

function withSecurityHeaders(response: Response, requestId: string, csp: string) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", csp);
  headers.set("X-Request-ID", requestId);
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const lunaWorker = {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    const incomingRequestId = request.headers.get("x-request-id");
    const requestId = incomingRequestId && /^[A-Za-z0-9._-]{1,100}$/.test(incomingRequestId)
      ? incomingRequestId
      : crypto.randomUUID();
    const nonce = btoa(crypto.randomUUID());
    const csp = contentSecurityPolicy(nonce);
    const forwardedHeaders = new Headers(request.headers);
    forwardedHeaders.set("Content-Security-Policy", csp);
    forwardedHeaders.set("x-nonce", nonce);
    forwardedHeaders.set("x-request-id", requestId);

    try {
      const response = await runWithExecutionContext(ctx, () =>
        handler.fetch(new Request(request, { headers: forwardedHeaders }), env, ctx),
      );
      return withSecurityHeaders(response, requestId, csp);
    } catch (error) {
      console.error(JSON.stringify({
        event: "request_error",
        requestId,
        method: request.method,
        pathname: new URL(request.url).pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      return withSecurityHeaders(
        Response.json({ error: "Internal server error", requestId }, { status: 500 }),
        requestId,
        csp,
      );
    }
  },
  async scheduled(controller: ScheduledController) {
    const results = await Promise.allSettled([
      runScheduledNotifications(new Date(controller.scheduledTime)),
      runScheduledReports(new Date(controller.scheduledTime)),
      runScheduledReportTests(new Date(controller.scheduledTime)),
      runScheduledRecurringTransactions(new Date(controller.scheduledTime)),
      runScheduledHomeAlerts(new Date(controller.scheduledTime)),
      runScheduledUploadMaintenance(new Date(controller.scheduledTime)),
      runScheduledAuthMaintenance(new Date(controller.scheduledTime)),
      pruneExpiredRateLimitRows(),
    ]);
    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failures.length > 0) {
      console.error(JSON.stringify({
        event: "scheduled_jobs_failed",
        cron: controller.cron,
        scheduledTime: controller.scheduledTime,
        failures: failures.map(({ reason }) =>
          reason instanceof Error ? reason.message : String(reason),
        ),
      }));
      // Let the scheduled invocation fail so Cloudflare can retry transient
      // D1, push-service, or SMTP failures. Use noRetry only for a deliberate
      // permanent failure, not for every unexpected exception.
      throw new Error(`Luna scheduled jobs failed: ${failures.length}`);
    }
  },
};

export default lunaWorker;
