export type RecurringTemplateShape = {
  type: "expense" | "income" | "savings" | "transfer";
  nextDueDate: string;
  endDate?: string | null;
  transferToAccountId?: string | null;
  goalId?: string | null;
  savingsInstrumentId?: string | null;
};

export type RecurringTemplateShapeIssue = {
  path: keyof RecurringTemplateShape;
  message: string;
};

export function recurringTemplateShapeIssues(value: RecurringTemplateShape): RecurringTemplateShapeIssue[] {
  const issues: RecurringTemplateShapeIssue[] = [];
  if (value.endDate && value.endDate < value.nextDueDate) {
    issues.push({ path: "endDate", message: "End date cannot be before the next date" });
  }
  if (value.type === "transfer" && !value.transferToAccountId) {
    issues.push({ path: "transferToAccountId", message: "Transfer account is required" });
  }
  if (value.type !== "transfer" && value.type !== "savings" && value.transferToAccountId) {
    issues.push({ path: "transferToAccountId", message: "Transfer account is only valid for transfers" });
  }
  if (value.type === "savings" && !value.goalId && value.transferToAccountId) {
    issues.push({ path: "transferToAccountId", message: "Savings transfers must be linked to a goal" });
  }
  if (value.type !== "savings" && value.goalId) {
    issues.push({ path: "goalId", message: "Goals can only be linked to savings recurring transactions" });
  }
  if (value.type !== "savings" && value.savingsInstrumentId) {
    issues.push({ path: "savingsInstrumentId", message: "Savings instruments can only be linked to savings recurring transactions" });
  }
  if (value.type === "savings" && value.goalId && !value.transferToAccountId) {
    issues.push({ path: "transferToAccountId", message: "Goal account is required for savings recurring transactions" });
  }
  return issues;
}

export function shouldAdvanceRecurringTemplate(currentNextDueDate: string, actedOnDate: string) {
  return currentNextDueDate <= actedOnDate;
}
