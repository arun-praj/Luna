"use client";

import Link from "next/link";
import { createElement, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Edit3, Gauge, ReceiptText, Tags, WalletCards } from "lucide-react";

import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { PageDataSkeleton } from "@/components/ui/data-skeleton";
import { authenticatedFetch } from "@/lib/auth-client";
import { formatCurrencyAmount } from "@/lib/currency";
import { getCategoryForeground, getCategoryIcon } from "@/lib/category-appearance";
import { getCurrentRoute, getReturnTo } from "@/lib/navigation";
import type { Budget } from "@/lib/budgets";

type BudgetTransaction = {
  id: string;
  type: string;
  amount: number;
  title: string;
  date: string;
};

type BudgetDetail = {
  budget: Budget;
  history: Budget[];
  transactions: BudgetTransaction[];
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function shortDateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function tone(percentage: number) {
  if (percentage >= 100) return { bar: "bg-expense", text: "text-expense", soft: "bg-expense-soft" };
  if (percentage >= 80) return { bar: "bg-warning", text: "text-warning-foreground", soft: "bg-warning-soft" };
  return { bar: "bg-primary", text: "text-primary", soft: "bg-primary-soft" };
}

export default function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [budgetId, setBudgetId] = useState("");
  const [detail, setDetail] = useState<BudgetDetail | null>(null);
  const [currency, setCurrency] = useState("NPR");
  const [backHref, setBackHref] = useState("/budgets");
  const [currentRoute, setCurrentRoute] = useState("/budgets");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setBackHref(getReturnTo("/budgets"));
      setCurrentRoute(getCurrentRoute());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    void params.then(({ id }) => {
      if (active) setBudgetId(id);
    });
    return () => {
      active = false;
    };
  }, [params]);

  useEffect(() => {
    if (!budgetId) return;
    let active = true;
    void Promise.all([
      authenticatedFetch(`/api/budgets/${budgetId}`),
      authenticatedFetch("/api/auth/me"),
    ])
      .then(async ([budgetResponse, profileResponse]) => {
        if (!budgetResponse.ok) {
          throw new Error(budgetResponse.status === 401 ? "Please sign in to view this budget." : "Budget not found.");
        }
        const result = (await budgetResponse.json()) as BudgetDetail;
        const profile = profileResponse.ok ? await profileResponse.json() as { user?: { currency?: string } } : null;
        if (active) {
          setDetail(result);
          setCurrency(profile?.user?.currency ?? "NPR");
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load this budget.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [budgetId]);

  if (isLoading) return <PageDataSkeleton label="Loading budget" />;
  if (!detail) {
    return (
      <main className="min-h-dvh bg-background px-4 py-8">
        <div role="alert" className="mx-auto max-w-[720px] rounded-[14px] border border-expense/25 bg-expense-soft p-4 text-sm text-expense">
          {error || "Budget not found."}
        </div>
      </main>
    );
  }

  const { budget, history, transactions } = detail;
  const colors = tone(budget.percentage);
  const accent = budget.category?.color ?? "#e3eee9";
  const icon = budget.category ? getCategoryIcon(budget.category.icon, budget.category.name) : WalletCards;
  const editHref = `/budgets?period=${budget.period}&budget=${budget.id}&returnTo=${encodeURIComponent(currentRoute)}`;
  const hasAdjustment = (budget.originalAmount ?? budget.limitAmount) !== (budget.adjustedAmount ?? budget.limitAmount) || (budget.rolloverAmount ?? 0) > 0;

  return (
    <main className="page-route-enter min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-12 sm:px-5">
        <div className="-mx-4 sm:-mx-5" style={{ backgroundColor: accent }}>
          <StickyPageHeader className="!w-full px-4 pb-3 sm:px-5">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Link href={backHref} aria-label="Back" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
                  <ArrowLeft aria-hidden="true" className="size-5" />
                </Link>
                <div className="min-w-0">
                  <h1 className="truncate text-[24px] font-semibold tracking-[-0.04em]">{budget.name.replace(/ budget$/, "")}</h1>
                  <p className="mt-0.5 truncate text-xs font-medium capitalize text-muted-foreground">{budget.period} budget</p>
                </div>
              </div>
              <Link href={editHref} aria-label="Edit budget" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
                <Edit3 aria-hidden="true" className="size-[18px]" />
              </Link>
            </div>
          </StickyPageHeader>
          <section aria-label="Budget summary" className="border-y border-black/10 px-4 py-8 text-center text-foreground sm:px-5">
            <div className="mx-auto flex size-12 items-center justify-center rounded-[14px] text-primary" style={{ backgroundColor: "rgba(255,255,255,0.58)" }}>
              {createElement(icon, { "aria-hidden": true, className: "size-6" })}
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Budget overview</p>
            <p className="mt-1 text-[46px] font-bold leading-none tracking-[-0.06em] tabular-nums text-foreground">{currency} {formatCurrencyAmount(budget.limitAmount)}</p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.1em] text-primary">{dateLabel(budget.periodStart)} – {dateLabel(budget.periodEnd)}</p>
          </section>
        </div>

        <section aria-labelledby="budget-status-heading" className="mt-6 rounded-[16px] border border-border bg-card p-4 shadow-[0_8px_24px_rgb(23_32_29_/_0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Current period</p>
              <h2 id="budget-status-heading" className="mt-1 text-lg font-semibold">{budget.percentage}% used</h2>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors.soft} ${colors.text}`}>{budget.remaining < 0 ? "Over plan" : budget.percentage >= 100 ? "At plan" : "On track"}</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-subtle"><div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${Math.min(100, Math.max(0, budget.percentage))}%` }} /></div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div><p className="text-muted-foreground">Plan</p><p className="mt-1 font-semibold tabular-nums">{currency} {formatCurrencyAmount(budget.limitAmount)}</p></div>
            <div><p className="text-muted-foreground">Spent</p><p className="mt-1 font-semibold tabular-nums">{currency} {formatCurrencyAmount(budget.spent)}</p></div>
            <div className="text-right"><p className="text-muted-foreground">{budget.remaining < 0 ? "Over" : "Remaining"}</p><p className={`mt-1 font-semibold tabular-nums ${budget.remaining < 0 ? "text-expense" : ""}`}>{currency} {formatCurrencyAmount(Math.abs(budget.remaining))}</p></div>
          </div>
          {hasAdjustment ? <div className="mt-4 space-y-2 border-t border-border pt-3 text-xs"><div className="flex justify-between gap-3"><span className="text-muted-foreground">Original plan</span><span className="font-semibold tabular-nums">{currency} {formatCurrencyAmount(budget.originalAmount ?? budget.limitAmount)}</span></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">Adjusted plan</span><span className="font-semibold tabular-nums">{currency} {formatCurrencyAmount(budget.adjustedAmount ?? budget.limitAmount)}</span></div>{(budget.rolloverAmount ?? 0) > 0 ? <div className="flex justify-between gap-3"><span className="text-muted-foreground">Rollover</span><span className="font-semibold tabular-nums">{currency} {formatCurrencyAmount(budget.rolloverAmount ?? 0)}</span></div> : null}</div> : null}
        </section>

        <section aria-labelledby="budget-history-heading" className="mt-8">
          <div className="flex items-end justify-between gap-3 px-1"><div><p className="text-xs font-medium text-muted-foreground">Plans over time</p><h2 id="budget-history-heading" className="mt-1 text-[20px] font-semibold tracking-[-0.03em]">Budget history</h2></div><CalendarDays aria-hidden="true" className="size-5 text-primary" /></div>
          {history.length ? <div className="mt-4 overflow-hidden rounded-[14px] border border-border bg-card">{history.map((item, index) => { const itemTone = tone(item.percentage); return <div key={item.id} className={`px-4 py-3.5 ${index > 0 ? "border-t border-border" : ""}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{dateLabel(item.periodStart)} – {dateLabel(item.periodEnd)}</p><p className="mt-1 text-xs text-muted-foreground">{item.percentage}% used · {currency} {formatCurrencyAmount(item.spent)} spent</p></div><p className="shrink-0 text-sm font-semibold tabular-nums">{currency} {formatCurrencyAmount(item.limitAmount)}</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-subtle"><div className={`h-full rounded-full ${itemTone.bar}`} style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }} /></div></div>; })}</div> : <div className="mt-4 rounded-[14px] border border-dashed border-border-strong bg-card p-8 text-center"><Tags aria-hidden="true" className="mx-auto size-6 text-primary" /><p className="mt-3 text-sm font-semibold">No previous plans yet</p><p className="mt-1 text-xs text-muted-foreground">Future periods will appear here as this budget continues.</p></div>}
        </section>

        <section aria-labelledby="budget-activity-heading" className="mt-8">
          <div className="flex items-end justify-between gap-3 px-1"><div><p className="text-xs font-medium text-muted-foreground">{dateLabel(budget.periodStart)} – {dateLabel(budget.periodEnd)}</p><h2 id="budget-activity-heading" className="mt-1 text-[20px] font-semibold tracking-[-0.03em]">Budget activity</h2></div><ReceiptText aria-hidden="true" className="size-5 text-primary" /></div>
          {transactions.length ? <div className="mt-4 overflow-hidden rounded-[14px] border border-border bg-card">{transactions.map((transaction, index) => <div key={transaction.id} className={`flex items-center gap-3 px-4 py-3.5 ${index > 0 ? "border-t border-border" : ""}`}><span className="flex size-10 shrink-0 items-center justify-center rounded-[11px]" style={{ backgroundColor: accent, color: getCategoryForeground(accent) }}><ReceiptText aria-hidden="true" className="size-[18px]" /></span><div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-3"><p className="truncate text-[14px] font-semibold">{transaction.title}</p><p className="shrink-0 text-[14px] font-semibold tabular-nums text-expense">−{formatCurrencyAmount(transaction.amount)} {currency}</p></div><p className="mt-1 text-xs text-muted-foreground">Expense · {shortDateLabel(transaction.date)}</p></div></div>)}</div> : <div className="mt-4 rounded-[14px] border border-dashed border-border-strong bg-card p-8 text-center"><Gauge aria-hidden="true" className="mx-auto size-6 text-primary" /><p className="mt-3 text-sm font-semibold">No activity in this period</p><p className="mt-1 text-xs text-muted-foreground">Expenses assigned to this budget will appear here.</p></div>}
        </section>

        <Link href={editHref} className="mt-8 flex min-h-11 items-center justify-center rounded-[11px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">Edit budget</Link>
      </div>
    </main>
  );
}
