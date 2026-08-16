import assert from "node:assert/strict";
import test from "node:test";

import {
  REGISTRATION_HANDOFF_DELAY_MS,
  remainingRegistrationHandoffMs,
} from "./auth-flow.ts";

test("signup keeps the loading handoff at about one second", () => {
  const startedAt = 10_000;

  assert.equal(
    remainingRegistrationHandoffMs(startedAt, startedAt),
    REGISTRATION_HANDOFF_DELAY_MS,
  );
  assert.equal(remainingRegistrationHandoffMs(startedAt, startedAt + 400), 600);
  assert.equal(remainingRegistrationHandoffMs(startedAt, startedAt + 1_001), 0);
});

test("a clock moving backwards never creates a negative handoff", () => {
  assert.equal(remainingRegistrationHandoffMs(10_000, 9_000), REGISTRATION_HANDOFF_DELAY_MS);
});
