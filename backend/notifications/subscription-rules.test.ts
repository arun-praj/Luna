import assert from "node:assert/strict";
import test from "node:test";
import {
  deliveryStatusForHttpStatus,
  isExpiredPushStatus,
  sanitizedDeliveryError,
  shouldAttemptDelivery,
  summarizeDeliveryStatuses,
  uniqueActiveSubscriptions,
} from "./subscription-rules.ts";

test("delivery fans out to distinct active devices and isolates expiry", () => {
  const subscriptions = uniqueActiveSubscriptions([
    { endpoint: "https://push.example/a", active: true },
    { endpoint: "https://push.example/b", active: true },
    { endpoint: "https://push.example/a", active: true },
    { endpoint: "https://push.example/c", active: false },
  ]);

  assert.deepEqual(subscriptions.map(({ endpoint }) => endpoint), [
    "https://push.example/a",
    "https://push.example/b",
  ]);
  assert.deepEqual(summarizeDeliveryStatuses(["sent", "subscription_expired"]), {
    attemptedDeviceCount: 2,
    deliveredDeviceCount: 1,
    deliveryStatus: "partial",
  });
  assert.equal(isExpiredPushStatus(404), true);
  assert.equal(isExpiredPushStatus(410), true);
  assert.equal(isExpiredPushStatus(500), false);
});

test("delivery diagnostics are sanitized and sent occurrences are deduped", () => {
  assert.equal(deliveryStatusForHttpStatus(410), "subscription_expired");
  assert.equal(deliveryStatusForHttpStatus(503), "failed");
  assert.equal(sanitizedDeliveryError(503, "failed"), "push_http_503");
  assert.equal(sanitizedDeliveryError(410, "subscription_expired"), "subscription_expired");
  assert.equal(shouldAttemptDelivery("sent"), false);
  assert.equal(shouldAttemptDelivery("partial"), false);
  assert.equal(shouldAttemptDelivery("failed"), true);
});

