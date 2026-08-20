import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultNotificationSettings,
  pushSubscriptionFingerprint,
} from "./notifications.ts";

test("notification defaults include a separate recurring payment due time", () => {
  assert.equal(defaultNotificationSettings("user-a").recurringDueTime, "09:00");
});

test("push subscription fingerprints include delivery identity but ignore unrelated fields", () => {
  const subscription = {
    endpoint: "https://push.example/device-a",
    expirationTime: null,
    keys: { auth: "auth-a", p256dh: "key-a" },
  };
  assert.equal(
    pushSubscriptionFingerprint({ ...subscription, extra: "ignored" } as typeof subscription),
    pushSubscriptionFingerprint(subscription),
  );
  assert.notEqual(
    pushSubscriptionFingerprint(subscription),
    pushSubscriptionFingerprint({ ...subscription, endpoint: "https://push.example/device-b" }),
  );
  assert.equal(pushSubscriptionFingerprint(null), null);
});
