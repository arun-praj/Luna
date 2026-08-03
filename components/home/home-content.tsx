"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { DatePicker, type AppliedPeriod } from "@/components/home/date-picker";
import { AccountBalanceSummary } from "@/components/home/account-balance-summary";
import { MonthlyCashFlow, MonthlyOverviewCards, MonthlySummaryProvider } from "@/components/home/monthly-summary";
import { UserGreeting } from "@/components/home/user-greeting";
import { UserAvatar } from "@/components/home/user-avatar";
import { AddTransactionButton } from "@/components/transactions/add-transaction-button";
import { TransactionList } from "@/components/transactions/transaction-list";
import { AppTutorial } from "@/components/tutorial/app-tutorial";
import { InstallAppCard } from "@/components/pwa/install-app-card";

function currentMonthPeriod(): AppliedPeriod {
  const now = new Date();
  return {
    mode: "month",
    label: `${new Intl.DateTimeFormat("en-US", { month: "short" }).format(now)} ${now.getFullYear()}`,
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
}

export function HomeContent() {
  const [period, setPeriod] = useState<AppliedPeriod>(currentMonthPeriod);

  return (
    <>
      <main className="page-route-enter min-h-screen bg-background">
        <div className="mx-auto w-full max-w-[720px] px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-5">
          <header className="-mx-4 flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:-mx-5 sm:px-5 sm:pt-10">
            <Link
              href="/profile"
              aria-label="Open your profile"
              className="group flex min-w-0 items-center gap-3 rounded-[12px] pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <span className="size-11 shrink-0"><UserAvatar /></span>
              <h1 className="truncate text-[24px] font-semibold tracking-[-0.035em] text-foreground sm:text-[26px]">
                Hi, <UserGreeting />
              </h1>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>

            <DatePicker onApply={setPeriod} />
          </header>

          <AccountBalanceSummary />
          <InstallAppCard />

          <MonthlySummaryProvider period={period}>
            <MonthlyOverviewCards />

            <section aria-labelledby="activity-heading" data-tour="activity" className="mt-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium text-muted-foreground">{period.mode === "month" ? "This month" : period.label}</p>
                  <h2 id="activity-heading" className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">Activity</h2>
                </div>
                <div className="flex flex-col items-end">
                  <Link href="/transactions" className="min-h-8 px-1 text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">See all</Link>
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">Cash flow</p>
                  <MonthlyCashFlow />
                </div>
              </div>

              <TransactionList period={period} />
            </section>
          </MonthlySummaryProvider>
        </div>
      </main>
      <AddTransactionButton />
      <AppTutorial mode="home" />
    </>
  );
}
