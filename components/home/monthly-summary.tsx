"use client";

import { ArrowDownLeft, ArrowUpRight, Landmark } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { authenticatedFetch } from "@/lib/auth-client";
import { currencyEntries, formatCurrencyAmount, type CurrencyTotals } from "@/lib/currency";
import type { ApiTransaction } from "@/components/transactions/transaction-list";
import { Skeleton } from "@/components/ui/data-skeleton";
import type { AppliedPeriod } from "@/components/home/date-picker";

type Account = {
  currency: string;
};

type MonthlySummary = {
  totalsByCurrency: Record<string, { income: number; expenses: number; savings: number }>;
  currency: string;
  isLoading: boolean;
};

const MonthlySummaryContext = createContext<MonthlySummary | null>(null);

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonthRange() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    month: dateKey(monthStart).slice(0, 7),
    from: dateKey(monthStart),
    to: dateKey(monthEnd),
  };
}

function useMonthlySummary() {
  const summary = useContext(MonthlySummaryContext);
  if (!summary) {
    throw new Error(
      "Monthly summary components must be used inside MonthlySummaryProvider",
    );
  }
  return summary;
}

export function MonthlySummaryProvider({ children, period }: { children: ReactNode; period?: AppliedPeriod }) {
  const [summary, setSummary] = useState<MonthlySummary>({
    totalsByCurrency: { NPR: { income: 0, expenses: 0, savings: 0 } },
    currency: "NPR",
    isLoading: true,
  });

  useEffect(() => {
    let active = true;
    const defaultRange = currentMonthRange();
    const query = new URLSearchParams();
    const accountsQuery = new URLSearchParams();
    if (period?.mode !== "all" && period?.from && period.to) {
      query.set("from", dateKey(period.from));
      query.set("to", dateKey(period.to));
      accountsQuery.set("month", dateKey(period.from).slice(0, 7));
    } else if (!period || period.mode !== "all") {
      query.set("from", defaultRange.from);
      query.set("to", defaultRange.to);
      accountsQuery.set("month", defaultRange.month);
    }

    void Promise.all([
      authenticatedFetch(`/api/transactions${query.toString() ? `?${query.toString()}` : ""}`),
      authenticatedFetch(`/api/accounts${accountsQuery.toString() ? `?${accountsQuery.toString()}` : ""}`),
      authenticatedFetch("/api/auth/me"),
    ])
      .then(async ([transactionsResponse, accountsResponse, profileResponse]) => {
        if (!transactionsResponse.ok || !accountsResponse.ok) return;

        const transactionsResult = (await transactionsResponse.json()) as {
          transactions?: ApiTransaction[];
        };
        const accountsResult = (await accountsResponse.json()) as {
          accounts?: Account[];
        };
        const profileResult = profileResponse.ok
          ? (await profileResponse.json()) as { user?: { currency?: string } }
          : null;
        const transactions = transactionsResult.transactions ?? [];
        const accounts = accountsResult.accounts ?? [];
        const userCurrency = profileResult?.user?.currency;
        const totalsByCurrency = transactions.reduce(
          (totals, transaction) => {
            const currency = transaction.accountCurrency || userCurrency || "NPR";
            const current = totals[currency] ?? { income: 0, expenses: 0, savings: 0 };
            if (transaction.type === "income") current.income += transaction.amount;
            if (transaction.type === "expense") current.expenses += transaction.amount;
            if (transaction.type === "savings") current.savings += transaction.amount;
            totals[currency] = current;
            return totals;
          },
          {} as Record<string, { income: number; expenses: number; savings: number }>,
        );
        if (!Object.keys(totalsByCurrency).length) {
          totalsByCurrency[userCurrency ?? accounts[0]?.currency ?? "NPR"] = { income: 0, expenses: 0, savings: 0 };
        }
        const currencies = Object.keys(totalsByCurrency).sort();

        if (active) {
          setSummary({
            totalsByCurrency,
            currency: currencies.length === 1 ? currencies[0] : "Mixed",
            isLoading: false,
          });
        }
      })
      .catch(() => {
        if (active) setSummary((current) => ({ ...current, isLoading: false }));
      });

    return () => {
      active = false;
    };
  }, [period]);

  return (
    <MonthlySummaryContext.Provider value={summary}>
      {children}
    </MonthlySummaryContext.Provider>
  );
}

const overview = [
  {
    label: "Income",
    key: "income",
    color: "text-income",
    icon: ArrowDownLeft,
    iconClassName: "bg-income-soft text-income",
  },
  {
    label: "Expenses",
    key: "expenses",
    color: "text-expense",
    icon: ArrowUpRight,
    iconClassName: "bg-expense-soft text-expense",
  },
  {
    label: "Savings",
    key: "savings",
    color: "text-foreground",
    icon: Landmark,
    iconClassName: "bg-primary-soft text-primary",
  },
] as const;

export function MonthlyOverviewCards() {
  const summary = useMonthlySummary();

  return (
    <div className="mt-8">
      <section
        aria-label="Monthly overview"
        data-tour="monthly-overview"
        className={`grid divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-card min-[360px]:grid-cols-3 min-[360px]:divide-x min-[360px]:divide-y-0 ${summary.isLoading ? "" : "route-data-reveal"}`}
      >
        {overview.map((item) => {
          const Icon = item.icon;
          const values = currencyEntries(
            Object.fromEntries(
              Object.entries(summary.totalsByCurrency).map(([currency, totals]) => [currency, totals[item.key as "income" | "expenses" | "savings"]]),
            ) as CurrencyTotals,
          );
          const visibleValues = values.some(([, value]) => value !== 0) ? values.filter(([, value]) => value !== 0) : values.slice(0, 1);

          return (
            <Link
              href={`/analytics/${item.key === "expenses" ? "expenses" : item.key}`}
              aria-label={`View analytics for ${item.label}`}
              className="min-w-0 px-4 py-3.5 min-[360px]:block min-[360px]:px-3 min-[360px]:py-4 sm:px-5"
              key={item.label}
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-[9px] ${item.iconClassName}`}
              >
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <p className="mt-4 text-[13px] font-medium text-muted-foreground">
                {item.label}
              </p>
              <p
                className={`mt-1 text-[17px] font-semibold tracking-[-0.02em] tabular-nums min-[360px]:text-[16px] sm:text-[18px] ${item.color}`}
              >
                {summary.isLoading ? (
                  <Skeleton className="h-5 w-16" />
                ) : (
                  <span className={visibleValues.length > 1 ? "space-y-0.5" : ""}>
                    {visibleValues.map(([currency, value]) => <span className="block" key={currency}>{currency} {formatCurrencyAmount(value)}</span>)}
                  </span>
                )}
              </p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

export function MonthlyCashFlow() {
  const summary = useMonthlySummary();
  const cashFlows = currencyEntries(
    Object.fromEntries(
      Object.entries(summary.totalsByCurrency).map(([currency, totals]) => [currency, totals.income - totals.expenses]),
    ) as CurrencyTotals,
  );
  const visibleCashFlows = cashFlows.some(([, value]) => value !== 0) ? cashFlows.filter(([, value]) => value !== 0) : cashFlows.slice(0, 1);

  return (
    <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${visibleCashFlows.some(([, value]) => value < 0) ? "text-expense" : "text-income"}`}>
      {summary.isLoading ? (
        <Skeleton className="h-5 w-24" />
      ) : (
        <span className="inline-block route-data-reveal">
          <span className={visibleCashFlows.length > 1 ? "space-y-0.5" : ""}>
            {visibleCashFlows.map(([currency, value]) => <span className="block" key={currency}>{value < 0 ? "−" : "+"}{currency} {formatCurrencyAmount(Math.abs(value))}</span>)}
          </span>
        </span>
      )}
    </p>
  );
}
