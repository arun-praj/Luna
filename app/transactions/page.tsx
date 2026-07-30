import Link from "next/link";
import {
  ArrowLeft,
  ArrowLeftRight,
  ChevronRight,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Utensils,
  WalletCards,
} from "lucide-react";

import { DatePicker } from "@/components/home/date-picker";
import { AddTransactionButton } from "@/components/transactions/add-transaction-button";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import {
  formatTransactionAmount,
  transactionGroups,
  type Transaction,
} from "@/lib/transactions";

const transactionIcons = {
  smartphone: Smartphone,
  receipt: ReceiptText,
  utensils: Utensils,
  shield: ShieldCheck,
  wallet: WalletCards,
  shopping: ShoppingBag,
  transfer: ArrowLeftRight,
} satisfies Record<Transaction["icon"], typeof Smartphone>;

function compactAccountName(account: string) {
  return account.replace(" Wallet", "").replace(" account", "");
}

export default function TransactionsPage() {
  const transactionCount = transactionGroups.reduce(
    (total, group) => total + group.transactions.length,
    0,
  );

  return (
    <main className="min-h-dvh animate-in fade-in-0 slide-in-from-right-4 bg-background duration-300 motion-reduce:animate-none">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-28 sm:px-5">
        <StickyPageHeader className="-mx-4 px-4 pb-3 sm:-mx-5 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/"
                aria-label="Back to home"
                className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                <ArrowLeft aria-hidden="true" className="size-5" />
              </Link>
              <div className="min-w-0">
                <h1 className="truncate text-[25px] font-semibold tracking-[-0.04em]">
                  Transactions
                </h1>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                  {transactionCount} transactions
                </p>
              </div>
            </div>
            <DatePicker />
          </div>
        </StickyPageHeader>

        <section
          aria-label="Filtered transaction summary"
          className="mt-5 flex items-center justify-between gap-4 rounded-[13px] border border-border bg-card px-4 py-3.5"
        >
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Cash flow
            </p>
            <p className="mt-1 text-[17px] font-semibold tabular-nums text-income">
              +NPR 22,150.01
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-muted-foreground">Period</p>
            <p className="mt-1 text-sm font-semibold">Selected dates</p>
          </div>
        </section>

        <section aria-labelledby="all-transactions-heading" className="mt-7">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Complete history
              </p>
              <h2
                id="all-transactions-heading"
                className="mt-1 text-[20px] font-semibold tracking-[-0.03em]"
              >
                All activity
              </h2>
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              Newest first
            </p>
          </div>

          <div className="mt-5 space-y-7">
            {transactionGroups.map((group) => (
              <section
                aria-labelledby={`all-group-${group.fullDate}`}
                key={group.fullDate}
              >
                <div className="flex items-end justify-between gap-4 px-1">
                  <div className="flex items-baseline gap-2">
                    <h3
                      id={`all-group-${group.fullDate}`}
                      className="text-[15px] font-semibold"
                    >
                      {group.date}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {group.fullDate}
                    </p>
                  </div>
                  <p
                    className={`text-xs font-semibold tabular-nums ${group.totalClassName}`}
                  >
                    {group.total}
                  </p>
                </div>

                <div className="mt-3 overflow-hidden rounded-[14px] border border-border bg-card">
                  {group.transactions.map((transaction, index) => {
                    const Icon = transactionIcons[transaction.icon];
                    const amountClassName =
                      transaction.kind === "income"
                        ? "text-income"
                        : transaction.kind === "expense"
                          ? "text-expense"
                          : "text-info";

                    return (
                      <Link
                        href={`/transactions/${transaction.id}`}
                        aria-label={`Open ${transaction.title} transaction`}
                        className={`group flex min-h-[76px] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-subtle focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 ${
                          index > 0 ? "border-t border-border" : ""
                        }`}
                        key={`${group.fullDate}-${transaction.id}`}
                      >
                        <span
                          className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${transaction.iconClassName}`}
                        >
                          <Icon aria-hidden="true" className="size-[18px]" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <h4 className="truncate text-[15px] font-semibold">
                              {transaction.title}
                            </h4>
                            <p
                              className={`shrink-0 text-[14px] font-semibold tabular-nums ${amountClassName}`}
                            >
                              {formatTransactionAmount(transaction)}
                            </p>
                          </div>
                          <div className="mt-1.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                            <span className="min-w-0 flex-1 truncate">
                              {transaction.description}
                            </span>
                            <span className="flex max-w-20 shrink-0 items-center gap-1 text-[11px] font-medium">
                              <WalletCards
                                aria-hidden="true"
                                className="size-3 shrink-0"
                              />
                              <span className="truncate">
                                {compactAccountName(transaction.account)}
                                {transaction.destinationAccount
                                  ? ` → ${compactAccountName(transaction.destinationAccount)}`
                                  : ""}
                              </span>
                            </span>
                            <span className="shrink-0 rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-foreground-muted">
                              {transaction.category}
                            </span>
                          </div>
                        </div>
                        <ChevronRight
                          aria-hidden="true"
                          className="size-4 shrink-0 text-foreground-subtle opacity-0 transition-[opacity,transform,color] group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-100 group-focus-visible:opacity-100"
                        />
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
      <AddTransactionButton />
    </main>
  );
}
