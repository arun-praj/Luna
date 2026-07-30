import { notFound } from "next/navigation";

import { TransactionDetail } from "@/components/transactions/transaction-detail";
import { getTransaction, transactions } from "@/lib/transactions";

export function generateStaticParams() {
  return [
    { id: "new" },
    ...transactions.map((transaction) => ({ id: transaction.id })),
  ];
}

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
    type === "expense" || type === "income" || type === "transfer"
      ? type
      : undefined;
  const transaction =
    id === "new"
      ? {
          id: "new",
          title: "New transaction",
          description: "",
          category: "",
          amount: 0,
          kind: "expense" as const,
          date: "2026-07-30",
          dateLabel: "Thursday, July 30",
          account: "",
          icon: "receipt" as const,
          iconClassName: "bg-primary-soft text-primary",
        }
      : getTransaction(id);

  if (!transaction) notFound();

  return (
    <TransactionDetail
      transaction={transaction}
      isNew={id === "new"}
      initialKind={initialKind}
    />
  );
}
