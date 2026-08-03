import "server-only";

import { env } from "cloudflare:workers";

export function r2Configured() {
  return Boolean(env.R2);
}

export function r2Bucket(): R2Bucket {
  return env.R2;
}
