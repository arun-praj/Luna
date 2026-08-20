"use client";

import { ArrowDownLeft, ArrowUpRight, Landmark } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getAccessTokenSubject, getTransactionRefreshGeneration, revalidateAuthenticatedFetch } from "@/lib/auth-client";
import { currencyEntries, formatCurrencyAmount, type CurrencyTotals } from "@/lib/currency";
import { addMoney } from "@/lib/money";
import { hasFreshDataChanged, useHomeSnapshot, writeHomeSnapshot } from "@/lib/home-snapshot-cache";
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
  freshChangedVersion: number;
};

type MonthlySummarySnapshot = Omit<MonthlySummary, "isLoading" | "freshChangedVersion">;

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

function monthlySummaryScope(period?: AppliedPeriod) {
  if (period?.mode === "all") return "all";
  if (period?.from && period.to) return `from=${dateKey(period.from)}&to=${dateKey(period.to)}`;
  const range = currentMonthRange();
  return `from=${range.from}&to=${range.to}`;
}

function sameSummary(left: MonthlySummarySnapshot, right: MonthlySummarySnapshot) {
  return left.currency === right.currency && JSON.stringify(left.totalsByCurrency) === JSON.stringify(right.totalsByCurrency);
}

function isMonthlySummarySnapshot(value: unknown): value is MonthlySummarySnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<MonthlySummarySnapshot>;
  return typeof snapshot.currency === "string"
    && Boolean(snapshot.totalsByCurrency)
    && typeof snapshot.totalsByCurrency === "object";
}

const emptySummary: MonthlySummary = {
  totalsByCurrency: { NPR: { income: 0, expenses: 0, savings: 0 } },
  currency: "NPR",
  isLoading: true,
  freshChangedVersion: 0,
};

export function useMonthlySummary() {
  const summary = useContext(MonthlySummaryContext);
  if (!summary) {
    throw new Error(
      "Monthly summary components must be used inside MonthlySummaryProvider",
    );
  }
  return summary;
}

export function MonthlySummaryProvider({ children, period }: { children: ReactNode; period?: AppliedPeriod }) {
  const [authSubject, setAuthSubject] = useState<string | null>(getAccessTokenSubject);
  const userId = authSubject;
  const scope = monthlySummaryScope(period);
  const displayKey = `${userId ?? ""}:${scope}`;
  const cached = useHomeSnapshot("monthly-summary", userId, scope, isMonthlySummarySnapshot);
  const [summary, setSummary] = useState<MonthlySummary>(emptySummary);
  const [freshSummaryKey, setFreshSummaryKey] = useState<string | null>(null);
  const [refreshGeneration, setRefreshGeneration] = useState(() => getTransactionRefreshGeneration());
  const [freshChangeVersion, setFreshChangeVersion] = useState(0);
  const [freshChangeScope, setFreshChangeScope] = useState<string | null>(null);
  const lastSummaryScopeRef = useRef(displayKey);
  const lastSummaryRef = useRef<MonthlySummarySnapshot | null>(cached?.data ?? null);

  useEffect(() => {
    const handleAuthChanged = () => {
      const nextSubject = getAccessTokenSubject();
      if (nextSubject === userId) return;
      setAuthSubject(nextSubject);
      setSummary(emptySummary);
      setFreshSummaryKey(null);
      setFreshChangeScope(null);
      setFreshChangeVersion(0);
      setRefreshGeneration(getTransactionRefreshGeneration());
    };
    window.addEventListener("cocomelon:auth-changed", handleAuthChanged);
    return () => window.removeEventListener("cocomelon:auth-changed", handleAuthChanged);
  }, [userId]);

  useEffect(() => {
    const refresh = (event: Event) => {
      const generation = event instanceof CustomEvent && typeof event.detail?.generation === "number"
        ? event.detail.generation
        : null;
      setRefreshGeneration((current) => Math.max(current + 1, generation ?? getTransactionRefreshGeneration()));
    };
    window.addEventListener("cocomelon:transactions-changed", refresh);
    return () => window.removeEventListener("cocomelon:transactions-changed", refresh);
  }, []);

  useEffect(() => {
    if (lastSummaryScopeRef.current !== displayKey || (lastSummaryRef.current === null && cached)) {
      lastSummaryScopeRef.current = displayKey;
      lastSummaryRef.current = cached?.data ?? null;
    }
  }, [cached, displayKey]);

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
      revalidateAuthenticatedFetch(`/api/transactions${query.toString() ? `?${query.toString()}` : ""}`, {}, { generation: refreshGeneration }),
      revalidateAuthenticatedFetch(`/api/accounts${accountsQuery.toString() ? `?${accountsQuery.toString()}` : ""}`, {}, { generation: refreshGeneration }),
      revalidateAuthenticatedFetch("/api/auth/me", {}, { generation: refreshGeneration }),
    ])
      .then(async ([transactionsResponse, accountsResponse, profileResponse]) => {
        if (!transactionsResponse.ok || !accountsResponse.ok || !profileResponse.ok) throw new Error("Monthly summary refresh failed");

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
            if (transaction.type === "income") current.income = addMoney(current.income, transaction.amount);
            if (transaction.type === "expense") current.expenses = addMoney(current.expenses, transaction.amount);
            if (transaction.type === "savings") current.savings = addMoney(current.savings, transaction.amount);
            totals[currency] = current;
            return totals;
          },
          {} as Record<string, { income: number; expenses: number; savings: number }>,
        );
        if (!Object.keys(totalsByCurrency).length) {
          totalsByCurrency[userCurrency ?? accounts[0]?.currency ?? "NPR"] = { income: 0, expenses: 0, savings: 0 };
        }
        const currencies = Object.keys(totalsByCurrency).sort();

        const nextSummary: MonthlySummarySnapshot = {
            totalsByCurrency,
            currency: currencies.length === 1 ? currencies[0] : "Mixed",
        };
        const currentUserId = getAccessTokenSubject();
        if (active && currentUserId && (!userId || userId === currentUserId)) {
          writeHomeSnapshot("monthly-summary", currentUserId, scope, nextSummary);
          const freshChanged = hasFreshDataChanged(lastSummaryRef.current, nextSummary);
          lastSummaryRef.current = nextSummary;
          setSummary((current) => sameSummary(current, nextSummary) && !current.isLoading
            ? current
            : { ...nextSummary, isLoading: false, freshChangedVersion: 0 });
          setFreshSummaryKey(displayKey);
          if (freshChanged) {
            setFreshChangeScope(displayKey);
            setFreshChangeVersion((current) => current + 1);
          }
        }
      })
      .catch(() => {
        if (active && !cached) {
          setSummary((current) => ({ ...emptySummary, currency: current.currency, isLoading: false, freshChangedVersion: 0 }));
          setFreshSummaryKey(displayKey);
        }
      });

    return () => {
      active = false;
    };
  }, [cached, displayKey, period, refreshGeneration, scope, userId]);

  const displayedSummary = freshSummaryKey === displayKey
    ? { ...summary, freshChangedVersion: freshChangeScope === displayKey ? freshChangeVersion : 0 }
    : cached
      ? { ...cached.data, isLoading: false, freshChangedVersion: 0 }
      : { ...emptySummary, isLoading: true, freshChangedVersion: 0 };
  return (
    <MonthlySummaryContext.Provider value={displayedSummary}>
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
    color: "text-info",
    icon: Landmark,
    iconClassName: "bg-info-soft text-info",
  },
] as const;

export function MonthlyOverviewCards({ compact = false }: { compact?: boolean }) {
  const summary = useMonthlySummary();

  if (compact) {
    return (
      <div className="mt-6 grid min-w-0 grid-cols-3 divide-x divide-border overflow-hidden rounded-[12px] border border-border bg-card" aria-label="Monthly overview" data-tour="monthly-overview">
        {overview.map((item) => {
          const Icon = item.icon;
          const values = currencyEntries(
            Object.fromEntries(
              Object.entries(summary.totalsByCurrency).map(([currency, totals]) => [currency, totals[item.key]]),
            ) as CurrencyTotals,
          );
          const visibleValues = values.some(([, value]) => value !== 0) ? values.filter(([, value]) => value !== 0) : values.slice(0, 1);

          return (
            <Link
              href={`/analytics/${item.key === "expenses" ? "expenses" : item.key}`}
              aria-label={`View analytics for ${item.label}`}
              className="flex min-h-[62px] min-w-0 flex-col justify-center px-2 py-2 transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 min-[390px]:px-2.5"
              key={item.label}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className={`flex size-5 shrink-0 items-center justify-center rounded-[6px] ${item.iconClassName}`}>
                  <Icon aria-hidden="true" className="size-3" />
                </span>
                <span className="truncate text-[13px] font-medium text-muted-foreground">{item.label}</span>
              </span>
              <span className={`mt-1 block min-w-0 font-semibold tabular-nums ${item.color}`}>
                {summary.isLoading
                  ? <Skeleton className="h-4 w-full max-w-20" />
                  : visibleValues.map(([currency, value]) => (
                    <span className="flex min-w-0 items-baseline justify-between gap-1 whitespace-nowrap" key={`${currency}:${value}`}>
                      <span className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{currency}</span>
                      <span className="text-[clamp(14px,3.5vw,17px)] leading-5">{formatCurrencyAmount(value)}</span>
                    </span>
                  ))}
              </span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <section
        aria-label="Monthly overview"
        data-tour="monthly-overview"
        key={`monthly-overview:${summary.freshChangedVersion}`}
        className={`grid divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-card min-[360px]:grid-cols-3 min-[360px]:divide-x min-[360px]:divide-y-0 ${summary.freshChangedVersion ? "route-data-reveal" : ""}`}
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
                    {visibleValues.map(([currency, value]) => <span className="block" key={`${currency}:${value}`}>{currency} {formatCurrencyAmount(value)}</span>)}
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
        <span key={`cash-flow:${summary.freshChangedVersion}`} className={summary.freshChangedVersion ? "inline-block route-data-reveal" : "inline-block"}>
          <span className={visibleCashFlows.length > 1 ? "space-y-0.5" : ""}>
            {visibleCashFlows.map(([currency, value]) => <span className="block" key={`${currency}:${value}`}>{value < 0 ? "−" : "+"}{currency} {formatCurrencyAmount(Math.abs(value))}</span>)}
          </span>
        </span>
      )}
    </p>
  );
}
