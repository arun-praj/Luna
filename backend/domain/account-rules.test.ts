import assert from "node:assert/strict";
import test from "node:test";

import { hasDuplicateAccountName, hasDuplicateAccountNames, normalizeAccountName } from "./account-rules.ts";

test("account names compare after trimming and case folding", () => {
  assert.equal(normalizeAccountName("  Cash  "), "cash");
  assert.equal(hasDuplicateAccountName([{ id: "1", name: "Cash" }], " cash "), true);
  assert.equal(hasDuplicateAccountName([{ id: "1", name: "Cash" }], "Cash", "1"), false);
  assert.equal(hasDuplicateAccountNames(["Cash", "cash"]), true);
});
