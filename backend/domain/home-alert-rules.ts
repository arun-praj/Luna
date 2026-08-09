export const goalTargetWindowDays = 14;

export const loanFrequencyWindows: Record<string, number> = {
  weekly: 3,
  monthly: 10,
  quarterly: 21,
  yearly: 45,
};

export const recurringFrequencyWindows: Record<string, number> = {
  daily: 1,
  weekly: 2,
  monthly: 7,
  quarterly: 21,
  yearly: 30,
};

export function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysUntil(value: string, today: string) {
  return Math.round((new Date(`${value}T12:00:00.000Z`).getTime() - new Date(`${today}T12:00:00.000Z`).getTime()) / 86400000);
}

export function urgencyForDate(value: string, today: string, window: number) {
  const days = daysUntil(value, today);
  if (days < 0) return { hardUrgency: 3, rank: 1000 - Math.abs(days) };
  if (days === 0) return { hardUrgency: 2, rank: 900 };
  if (days <= window) return { hardUrgency: 1, rank: 800 - days };
  return { hardUrgency: 0, rank: 500 - days };
}

export function previousPaymentAge(dates: string[], today: string) {
  const previous = dates.filter((value) => value <= today).sort((a, b) => b.localeCompare(a))[0];
  if (!previous) return undefined;
  const days = Math.max(1, Math.abs(daysUntil(previous, today)));
  if (days >= 28) return "1 Month ago";
  if (days >= 7) return `${Math.floor(days / 7)} Week${Math.floor(days / 7) === 1 ? "" : "s"} ago`;
  return `${days} Day${days === 1 ? "" : "s"} ago`;
}

export function budgetPeriodStart(period: string, today: string) {
  if (period === "yearly") return `${today.slice(0, 4)}-01-01`;
  if (period === "monthly") return `${today.slice(0, 7)}-01`;
  return addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
}

export function budgetAlertThreshold(percentage: number) {
  if (percentage >= 100) return 100;
  return null;
}
