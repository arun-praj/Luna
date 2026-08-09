import handler from "vinext/server/app-router-entry";
import { runScheduledNotifications } from "@/backend/notifications/scheduler";
import { runScheduledReports } from "@/backend/reports/scheduler";
import { runScheduledRecurringTransactions } from "@/backend/domain/recurring-service";
import { runScheduledHomeAlerts } from "@/backend/domain/home-alert-service";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ');

function withSecurityHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
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
    return withSecurityHeaders(await handler.fetch(request, env, ctx));
  },
  async scheduled(controller: ScheduledController) {
    const results = await Promise.allSettled([
      runScheduledNotifications(new Date(controller.scheduledTime)),
      runScheduledReports(new Date(controller.scheduledTime)),
      runScheduledRecurringTransactions(new Date(controller.scheduledTime)),
      runScheduledHomeAlerts(new Date(controller.scheduledTime)),
    ]);
    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failures.length > 0) {
      console.error("Luna scheduled jobs failed", {
        cron: controller.cron,
        scheduledTime: controller.scheduledTime,
        failures: failures.map(({ reason }) =>
          reason instanceof Error ? reason.message : String(reason),
        ),
      });
      // Let the scheduled invocation fail so Cloudflare can retry transient
      // D1, push-service, or SMTP failures. Use noRetry only for a deliberate
      // permanent failure, not for every unexpected exception.
      throw new Error(`Luna scheduled jobs failed: ${failures.length}`);
    }
  },
};

export default lunaWorker;
