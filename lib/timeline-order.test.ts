import assert from "node:assert/strict";
import test from "node:test";

import { calendarDateFromTimestamp, compareTimelineItems } from "./timeline-order.ts";

test("calendar date is the primary activity ordering key", () => {
  const items = [
    { id: "older", date: "2026-08-14", timestamp: "2026-08-17T10:00:00.000Z" },
    { id: "newer", date: "2026-08-16", timestamp: "2026-08-15T10:00:00.000Z" },
  ];

  assert.deepEqual(items.sort(compareTimelineItems).map((item) => item.id), ["newer", "older"]);
});

test("transactions and alerts interleave by date and then time", () => {
  const items = [
    { id: "alert", date: "2026-08-17", timestamp: "2026-08-17T13:00:00.000Z" },
    { id: "transaction", date: "2026-08-17", timestamp: "2026-08-17T14:00:00.000Z" },
    { id: "previous-day", date: "2026-08-16", timestamp: "2026-08-16T23:00:00.000Z" },
  ];

  assert.deepEqual(items.sort(compareTimelineItems).map((item) => item.id), ["transaction", "alert", "previous-day"]);
});

test("alert dates use the event date even when creation happened later", () => {
  assert.equal(calendarDateFromTimestamp("2026-08-17T00:00:00.000Z"), "2026-08-17");
  assert.equal(calendarDateFromTimestamp("not-a-date"), null);
});
