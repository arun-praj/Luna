export type TransactionSemanticType = "expense" | "income" | "savings" | "transfer" | "adjust_balance" | "goal_spend";
export type TransactionCategoryType = "expense" | "income";

export function transactionCategoryReferenceError(type: TransactionSemanticType, categoryType: TransactionCategoryType) {
  if (type !== "expense" && type !== "income") {
    return "Categories can only be linked to expense or income transactions";
  }
  if (categoryType !== type) {
    return `Choose an ${type} category for this transaction`;
  }
  return null;
}

export function savingsInstrumentReferenceError(type: TransactionSemanticType) {
  return type === "savings" ? null : "Savings instruments can only be linked to savings transactions";
}
