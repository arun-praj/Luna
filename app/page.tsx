import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  Landmark,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Tags,
  Utensils,
  WalletCards,
} from "lucide-react";

import { DatePicker } from "@/components/home/date-picker";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { AddTransactionButton } from "@/components/transactions/add-transaction-button";
import { arunAvatar } from "@/lib/avatar";
import {
  formatTransactionAmount,
  transactionGroups,
  type Transaction,
} from "@/lib/transactions";

const overview = [
  {
    label: "Income",
    value: "48,500",
    color: "text-income",
    icon: ArrowDownLeft,
    iconClassName: "bg-income-soft text-income",
  },
  {
    label: "Expenses",
    value: "26,349.99",
    color: "text-expense",
    icon: ArrowUpRight,
    iconClassName: "bg-expense-soft text-expense",
  },
  {
    label: "Savings",
    value: "2,150",
    color: "text-foreground",
    icon: Landmark,
    iconClassName: "bg-primary-soft text-primary",
  },
];

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

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-28 sm:px-5">
        <StickyPageHeader className="-mx-4 flex items-center justify-between gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <Link
            href="/profile"
            aria-label="Open Arun's profile"
            className="group flex min-w-0 items-center gap-3 rounded-[12px] pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <Image
              src={arunAvatar}
              alt=""
              width={44}
              height={44}
              unoptimized
              className="size-11 shrink-0 rounded-[12px] border border-border bg-primary-soft"
            />
            <h1 className="truncate text-[24px] font-semibold tracking-[-0.035em] text-foreground sm:text-[26px]">
              Hi, Arun
            </h1>
            <ChevronRight
              aria-hidden="true"
              className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
            />
          </Link>

          <DatePicker />
        </StickyPageHeader>

        <section aria-labelledby="balance-heading" className="mt-10">
          <p
            id="balance-heading"
            className="text-sm font-medium text-muted-foreground"
          >
            Total balance
          </p>
          <p className="mt-2 font-sans text-[36px] font-semibold leading-none tracking-[-0.045em] tabular-nums text-foreground sm:text-[40px]">
            <span className="mr-2 text-[17px] font-semibold tracking-normal text-muted-foreground">
              NPR
            </span>
            20,000.01
          </p>
          <nav aria-label="Balance details" className="mt-3 flex flex-wrap gap-x-3">
            <Link
              href="/accounts"
              className="inline-flex min-h-7 items-center gap-1 rounded-md pr-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <WalletCards aria-hidden="true" className="size-3 text-primary" />
              Accounts
              <ChevronRight aria-hidden="true" className="size-3" />
            </Link>
            <Link
              href="/categories"
              className="inline-flex min-h-7 items-center gap-1 rounded-md pr-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <Tags aria-hidden="true" className="size-3 text-primary" />
              Categories
              <ChevronRight aria-hidden="true" className="size-3" />
            </Link>
          </nav>
        </section>

        <section
          aria-label="Monthly overview"
          className="mt-8 grid divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-card min-[360px]:grid-cols-3 min-[360px]:divide-x min-[360px]:divide-y-0"
        >
          {overview.map((item) => {
            const Icon = item.icon;

            return (
              <div
                className="flex min-w-0 items-center gap-3 px-4 py-3.5 min-[360px]:block min-[360px]:px-3 min-[360px]:py-4 sm:px-5"
                key={item.label}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-[9px] ${item.iconClassName}`}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <p className="text-[13px] font-medium text-muted-foreground min-[360px]:mt-4">
                  {item.label}
                  <span className="ml-1 text-[10px] font-semibold tracking-wide text-foreground-subtle">
                    NPR
                  </span>
                </p>
                <p
                  className={`ml-auto text-[17px] font-semibold tracking-[-0.02em] tabular-nums min-[360px]:ml-0 min-[360px]:mt-1 min-[360px]:text-[16px] sm:text-[18px] ${item.color}`}
                >
                  {item.value}
                </p>
              </div>
            );
          })}
        </section>

        <section aria-labelledby="activity-heading" className="mt-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium text-muted-foreground">
                This month
              </p>
              <h2
                id="activity-heading"
                className="mt-1 text-[22px] font-semibold tracking-[-0.03em]"
              >
                Activity
              </h2>
            </div>
            <div className="flex flex-col items-end">
              <Link
                href="/transactions"
                className="min-h-8 px-1 text-sm font-semibold text-primary hover:text-primary-hover focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                See all
              </Link>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                Cash flow
              </p>
              <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-income">
                +NPR 22,150.01
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-8">
            {transactionGroups.slice(0, 1).map((group) => (
              <section aria-labelledby={`group-${group.fullDate}`} key={group.fullDate}>
                <div className="flex items-end justify-between gap-4 px-1">
                  <div className="flex items-baseline gap-2">
                    <h3
                      id={`group-${group.fullDate}`}
                      className="text-[15px] font-semibold"
                    >
                      {group.date}
                    </h3>
                    <p className="text-xs text-muted-foreground">{group.fullDate}</p>
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
                        className={`group relative flex min-h-[76px] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-subtle focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 ${
                          index > 0 ? "border-t border-border" : ""
                        }`}
                        key={`${group.fullDate}-${transaction.title}`}
                      >
                        <span
                          className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${transaction.iconClassName}`}
                        >
                          <Icon aria-hidden="true" className="size-[18px]" />
                        </span>

                        <div className="min-w-0 flex-1 transition-[padding-right] duration-200 group-hover:pr-6 group-focus-visible:pr-6">
                          <div className="flex items-baseline justify-between gap-3">
                            <h4 className="truncate text-[15px] font-semibold text-foreground">
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
                            <span className="flex max-w-20 shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground">
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
                          className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle opacity-0 transition-[opacity,transform,color] group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-100 group-focus-visible:opacity-100"
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
