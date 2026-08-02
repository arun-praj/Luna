const fallbackAccountColors: Record<string, string> = {
  checking: "#e3eff6",
  cash: "#e3eee9",
  credit_card: "#ece6f3",
  general: "#dff1ed",
  savings: "#e5f3eb",
  investment: "#ece6f3",
  loan: "#fbe8dc",
  other: "#ebe9e3",
};

const legacyOnboardingColors: Record<string, string> = {
  "#d98e64": "#f3e8d4",
  "#68a59d": "#e5f3eb",
  "#7d8dc4": "#ece6f3",
  "#7ea6c6": "#e3eff6",
  "#b48ac7": "#ece6f3",
  "#8a9a9a": "#ebe9e3",
};

const accountForegrounds: Record<string, string> = {
  "#e3eff6": "#436f9a",
  "#e3eee9": "#356b68",
  "#ece6f3": "#735b8f",
  "#dff1ed": "#277b72",
  "#e5f3eb": "#2f7d5a",
  "#fbe8dc": "#a9512e",
  "#ebe9e3": "#706e65",
};

export function getAccountBackgroundColor(
  color: string | null | undefined,
  type?: string | null,
) {
  const normalized = color?.toLowerCase();
  return (normalized && legacyOnboardingColors[normalized]) || color || fallbackAccountColors[type ?? "other"] || fallbackAccountColors.other;
}

export function getAccountForeground(color: string | null | undefined, type?: string | null) {
  const background = getAccountBackgroundColor(color, type).toLowerCase();
  return accountForegrounds[background] ?? "#356b68";
}
