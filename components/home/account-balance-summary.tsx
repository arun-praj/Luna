"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Landmark, Tags, Target, WalletCards } from "lucide-react";

import { authenticatedFetch } from "@/lib/auth-client";
import { addCurrencyAmount, currencyEntries, formatCurrencyAmount } from "@/lib/currency";
import { Skeleton } from "@/components/ui/data-skeleton";

type Account = {
  currency: string;
  currentBalance: number;
  includeInTotalBalance?: boolean;
};

export function AccountBalanceSummary() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("NPR");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void Promise.all([
      authenticatedFetch("/api/accounts"),
      authenticatedFetch("/api/auth/me"),
    ])
      .then(async ([accountsResponse, profileResponse]) => {
        if (!accountsResponse.ok) return;
        const result = (await accountsResponse.json()) as { accounts?: Account[] };
        const profile = profileResponse.ok
          ? (await profileResponse.json()) as { user?: { currency?: string } }
          : null;
        if (active) {
          setAccounts(result.accounts ?? []);
          if (profile?.user?.currency) setDisplayCurrency(profile.user.currency);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const balanceByCurrency = useMemo(() => {
    const totals = {} as Record<string, number>;
    for (const account of accounts) {
      if (account.includeInTotalBalance === false) continue;
      addCurrencyAmount(totals, account.currency, account.currentBalance);
    }
    return currencyEntries(totals);
  }, [accounts]);
  const primaryCurrency = balanceByCurrency.some(([currency]) => currency === displayCurrency)
    ? displayCurrency
    : balanceByCurrency[0]?.[0] ?? displayCurrency;
  const primaryBalance = balanceByCurrency.find(([currency]) => currency === primaryCurrency)?.[1] ?? 0;
  const otherBalances = balanceByCurrency.filter(([currency]) => currency !== primaryCurrency);

  return (
    <section aria-labelledby="balance-heading" data-tour="total-balance" className="mt-10">
      <p
        id="balance-heading"
        className="text-sm font-medium text-muted-foreground"
      >
        Total balance
      </p>
      {isLoading ? (
        <p className="mt-2"><Skeleton className="inline-block h-10 w-44 align-middle rounded-md" /></p>
      ) : (
        <p className="mt-2 font-sans text-[36px] font-semibold leading-none tracking-[-0.045em] tabular-nums text-foreground sm:text-[40px]">
          <span className="mr-2 text-[17px] font-semibold tracking-normal text-muted-foreground">
            {primaryCurrency}
          </span>
          <Link
            href="/accounts"
            aria-label="View accounts"
            className={`rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 hover:text-primary ${primaryBalance < 0 ? "text-expense" : "text-foreground"}`}
          >
            {formatCurrencyAmount(primaryBalance)}
          </Link>
        </p>
      )}
      {!isLoading && otherBalances.length ? (
        <p className="mt-2 text-xs font-semibold tabular-nums text-muted-foreground" aria-label="Other currency balances">
          {otherBalances.map(([currency, amount], index) => <span key={currency}>{index ? " · " : ""}{currency} {formatCurrencyAmount(amount)}</span>)}
        </p>
      ) : null}
      <nav aria-label="Balance details" className="mt-3 flex w-full flex-nowrap gap-x-3 overflow-x-auto overscroll-x-contain pb-1 whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href="/accounts"
          className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md pr-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          <WalletCards aria-hidden="true" className="size-3 text-primary" />
          Accounts
          <ChevronRight aria-hidden="true" className="size-3" />
        </Link>
        <Link
          href="/categories"
          className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md pr-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          <Tags aria-hidden="true" className="size-3 text-primary" />
          Categories
          <ChevronRight aria-hidden="true" className="size-3" />
        </Link>
        <Link
          href="/savings-instruments"
          className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md pr-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          <Landmark aria-hidden="true" className="size-3 text-primary" />
          Saving Instruments
          <ChevronRight aria-hidden="true" className="size-3" />
        </Link>
        <Link href="/goals" className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md pr-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
          <Target aria-hidden="true" className="size-3 text-primary" />
          Goals
          <ChevronRight aria-hidden="true" className="size-3" />
        </Link>
      </nav>
    </section>
  );
}
