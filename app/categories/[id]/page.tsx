"use client";

import Link from "next/link";
import { createElement, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Edit3,
  Gauge,
  ChevronRight,
} from "lucide-react";

import { DatePicker, type AppliedPeriod } from "@/components/home/date-picker";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { PageHeader } from "@/components/layout/page-header";
import { authenticatedFetch } from "@/lib/auth-client";
import { sumMoney } from "@/lib/money";
import { getCurrentRoute, getReturnTo, withReturnTo } from "@/lib/navigation";
import { getCategoryForeground, getCategoryIcon } from "@/lib/category-appearance";
import { transactionTypeMeta as transactionMeta } from "@/components/transactions/transaction-presentation";
import type { Budget } from "@/lib/budgets";
import {
  ListDataSkeleton,
  PageDataSkeleton,
} from "@/components/ui/data-skeleton";

type Category = {
  id: string;
  name: string;
  type: "expense" | "income";
  icon: string | null;
  color: string | null;
};
type CategoryTransaction = {
  id: string;
  type: "expense" | "income" | "savings" | "transfer" | "adjust_balance" | "goal_spend";
  amount: number;
  title: string;
  notes: string | null;
  date: string;
};

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function currentMonthPeriod(): AppliedPeriod {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    mode: "month",
    label: new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(now),
    from,
    to,
  };
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export default function CategoryActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [backHref, setBackHref] = useState("/categories");
  const [currentRoute, setCurrentRoute] = useState("/");
  const [categoryId, setCategoryId] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [transactions, setTransactions] = useState<CategoryTransaction[]>([]);
  const [currency, setCurrency] = useState("NPR");
  const [period, setPeriod] = useState<AppliedPeriod>(currentMonthPeriod);
  const [loadedPeriod, setLoadedPeriod] = useState<AppliedPeriod | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState<Budget | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setBackHref(getReturnTo("/categories"));
      setCurrentRoute(getCurrentRoute());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    void params.then(({ id }) => {
      if (active) setCategoryId(id);
    });
    return () => {
      active = false;
    };
  }, [params]);

  useEffect(() => {
    if (!categoryId) return;
    let active = true;
    const query = new URLSearchParams({ categoryId });
    if (period.from && period.to) {
      query.set("from", dateKey(period.from));
      query.set("to", dateKey(period.to));
    }
    void Promise.all([
      authenticatedFetch("/api/categories"),
      authenticatedFetch(`/api/transactions?${query.toString()}`),
      authenticatedFetch("/api/auth/me"),
      authenticatedFetch("/api/budgets?period=monthly"),
    ])
      .then(
        async ([categoryResponse, transactionResponse, profileResponse, budgetResponse]) => {
          if (!categoryResponse.ok || !transactionResponse.ok)
            throw new Error(
              transactionResponse.status === 401
                ? "Please sign in to view category activity."
                : "Could not load category activity.",
            );
          const categoryResult = (await categoryResponse.json()) as {
            categories: Category[];
          };
          const transactionResult = (await transactionResponse.json()) as {
            transactions: CategoryTransaction[];
          };
          const profileResult = profileResponse.ok
            ? ((await profileResponse.json()) as {
                user?: { currency?: string };
              })
            : null;
          const budgetResult = budgetResponse.ok ? await budgetResponse.json() as { budgets: Budget[] } : { budgets: [] };
          const selectedCategory = categoryResult.categories.find(
            (item) => item.id === categoryId,
          );
          if (!selectedCategory) throw new Error("Category not found.");
          if (active) {
            setCategory(selectedCategory);
            setTransactions(transactionResult.transactions);
            setCurrency(profileResult?.user?.currency ?? "NPR");
            setLoadedPeriod(period);
            setMonthlyBudget(budgetResult.budgets.find((budget) => budget.categoryId === categoryId) ?? null);
          }
        },
      )
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load category activity.",
          );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [categoryId, period]);

  const categoryIcon = getCategoryIcon(category?.icon, category?.name);
  const categoryAccent = category?.color ?? "#e3eee9";
  const total = useMemo(
    () =>
      transactions.reduce((sum, transaction) => sumMoney([sum, transaction.amount]), 0),
    [transactions],
  );
  const isLoadingActivity = loadedPeriod !== period;

  if (isLoading) return <PageDataSkeleton label="Loading category" />;
  if (!category)
    return (
      <main className="min-h-dvh bg-background px-4 py-8">
        <div
          role="alert"
          className="mx-auto max-w-[720px] rounded-[14px] border border-expense/25 bg-expense-soft p-4 text-sm text-expense"
        >
          {error || "Category not found."}
        </div>
      </main>
    );

  return (
    <main className="page-route-enter min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-12 sm:px-5">
        <div
          className="-mx-4 sm:-mx-5"
          style={{ backgroundColor: categoryAccent }}
        >
          <StickyPageHeader className="!w-full px-4 pb-3 sm:px-5">
            <PageHeader
              leading={<Link href={backHref} aria-label="Back" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><ArrowLeft aria-hidden="true" className="size-5" /></Link>}
              title={<div className="min-w-0"><h1 className="break-words text-[22px] font-semibold leading-tight tracking-[-0.04em]">{category.name}</h1><p className="mt-0.5 break-words text-xs font-medium capitalize text-muted-foreground">{category.type} category</p></div>}
              actions={<Link href={withReturnTo(`/categories/${category.id}/edit`, currentRoute)} aria-label="Edit category" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><Edit3 aria-hidden="true" className="size-[18px]" /></Link>}
            />
          </StickyPageHeader>
          <section
            aria-label="Category activity summary"
            className="border-y border-black/10 px-4 py-8 text-center text-foreground sm:px-5"
          >
            <div
              className="mx-auto flex size-12 items-center justify-center rounded-[14px] text-primary"
              style={{ backgroundColor: "rgba(255,255,255,0.58)" }}
            >
              {createElement(categoryIcon, { "aria-hidden": true, className: "size-6" })}
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Category activity
            </p>
            <p className="mt-1 text-[46px] font-bold leading-none tracking-[-0.06em] tabular-nums text-foreground">
              {formatAmount(total)}
            </p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.1em] text-primary">
              {currency}
            </p>
          </section>
        </div>
        {category.type === "expense" ? (
          <section aria-labelledby="category-budget-heading" className="mt-6">
            <Link href={`/budgets?period=monthly&${monthlyBudget ? `budget=${monthlyBudget.id}` : `category=${category.id}`}&returnTo=${encodeURIComponent(currentRoute)}`} className="flex items-center gap-3 rounded-[16px] border border-border bg-card p-4 shadow-[0_8px_24px_rgb(23_32_29_/_0.04)] transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-primary-soft text-primary"><Gauge aria-hidden="true" className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Monthly budget</p><h2 id="category-budget-heading" className="mt-1 text-sm font-semibold">{monthlyBudget ? `${monthlyBudget.percentage}% used` : "Set budget"}</h2></div>{monthlyBudget ? <p className={`shrink-0 text-sm font-semibold tabular-nums ${monthlyBudget.percentage >= 100 ? "text-expense" : monthlyBudget.percentage >= 80 ? "text-warning-foreground" : "text-primary"}`}>{currency} {formatAmount(monthlyBudget.remaining < 0 ? Math.abs(monthlyBudget.remaining) : monthlyBudget.remaining)}<span className="block text-right text-[10px] font-medium text-muted-foreground">{monthlyBudget.remaining < 0 ? "over" : "remaining"}</span></p> : null}</div>
                {monthlyBudget ? <><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-subtle"><div className={`h-full rounded-full ${monthlyBudget.percentage >= 100 ? "bg-expense" : monthlyBudget.percentage >= 80 ? "bg-warning" : "bg-primary"}`} style={{ width: `${Math.min(100, monthlyBudget.percentage)}%` }} /></div><p className="mt-2 text-[11px] font-semibold text-primary">Edit budget</p></> : <p className="mt-1 text-xs text-muted-foreground">Keep this category within a comfortable limit.</p>}
              </div>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-foreground-subtle" />
            </Link>
          </section>
        ) : null}
        <section
          aria-labelledby="category-transactions-heading"
          className="mt-8"
        >
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {period.label}
              </p>
              <h2
                id="category-transactions-heading"
                className="mt-1 text-[20px] font-semibold tracking-[-0.03em]"
              >
                Transactions
              </h2>
            </div>
            <DatePicker initialMode="month" initialLabel={period.label} onApply={setPeriod} />
          </div>
          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-[14px] border border-expense/25 bg-expense-soft p-4 text-sm text-expense"
            >
              {error}
            </div>
          ) : isLoadingActivity ? (
            <ListDataSkeleton rows={3} />
          ) : transactions.length === 0 ? (
            <div className="mt-4 rounded-[14px] border border-dashed border-border-strong bg-card p-8 text-center">
              <p className="text-sm font-semibold">
                No transactions {period.mode === "month" ? "this month" : "yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Transactions assigned to this category will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-[14px] border border-border bg-card">
              {transactions.map((transaction, index) => {
                const meta = transactionMeta[transaction.type];
                const categoryColor = category?.color ?? "#dcece7";
                const Icon = getCategoryIcon(category?.icon, category?.name);
                return (
                  <div
                    key={transaction.id}
                    className={`flex items-center gap-3 px-4 py-3.5 ${index > 0 ? "border-t border-border" : ""}`}
                  >
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-[11px]"
                      style={{
                        backgroundColor: categoryColor,
                        color: getCategoryForeground(categoryColor),
                      }}
                    >
                      <Icon aria-hidden="true" className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-[14px] font-semibold">
                          {transaction.title || transaction.notes || meta.label}
                        </p>
                        <p
                          className={`shrink-0 text-[14px] font-semibold tabular-nums ${meta.amountClassName}`}
                        >
                          {meta.prefix}
                          {formatAmount(transaction.amount)} {currency}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{meta.label}</span>
                        <span className="shrink-0">
                          {formatDate(transaction.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
