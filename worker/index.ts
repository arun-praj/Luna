import handler from "vinext/server/app-router-entry";

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },
};
