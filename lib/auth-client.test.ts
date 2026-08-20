import assert from "node:assert/strict";
import test from "node:test";
import { buildRevalidationKey, didAuthenticatedSubjectChange, emailVerificationPath, isAuthRedirectExemptPath, isCurrentApiCacheEpoch, isOwnedApiCacheEntry, isPublicAuthPath, isStableAuthenticatedSubject, persistPendingRegistrationToken, shouldApplySessionProbeRedirect, shouldResetAuthenticatedApiCache } from "./auth-client.ts";

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

test("fresh revalidation generations bypass pre-mutation requests while normal requests dedupe", () => {
  const url = "https://luna.test/api/transactions";
  assert.equal(buildRevalidationKey("user-a", "GET", url), buildRevalidationKey("user-a", "GET", url));
  assert.notEqual(buildRevalidationKey("user-a", "GET", url), buildRevalidationKey("user-a", "GET", url, 1));
});

test("fresh responses require an exact authenticated subject", () => {
  assert.equal(isStableAuthenticatedSubject("user-a", "user-a"), true);
  assert.equal(isStableAuthenticatedSubject(null, "user-a"), false);
  assert.equal(isStableAuthenticatedSubject("user-a", "user-b"), false);
});

test("authenticated subject changes are only detected between two different subjects", () => {
  assert.equal(didAuthenticatedSubjectChange(null, "user-a"), false);
  assert.equal(didAuthenticatedSubjectChange("user-a", null), false);
  assert.equal(didAuthenticatedSubjectChange("user-a", "user-a"), false);
  assert.equal(didAuthenticatedSubjectChange("user-a", "user-b"), true);
});

test("API cache resets for cold restoration and subject changes without resetting Home snapshots for the same user", () => {
  assert.equal(shouldResetAuthenticatedApiCache(null, "user-a"), true);
  assert.equal(shouldResetAuthenticatedApiCache("user-a", "user-b"), true);
  assert.equal(shouldResetAuthenticatedApiCache("user-a", "user-a"), false);
});

test("an old API request cannot write after the cache epoch advances", () => {
  assert.equal(isCurrentApiCacheEpoch(3, 3), true);
  assert.equal(isCurrentApiCacheEpoch(2, 3), false);
});

test("API cache entries require an exact authenticated owner before they can be returned", () => {
  assert.equal(isOwnedApiCacheEntry("user-a", "user-a"), true);
  assert.equal(isOwnedApiCacheEntry("user-a", "user-b"), false);
  assert.equal(isOwnedApiCacheEntry(null, "user-b"), false);
});
