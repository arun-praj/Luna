import assert from "node:assert/strict";
import test from "node:test";

import {
  assertUploadFitsQuota,
  MAX_UPLOAD_BYTES,
  ownedUploadKey,
  ORPHAN_UPLOAD_GRACE_MS,
  staleOrphanUploadKeys,
  UploadQuotaExceededError,
  USER_UPLOAD_QUOTA_BYTES,
} from "./upload-policy.ts";

test("owned upload references cannot escape the user's prefix", () => {
  assert.equal(ownedUploadKey("account-images", "user-1", "/api/uploads/account-images/user-1/avatar.png"), "account-images/user-1/avatar.png");
  assert.equal(ownedUploadKey("account-images", "user-1", "account-images/user-1/avatar.png"), "account-images/user-1/avatar.png");
  assert.equal(ownedUploadKey("account-images", "user-1", "/api/uploads/account-images/user-2/avatar.png"), null);
  assert.equal(ownedUploadKey("account-images", "user-1", "/api/uploads/account-images/user-1/../other.png"), null);
  assert.equal(ownedUploadKey("account-images", "user-1", "https://example.com/avatar.png"), null);
});

test("upload policy rejects oversized files and cumulative quota overflow", () => {
  assert.doesNotThrow(() => assertUploadFitsQuota(USER_UPLOAD_QUOTA_BYTES - MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES));
  assert.throws(
    () => assertUploadFitsQuota(USER_UPLOAD_QUOTA_BYTES - MAX_UPLOAD_BYTES + 1, MAX_UPLOAD_BYTES),
    UploadQuotaExceededError,
  );
  assert.throws(() => assertUploadFitsQuota(0, MAX_UPLOAD_BYTES + 1), /smaller than 5 MB/);
});

test("orphan cleanup preserves referenced and recently uploaded objects", () => {
  const now = new Date("2026-08-12T00:00:00.000Z");
  const old = new Date(now.getTime() - ORPHAN_UPLOAD_GRACE_MS - 1);
  const recent = new Date(now.getTime() - ORPHAN_UPLOAD_GRACE_MS + 1);
  assert.deepEqual(
    staleOrphanUploadKeys([
      { key: "account-images/user-1/old.png", uploaded: old },
      { key: "account-images/user-1/referenced.png", uploaded: old },
      { key: "account-images/user-1/recent.png", uploaded: recent },
      { key: "account-images/user-1/unknown-date.png" },
    ], new Set(["account-images/user-1/referenced.png"]), now),
    ["account-images/user-1/old.png"],
  );
});
