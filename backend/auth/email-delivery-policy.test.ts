import assert from "node:assert/strict";
import test from "node:test";

import { executeVerificationEmailDelivery, verificationEmailResponse } from "./email-delivery-policy.ts";

test("background verification delivery is reported as queued until it settles", () => {
  assert.deepEqual(verificationEmailResponse("queued"), {
    verificationEmailSent: false,
    verificationEmailQueued: true,
    verificationEmailDelivery: "queued",
  });
});

test("email failures remain recoverable through the resend action", () => {
  assert.deepEqual(verificationEmailResponse("failed"), {
    verificationEmailSent: false,
    verificationEmailQueued: false,
    verificationEmailDelivery: "failed",
  });
  assert.deepEqual(verificationEmailResponse("unavailable"), {
    verificationEmailSent: false,
    verificationEmailQueued: false,
    verificationEmailDelivery: "unavailable",
  });
});

test("a synchronous mail failure cleans up the one-time code", async () => {
  let cleanupCalls = 0;
  const delivery = await executeVerificationEmailDelivery({
    send: async () => { throw new Error("smtp unavailable"); },
    context: null,
    onFailure: async () => { cleanupCalls += 1; },
  });

  assert.equal(delivery, "failed");
  assert.equal(cleanupCalls, 1);
});

test("a Worker background failure is still observed by waitUntil cleanup", async () => {
  let backgroundTask: Promise<unknown> | undefined;
  let cleanupCalls = 0;
  const delivery = await executeVerificationEmailDelivery({
    send: async () => { throw new Error("smtp unavailable"); },
    context: { waitUntil(task) { backgroundTask = task; } },
    onFailure: async () => { cleanupCalls += 1; },
  });

  assert.equal(delivery, "queued");
  assert.ok(backgroundTask);
  await backgroundTask;
  assert.equal(cleanupCalls, 1);
});
