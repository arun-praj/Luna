import assert from "node:assert/strict";
import test from "node:test";

import { IMPORT_BATCH_SIZE, MAX_IMPORT_BYTES, MAX_IMPORT_RECORDS } from "./portability-limits.ts";

test("portability limits keep the largest import to fifty D1 batches", () => {
  assert.equal(MAX_IMPORT_BYTES, 25 * 1024 * 1024);
  assert.equal(MAX_IMPORT_RECORDS % IMPORT_BATCH_SIZE, 0);
  assert.equal(MAX_IMPORT_RECORDS / IMPORT_BATCH_SIZE, 50);
});
