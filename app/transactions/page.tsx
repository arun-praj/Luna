"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import { DatePicker, type AppliedPeriod } from "@/components/home/date-picker";
import { AddTransactionButton } from "@/components/transactions/add-transaction-button";
import { TransactionList } from "@/components/transactions/transaction-list";
import { TransactionFilterBar, transactionFiltersFromSearchParams, transactionFiltersQuery, type TransactionFilterState } from "@/components/transactions/transaction-filter-bar";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { PageHeader } from "@/components/layout/page-header";

export default function TransactionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [period, setPeriod] = useState<AppliedPeriod>({ mode: "all", label: "All time" });
  const filters = transactionFiltersFromSearchParams(searchParams);

  const updateFilters = (next: TransactionFilterState) => {
    const query = transactionFiltersQuery(next);
    router.replace(query ? `/transactions?${query}` : "/transactions", { scroll: false });
  };

  const filterQuery = transactionFiltersQuery(filters);
  const homeHref = filterQuery ? `/?${filterQuery}` : "/";

  return (
    <main className="page-route-enter min-h-dvh bg-background">
      <div className="luna-add-transaction-content mx-auto w-full max-w-[720px] px-4 sm:px-5">
        <StickyPageHeader className="-mx-4 px-4 pb-3 sm:-mx-5 sm:px-5">
          <PageHeader
            leading={<Link href={homeHref} aria-label="Back to home" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><ArrowLeft aria-hidden="true" className="size-5" /></Link>}
            title={<div className="min-w-0"><h1 className="text-[25px] font-semibold tracking-[-0.04em]">Transactions</h1><p className="mt-0.5 text-xs font-medium text-muted-foreground">Track money in and out</p></div>}
            actions={<DatePicker initialMode="all" initialLabel="All time" onApply={setPeriod} />}
          />
        </StickyPageHeader>

        <section aria-label="Transaction history" className="mt-7">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-medium text-muted-foreground">From your accounts</p>
              <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.03em]">All activity</h2>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Newest first</p>
          </div>
          <TransactionFilterBar value={filters} onChange={updateFilters} />
          <TransactionList searchable period={period} filters={filters} />
        </section>
      </div>
      <AddTransactionButton />
    </main>
  );
}
