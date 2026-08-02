import { TransactionDetail } from "@/components/transactions/transaction-detail";
import type { Transaction } from "@/lib/transactions";

export default async function TransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;
  const initialKind =
    type === "expense" || type === "income" || type === "savings" || type === "transfer" || type === "adjust_balance"
      ? type
      : undefined;
  const transaction = {
    id,
    title: "",
    description: "",
    category: "",
    amount: 0,
    kind: (initialKind ?? "expense") as Transaction["kind"],
    date: new Date().toISOString().slice(0, 10),
    dateLabel: "",
    account: "",
    icon: "receipt" as const,
    iconClassName: "bg-primary-soft text-primary",
  };

  return (
    <TransactionDetail
      transaction={transaction}
      isNew={id === "new"}
      initialKind={initialKind ?? "expense"}
      guidedNew={id === "new" && (initialKind === undefined || initialKind === "expense" || initialKind === "income")}
    />
  );
}
