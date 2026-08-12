import assert from "node:assert/strict";
import test from "node:test";

import { canRecordTwoFactorChallengeAttempt, isConsumedTwoFactorChallenge, TWO_FACTOR_MAX_ATTEMPTS } from "./two-factor-challenge-policy.ts";

test("two-factor challenges have a finite attempt budget", () => {
  assert.equal(TWO_FACTOR_MAX_ATTEMPTS, 5);
  assert.equal(TWO_FACTOR_MAX_ATTEMPTS + 1, 6);
});

test("challenge consumption is a terminal state after the successful attempt", () => {
  assert.equal(canRecordTwoFactorChallengeAttempt(4), true);
  assert.equal(canRecordTwoFactorChallengeAttempt(5), false);
  assert.equal(isConsumedTwoFactorChallenge(6), true);
  assert.equal(canRecordTwoFactorChallengeAttempt(6), false);
  assert.equal(isConsumedTwoFactorChallenge(5), false);
});
