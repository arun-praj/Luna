import handler from "vinext/server/app-router-entry";
import { runScheduledNotifications } from "@/backend/notifications/scheduler";

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },
  async scheduled(controller: ScheduledController) {
    try {
      await runScheduledNotifications(new Date(controller.scheduledTime));
    } catch (error) {
      console.error("Luna scheduled notifications failed", error);
      controller.noRetry();
    }
  },
};
