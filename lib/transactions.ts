export type Transaction = {
  id: string;
  title: string;
  description: string;
  category: string;
  amount: number;
  kind: "income" | "expense" | "transfer";
  date: string;
  dateLabel: string;
  account: string;
  destinationAccount?: string;
  icon:
    | "smartphone"
    | "receipt"
    | "utensils"
    | "shield"
    | "wallet"
    | "shopping"
    | "transfer";
  iconClassName: string;
};

export type TransactionGroup = {
  date: string;
  fullDate: string;
  total: string;
  totalClassName: string;
  transactions: Transaction[];
};

export const transactionGroups: TransactionGroup[] = [
  {
    date: "Today",
    fullDate: "July 30",
    total: "−NPR 12,720",
    totalClassName: "text-expense",
    transactions: [
      {
        id: "esewa-insurance-claim",
        title: "eSewa",
        description: "Insurance claim",
        category: "Refund",
        amount: 1900,
        kind: "income",
        date: "2026-07-30",
        dateLabel: "Thursday, July 30",
        account: "eSewa Wallet",
        icon: "smartphone",
        iconClassName: "bg-info-soft text-info",
      },
      {
        id: "apartment-rent",
        title: "Apartment rent",
        description: "Monthly rent",
        category: "Housing",
        amount: 12000,
        kind: "expense",
        date: "2026-07-30",
        dateLabel: "Thursday, July 30",
        account: "Primary account",
        icon: "receipt",
        iconClassName: "bg-warning-soft text-warning",
      },
      {
        id: "himalayan-java",
        title: "Himalayan Java",
        description: "Coffee with Suman",
        category: "Dining",
        amount: 220,
        kind: "expense",
        date: "2026-07-30",
        dateLabel: "Thursday, July 30",
        account: "Cash",
        icon: "utensils",
        iconClassName: "bg-expense-soft text-expense",
      },
      {
        id: "life-insurance",
        title: "Life insurance",
        description: "Annual premium",
        category: "Insurance",
        amount: 2400,
        kind: "expense",
        date: "2026-07-30",
        dateLabel: "Thursday, July 30",
        account: "Primary account",
        icon: "shield",
        iconClassName: "bg-primary-soft text-primary",
      },
    ],
  },
  {
    date: "Yesterday",
    fullDate: "July 29",
    total: "+NPR 39,650",
    totalClassName: "text-income",
    transactions: [
      {
        id: "july-salary",
        title: "Salary",
        description: "July salary",
        category: "Income",
        amount: 40000,
        kind: "income",
        date: "2026-07-29",
        dateLabel: "Wednesday, July 29",
        account: "Primary account",
        icon: "wallet",
        iconClassName: "bg-income-soft text-income",
      },
      {
        id: "bhat-bhateni",
        title: "Bhat-Bhateni",
        description: "Weekly groceries",
        category: "Shopping",
        amount: 350,
        kind: "expense",
        date: "2026-07-29",
        dateLabel: "Wednesday, July 29",
        account: "Primary account",
        icon: "shopping",
        iconClassName: "bg-info-soft text-info",
      },
      {
        id: "transfer-to-savings",
        title: "Transfer to Savings",
        description: "Primary → Savings",
        category: "Transfer",
        amount: 5000,
        kind: "transfer",
        date: "2026-07-29",
        dateLabel: "Wednesday, July 29",
        account: "Primary account",
        destinationAccount: "Savings account",
        icon: "transfer",
        iconClassName: "bg-info-soft text-info",
      },
    ],
  },
];

export const transactions = transactionGroups.flatMap(
  (group) => group.transactions,
);

export function getTransaction(id: string) {
  return transactions.find((transaction) => transaction.id === id);
}

export function formatTransactionAmount(transaction: Transaction) {
  const prefix =
    transaction.kind === "income"
      ? "+"
      : transaction.kind === "expense"
        ? "−"
        : "";
  return `${prefix}NPR ${transaction.amount.toLocaleString("en-US")}`;
}
