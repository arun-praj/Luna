import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Landmark,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";

export type TransactionType =
  | "expense"
  | "income"
  | "savings"
  | "transfer"
  | "adjust_balance"
  | "goal_spend";

export const transactionTypeMeta: Record<
  TransactionType,
  {
    label: string;
    amountClassName: string;
    icon: LucideIcon;
    iconClassName: string;
    prefix: string;
  }
> = {
  expense: {
    label: "Expense",
    amountClassName: "text-expense",
    icon: ArrowUpRight,
    iconClassName: "bg-expense-soft text-expense",
    prefix: "−",
  },
  income: {
    label: "Income",
    amountClassName: "text-income",
    icon: ArrowDownLeft,
    iconClassName: "bg-income-soft text-income",
    prefix: "+",
  },
  savings: {
    label: "Savings",
    amountClassName: "text-info",
    icon: Landmark,
    iconClassName: "bg-info-soft text-info",
    prefix: "−",
  },
  transfer: {
    label: "Transfer",
    amountClassName: "text-info",
    icon: ArrowLeftRight,
    iconClassName: "bg-info-soft text-info",
    prefix: "",
  },
  adjust_balance: {
    label: "Adjust balance",
    amountClassName: "text-foreground",
    icon: Banknote,
    iconClassName: "bg-surface-subtle text-foreground",
    prefix: "",
  },
  goal_spend: {
    label: "Goal spend",
    amountClassName: "text-expense",
    icon: ReceiptText,
    iconClassName: "bg-expense-soft text-expense",
    prefix: "−",
  },
};
