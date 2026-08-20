import { formatMoney } from "@/components/money/money-editor";
import type { SplitDraft, TransactionKind } from "./types";

export { rankTransactionOptions } from "@/lib/transaction-option-memory";

export function budgetProgressColor(percentage: number) {
  const capped = Math.min(100, Math.max(0, percentage));
  return `hsl(${Math.round(120 - capped * 1.2)} 72% 42%)`;
}

const categoryForegrounds: Record<string, string> = {
  "#e3eee9": "#356b68",
  "#f8e9e6": "#9e514b",
  "#f3e8d4": "#95631e",
  "#e3eff6": "#436f9a",
  "#e5f3eb": "#2f7d5a",
  "#ece6f3": "#735b8f",
  "#fbe8dc": "#a9512e",
};

export function categoryForeground(color: string | null) {
  return categoryForegrounds[color?.toLowerCase() ?? ""] ?? "#356b68";
}

export function displayAccountName(name: string) {
  return name.replace(" Wallet", "").replace(" account", "");
}

export function transferTitle(amount: string, sourceName?: string, destinationName?: string, currency = "NPR") {
  return `Transfer ${currency} ${formatMoney(amount)} from ${displayAccountName(sourceName ?? "account")} to ${displayAccountName(destinationName ?? "account")}`;
}

export function serializeTransactionDraft(values: {
  title: string;
  description: string;
  date: string;
  time: string;
  kind: TransactionKind;
  category: string;
  categoryId: string | null;
  splits: SplitDraft[];
  merchantName: string;
  tags: string[];
  accountId: string;
  savingsInstrumentId: string | null;
  transferToAccountId: string;
  amount: string;
  receiptImageUrl: string | null;
  receiptFileKey: string | null;
}) {
  return JSON.stringify({
    ...values,
    splits: values.splits.map(({ categoryId, amount, note }) => ({ categoryId, amount, note: note ?? null })),
    tags: [...values.tags].sort(),
  });
}
