"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import { DatePicker, type AppliedPeriod } from "@/components/home/date-picker";
import { AddTransactionButton } from "@/components/transactions/add-transaction-button";
import { TransactionList } from "@/components/transactions/transaction-list";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";

export default function TransactionsPage() {
  const [period, setPeriod] = useState<AppliedPeriod>({ mode: "all", label: "All time" });

  return (
    <main className="page-route-enter min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-5">
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
                <h1 className="truncate text-[25px] font-semibold tracking-[-0.04em]">Transactions</h1>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">Your complete activity</p>
              </div>
            </div>
            <DatePicker initialMode="all" initialLabel="All time" onApply={setPeriod} />
          </div>
        </StickyPageHeader>

        <section aria-label="Transaction history" className="mt-7">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-medium text-muted-foreground">From your accounts</p>
              <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.03em]">All activity</h2>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Newest first</p>
          </div>
          <TransactionList searchable period={period} />
        </section>
      </div>
      <AddTransactionButton />
    </main>
  );
}
