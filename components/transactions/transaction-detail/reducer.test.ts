import assert from "node:assert/strict";
import test from "node:test";

import { localDateValue, localTimeValue } from "./reducer.ts";

test("transaction drafts use the device-local date and time", () => {
  const local = new Date(2026, 7, 17, 9, 7);

  assert.equal(localDateValue(local), "2026-08-17");
  assert.equal(localTimeValue(local), "09:07");
});
