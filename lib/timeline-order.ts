export type TimelineOrderItem = {
  id: string;
  date: string;
  timestamp?: string | null;
  fallbackTimestamp?: string | null;
};

const calendarDatePattern = /^(\d{4}-\d{2}-\d{2})/;

export function calendarDateFromTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const directDate = value.match(calendarDatePattern)?.[1];
  if (directDate) return directDate;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function timestampValue(item: TimelineOrderItem) {
  const timestamp = Date.parse(item.timestamp ?? "");
  if (!Number.isNaN(timestamp)) return timestamp;
  const fallbackTimestamp = Date.parse(item.fallbackTimestamp ?? "");
  return Number.isNaN(fallbackTimestamp) ? null : fallbackTimestamp;
}

/** Sort activity newest-first: the recorded calendar date is authoritative. */
export function compareTimelineItems(left: TimelineOrderItem, right: TimelineOrderItem) {
  const dateOrder = right.date.localeCompare(left.date);
  if (dateOrder !== 0) return dateOrder;

  const leftTimestamp = timestampValue(left);
  const rightTimestamp = timestampValue(right);
  if (leftTimestamp !== null && rightTimestamp !== null && leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp;
  }
  if (leftTimestamp === null && rightTimestamp !== null) return 1;
  if (leftTimestamp !== null && rightTimestamp === null) return -1;
  return right.id.localeCompare(left.id);
}
