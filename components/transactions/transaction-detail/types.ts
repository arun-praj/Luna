import type { Transaction } from "@/lib/transactions";
import type { BudgetPeriod } from "@/lib/budgets";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Landmark,
} from "lucide-react";

export type TransactionKind = Transaction["kind"] | "";

export const transactionTypes = [
  { value: "expense", label: "Expense", description: "Money leaving an account", icon: ArrowUpRight, iconClassName: "bg-expense-soft text-expense", foregroundClassName: "text-expense" },
  { value: "income", label: "Income", description: "Money added to an account", icon: ArrowDownLeft, iconClassName: "bg-income-soft text-income", foregroundClassName: "text-income" },
  { value: "transfer", label: "Transfer", description: "Move money between accounts", icon: ArrowLeftRight, iconClassName: "bg-info-soft text-info", foregroundClassName: "text-info" },
  { value: "savings", label: "Savings", description: "Set money aside", icon: Landmark, iconClassName: "bg-income-soft text-income", foregroundClassName: "text-income" },
] satisfies Array<{
  value: Transaction["kind"];
  label: string;
  description: string;
  icon: typeof ArrowUpRight;
  iconClassName: string;
  foregroundClassName: string;
}>;

export const tagOptions = ["Recurring", "Personal", "Work", "Reimbursable"];
export const BUDGET_PERIODS: BudgetPeriod[] = ["weekly", "monthly", "yearly"];
export const INCOME_GOALS_PER_PAGE = 4;
export const LAST_ACCOUNT_KEY = "cocomelon.last-transaction-account";

export type CategoryOption = {
  id: string;
  name: string;
  type: "expense" | "income";
  icon: string | null;
  color: string | null;
};

export type SplitDraft = {
  id: string;
  categoryId: string;
  amount: string;
  note?: string | null;
};

export type MerchantOption = {
  name: string;
  lastUsedAt: string;
  usageCount: number;
};

export type SavingsInstrumentOption = {
  id: string;
  name: string;
  typeName?: string;
  currentBalance: number;
  icon?: string | null;
};

export type CategoryBudgetPreview = {
  percentage: number;
  tone: "safe" | "warning" | "danger";
};

export type IncomeGoalOption = {
  id: string;
  name: string;
  targetAmount: number;
  allocatedAmount: number;
  monthlyContribution: number;
  status: string;
  targetDate: string | null;
  accountId: string | null;
};
