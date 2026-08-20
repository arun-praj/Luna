export type LocalDateTime = {
  date: string;
  time: string;
  weekday: number;
  dayOfMonth: number;
};

export function localDateTime(now: Date, timezone: string): LocalDateTime {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const year = Number(values.year);
    const month = Number(values.month);
    const day = Number(values.day);
    return {
      date: `${values.year}-${values.month}-${values.day}`,
      time: `${values.hour}:${values.minute}`,
      weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
      dayOfMonth: day,
    };
  } catch {
    if (timezone !== "UTC") return localDateTime(now, "UTC");
    return localDateTimeParts(now);
  }
}

function localDateTimeParts(now: Date): LocalDateTime {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return {
    date: `${year}-${month}-${day}`,
    time: `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`,
    weekday: now.getUTCDay(),
    dayOfMonth: now.getUTCDate(),
  };
}

export function validReminderTime(value: string | null | undefined, fallback = "09:00") {
  return value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

/**
 * Cron is scheduled once per minute and Cloudflare documents a small execution
 * jitter. Accept the configured minute and one late minute, but never fire
 * early across a local midnight boundary.
 */
export function isReminderWindow(local: LocalDateTime, configuredTime: string | null | undefined) {
  const target = validReminderTime(configuredTime);
  const [targetHour, targetMinute] = target.split(":").map(Number);
  const [currentHour, currentMinute] = local.time.split(":").map(Number);
  const targetMinutes = targetHour * 60 + targetMinute;
  const currentMinutes = currentHour * 60 + currentMinute;
  return currentMinutes >= targetMinutes && currentMinutes <= targetMinutes + 1;
}

export function recurringDueReminderIsScheduled(
  nextDueDate: string,
  local: LocalDateTime,
  configuredTime: string | null | undefined,
) {
  return nextDueDate <= local.date && isReminderWindow(local, configuredTime);
}

export function recurringTransactionIsScheduled(
  frequency: "daily" | "weekly" | "monthly",
  local: LocalDateTime,
) {
  if (frequency === "daily") return true;
  if (frequency === "weekly") return local.weekday === 1;
  return local.dayOfMonth === 1;
}
