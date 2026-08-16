import assert from "node:assert/strict";
import test from "node:test";
import { emailVerificationPath, isAuthRedirectExemptPath, isPublicAuthPath, persistPendingRegistrationToken, shouldApplySessionProbeRedirect } from "./auth-client.ts";

test("email verification stays outside the auth-expiry redirect loop", () => {
  assert.equal(isPublicAuthPath("/verify-email"), true);
  assert.equal(isAuthRedirectExemptPath("/verify-email"), true);
  assert.equal(isAuthRedirectExemptPath("/"), false);
});

test("a cancelled login session probe cannot redirect after submit begins", () => {
  const controller = new AbortController();

  assert.equal(shouldApplySessionProbeRedirect(true, controller.signal), true);
  controller.abort();
  assert.equal(shouldApplySessionProbeRedirect(true, controller.signal), false);
  assert.equal(shouldApplySessionProbeRedirect(false, controller.signal), false);
});

test("verification navigation carries only the safe destination and delivery state", () => {
  assert.equal(
    emailVerificationPath("/onboarding", "queued"),
    "/verify-email?next=%2Fonboarding&emailDelivery=queued",
  );
  assert.equal(emailVerificationPath("//external.example", "sent"), "/verify-email?next=%2F&emailDelivery=sent");
});

test("the signed verification token is persisted before navigation", () => {
  const values = new Map<string, string>();
  const storage = {
    setItem(key: string, value: string) { values.set(key, value); },
    getItem(key: string) { return values.get(key) ?? null; },
  };
  const token = "signed-pending-registration-token";

  assert.equal(persistPendingRegistrationToken(storage, token), true);
  assert.deepEqual([...values.values()], [token]);
});
