import type { transactions } from "@/backend/db/schema";
export { rankTransactionOptions } from "../../lib/transaction-option-memory.ts";

export type TransactionOptionTransactionType = (typeof transactions.$inferSelect)["type"];
export type TransactionOptionKind = "account" | "category" | "savings_instrument";

export type TransactionOptionAssociation = {
  transactionType: TransactionOptionTransactionType;
  optionKind: TransactionOptionKind;
  optionId: string;
};

type TransactionRow = typeof transactions.$inferSelect;

function addAssociation(
  associations: Map<string, TransactionOptionAssociation>,
  transactionType: TransactionOptionTransactionType,
  optionKind: TransactionOptionKind,
  optionId: string | null | undefined,
) {
  if (!optionId) return;
  const association = { transactionType, optionKind, optionId } satisfies TransactionOptionAssociation;
  associations.set(`${transactionType}:${optionKind}:${optionId}`, association);
}

function parseSplitCategoryIds(value: string) {
  try {
    const splits = JSON.parse(value) as unknown;
    if (!Array.isArray(splits)) return [];
    return splits.flatMap((split) => {
      if (!split || typeof split !== "object") return [];
      const categoryId = (split as { categoryId?: unknown }).categoryId;
      return typeof categoryId === "string" && categoryId ? [categoryId] : [];
    });
  } catch {
    return [];
  }
}

export function getTransactionOptionAssociations(row: Pick<TransactionRow, "type" | "accountId" | "transferToAccountId" | "categoryId" | "splits" | "savingsInstrumentId">) {
  const associations = new Map<string, TransactionOptionAssociation>();
  addAssociation(associations, row.type, "account", row.accountId);
  if ((row.type === "transfer" || row.type === "savings") && row.transferToAccountId) {
    addAssociation(associations, row.type, "account", row.transferToAccountId);
  }
  addAssociation(associations, row.type, "category", row.categoryId);
  for (const categoryId of parseSplitCategoryIds(row.splits)) {
    addAssociation(associations, row.type, "category", categoryId);
  }
  if (row.type === "savings") addAssociation(associations, row.type, "savings_instrument", row.savingsInstrumentId);
  return [...associations.values()];
}

export function getNewTransactionOptionAssociations(
  previous: Parameters<typeof getTransactionOptionAssociations>[0] | null,
  next: Parameters<typeof getTransactionOptionAssociations>[0],
) {
  const previousKeys = new Set((previous ? getTransactionOptionAssociations(previous) : []).map((association) => `${association.transactionType}:${association.optionKind}:${association.optionId}`));
  return getTransactionOptionAssociations(next).filter((association) => !previousKeys.has(`${association.transactionType}:${association.optionKind}:${association.optionId}`));
}
