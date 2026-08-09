import { addMoney } from "@/lib/money";

export type CurrencyTotals = Record<string, number>;

export function addCurrencyAmount(
  totals: CurrencyTotals,
  currency: string,
  amount: number,
) {
  const code = currency.trim().toUpperCase() || "NPR";
  totals[code] = addMoney(totals[code] ?? 0, amount);
}

export function currencyEntries(totals: CurrencyTotals) {
  return Object.entries(totals).sort(([left], [right]) => left.localeCompare(right));
}

export function formatCurrencyAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
