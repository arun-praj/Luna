import assert from "node:assert/strict";
import test from "node:test";

import { canRecoverUnverifiedSignup } from "./signup-recovery.ts";

test("a matching password can recover an unverified account through OTP", () => {
  assert.equal(canRecoverUnverifiedSignup({ emailVerifiedAt: null }, true), true);
  assert.equal(canRecoverUnverifiedSignup({ emailVerifiedAt: "2026-08-16T00:00:00.000Z" }, true), false);
  assert.equal(canRecoverUnverifiedSignup({ emailVerifiedAt: null }, false), false);
});
