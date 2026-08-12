import assert from "node:assert/strict";
import test from "node:test";

import { requireConfiguredStorage } from "./r2-contract.ts";

test("privacy storage requirement fails closed when the R2 binding is missing", () => {
  assert.throws(() => requireConfiguredStorage(undefined), /Object storage is unavailable/);
  const bucket = {};
  assert.equal(requireConfiguredStorage(bucket), bucket);
});
