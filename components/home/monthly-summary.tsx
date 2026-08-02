"use client";

import { ArrowDownLeft, ArrowUpRight, Landmark } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { authenticatedFetch } from "@/lib/auth-client";
import type { ApiTransaction } from "@/components/transactions/transaction-list";
import { Skeleton } from "@/components/ui/data-skeleton";
import type { AppliedPeriod } from "@/components/home/date-picker";

type Account = {
  currency: string;
};

type MonthlySummary = {
  income: number;
  expenses: number;
  savings: number;
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

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
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
    income: 0,
    expenses: 0,
    savings: 0,
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
        const currencies = [
          ...new Set([
            ...accounts.map((account) => account.currency),
            ...transactions.map((transaction) => transaction.accountCurrency),
          ]),
        ];

        const nextSummary = transactions.reduce(
          (totals, transaction) => {
            if (transaction.type === "income")
              totals.income += transaction.amount;
            if (transaction.type === "expense")
              totals.expenses += transaction.amount;
            if (transaction.type === "savings")
              totals.savings += transaction.amount;
            return totals;
          },
          { income: 0, expenses: 0, savings: 0 },
        );

        if (active) {
          setSummary({
            ...nextSummary,
            currency:
              userCurrency ?? (currencies.length === 1
                ? currencies[0]
                : currencies.length > 1
                  ? "Mixed"
                  : "NPR"),
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
    <section
      aria-label="Monthly overview"
      data-tour="monthly-overview"
      className={`mt-8 grid divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-card min-[360px]:grid-cols-3 min-[360px]:divide-x min-[360px]:divide-y-0 ${summary.isLoading ? "" : "route-data-reveal"}`}
    >
      {overview.map((item) => {
        const Icon = item.icon;
        const value = summary[item.key];

        return (
          <Link
            href={`/analytics/${item.key === "expenses" ? "expenses" : item.key}`}
            aria-label={`View analytics for ${item.label}`}
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
            </p>
            <p
              className={`ml-auto text-[17px] font-semibold tracking-[-0.02em] tabular-nums min-[360px]:ml-0 min-[360px]:mt-1 min-[360px]:text-[16px] sm:text-[18px] ${item.color}`}
            >
              {summary.isLoading ? (
                <Skeleton className="ml-auto h-5 w-16 min-[360px]:ml-0" />
              ) : (
                <>{summary.currency !== "Mixed" ? <span className="mr-1 text-[12px] font-semibold tracking-normal">{summary.currency}</span> : null}{formatAmount(value)}</>
              )}
            </p>
          </Link>
        );
      })}
    </section>
  );
}

export function MonthlyCashFlow() {
  const summary = useMonthlySummary();
  const cashFlow = useMemo(
    () => summary.income - summary.expenses,
    [summary.expenses, summary.income],
  );
  const prefix = cashFlow < 0 ? "−" : "+";

  return (
    <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${cashFlow < 0 ? "text-expense" : "text-income"}`}>
      {summary.isLoading ? (
        <Skeleton className="h-5 w-24" />
      ) : (
        <span className="inline-block route-data-reveal">
          {`${prefix}${summary.currency === "Mixed" ? "" : `${summary.currency} `}${formatAmount(Math.abs(cashFlow))}`}
        </span>
      )}
    </p>
  );
}
