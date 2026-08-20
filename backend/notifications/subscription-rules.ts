export type PushDeliveryStatus = "sent" | "subscription_expired" | "rejected" | "failed" | "not_configured";

export function isExpiredPushStatus(status: number | null) {
  return status === 404 || status === 410;
}

export function deliveryStatusForHttpStatus(status: number | null): PushDeliveryStatus {
  if (isExpiredPushStatus(status)) return "subscription_expired";
  if (status !== null && [400, 401, 403].includes(status)) return "rejected";
  return "failed";
}

/** Keep delivery diagnostics useful without persisting provider messages or URLs. */
export function sanitizedDeliveryError(status: number | null, result: PushDeliveryStatus) {
  if (result === "subscription_expired") return "subscription_expired";
  if (result === "rejected") return "push_rejected";
  if (result === "not_configured") return "push_not_configured";
  if (status !== null) return `push_http_${status}`;
  return "push_transport_error";
}

export function uniqueActiveSubscriptions<T extends { endpoint: string; active: boolean }>(subscriptions: T[]) {
  const seen = new Set<string>();
  return subscriptions.filter((subscription) => {
    if (!subscription.active || seen.has(subscription.endpoint)) return false;
    seen.add(subscription.endpoint);
    return true;
  });
}

export function summarizeDeliveryStatuses(statuses: PushDeliveryStatus[]) {
  const deliveredDeviceCount = statuses.filter((status) => status === "sent").length;
  const attemptedDeviceCount = statuses.length;
  const deliveryStatus = deliveredDeviceCount === attemptedDeviceCount && attemptedDeviceCount > 0
    ? "sent"
    : deliveredDeviceCount > 0
      ? "partial"
      : statuses[0] ?? "failed";
  return { attemptedDeviceCount, deliveredDeviceCount, deliveryStatus };
}

export function shouldAttemptDelivery(status: string | null | undefined) {
  return status !== "sent" && status !== "partial";
}
