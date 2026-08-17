export type TransactionSemanticType = "expense" | "income" | "savings" | "transfer" | "adjust_balance" | "goal_spend";

export function savingsInstrumentReferenceError(type: TransactionSemanticType) {
  return type === "savings" ? null : "Savings instruments can only be linked to savings transactions";
}
