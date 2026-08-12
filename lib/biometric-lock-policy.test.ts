import test from "node:test";
import assert from "node:assert/strict";
import { shouldEvaluateBiometricLockForEntry } from "./biometric-lock-policy.ts";

test("biometric lock is evaluated for the first private app entry", () => {
  assert.equal(shouldEvaluateBiometricLockForEntry({ isPublicPath: false, userId: "user-1", initializedUserId: null }), true);
});

test("navigation for the same user does not re-lock the app", () => {
  assert.equal(shouldEvaluateBiometricLockForEntry({ isPublicPath: false, userId: "user-1", initializedUserId: "user-1" }), false);
});

test("public routes and signed-out state never trigger biometric unlock", () => {
  assert.equal(shouldEvaluateBiometricLockForEntry({ isPublicPath: true, userId: "user-1", initializedUserId: null }), false);
  assert.equal(shouldEvaluateBiometricLockForEntry({ isPublicPath: false, userId: null, initializedUserId: null }), false);
});
