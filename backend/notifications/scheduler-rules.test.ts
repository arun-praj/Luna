import assert from "node:assert/strict";
import test from "node:test";
import {
  isReminderWindow,
  localDateTime,
  recurringDueReminderIsScheduled,
} from "./scheduler-rules.ts";

test("Kathmandu recurring_due uses the configured local minute", () => {
  const local = localDateTime(new Date("2026-01-15T03:15:00.000Z"), "Asia/Kathmandu");

  assert.deepEqual(local, {
    date: "2026-01-15",
    time: "09:00",
    weekday: 4,
    dayOfMonth: 15,
  });
  assert.equal(recurringDueReminderIsScheduled("2026-01-15", local, "09:00"), true);
  assert.equal(isReminderWindow(local, "09:00"), true);
  assert.equal(isReminderWindow({ ...local, time: "09:02" }, "09:00"), false);
});

test("midnight reminders do not fire during the previous local day", () => {
  const previousDay = localDateTime(new Date("2026-01-14T18:14:00.000Z"), "Asia/Kathmandu");
  const midnight = localDateTime(new Date("2026-01-14T18:15:00.000Z"), "Asia/Kathmandu");

  assert.equal(previousDay.date, "2026-01-14");
  assert.equal(previousDay.time, "23:59");
  assert.equal(recurringDueReminderIsScheduled("2026-01-15", previousDay, "00:00"), false);
  assert.equal(recurringDueReminderIsScheduled("2026-01-15", midnight, "00:00"), true);
  assert.equal(isReminderWindow({ ...midnight, time: "00:02" }, "00:00"), false);
});

