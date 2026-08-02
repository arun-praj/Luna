"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, CalendarDays, Landmark } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DatePicker, type AppliedPeriod } from "@/components/home/date-picker";
import type { ApiTransaction } from "@/components/transactions/transaction-list";
import { ListDataSkeleton } from "@/components/ui/data-skeleton";
import { authenticatedFetch } from "@/lib/auth-client";
import { getCategoryForeground, getCategoryIcon } from "@/lib/category-appearance";

export type AnalyticsType = "income" | "expenses" | "savings";

type MonthPoint = { key: string; label: string; amount: number };
const chartColors = ["#9e514b", "#95631e", "#735b8f", "#2f7d5a", "#a9512e", "#537fae", "#356b68", "#7b8f8e"];

const pageMeta = {
  income: { label: "Income", description: "How much you earn each month", icon: ArrowDownLeft, iconClassName: "bg-income-soft text-income", chartTitle: "Monthly income", chartDescription: "Your earnings over the last 12 months" },
  expenses: { label: "Expenses", description: "Where your money goes", icon: ArrowUpRight, iconClassName: "bg-expense-soft text-expense", chartTitle: "Spending by category", chartDescription: "The categories taking the biggest share" },
  savings: { label: "Savings", description: "How much you set aside", icon: Landmark, iconClassName: "bg-primary-soft text-primary", chartTitle: "Monthly savings", chartDescription: "Your progress month by month" },
} as const;

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function createMonthsBetween(from: Date, to: Date) {
  const start = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  const points: MonthPoint[] = [];
  const cursor = new Date(start);
  while (cursor <= end && points.length < 60) {
    points.push({ key: monthKey(cursor), label: new Intl.DateTimeFormat("en-US", { month: "short" }).format(cursor), amount: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return points;
}

function normalizePeriod(period: AppliedPeriod): AppliedPeriod {
  const monthMatch = period.mode === "last" ? period.label.match(/^Last (\d+) months$/) : null;
  if (!monthMatch) return period;
  const count = Number(monthMatch[1]);
  const now = new Date();
  return { ...period, from: new Date(now.getFullYear(), now.getMonth() - count + 1, 1), to: now };
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(amount));
}

function currencyAmount(amount: number, currency: string) {
  return `${currency === "Mixed" ? "" : `${currency} `}${formatAmount(amount)}`;
}

function TrendChart({ points, currency, periodLabel }: { points: MonthPoint[]; currency: string; periodLabel: string }) {
  const width = 720;
  const height = 270;
  const left = 44;
  const right = 12;
  const top = 20;
  const bottom = 32;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const max = Math.max(1, ...points.map((point) => point.amount));
  const coordinates = points.map((point, index) => {
    const x = left + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);
    const y = top + chartHeight - (point.amount / max) * chartHeight;
    return { x, y };
  });
  const line = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const area = `${left},${top + chartHeight} ${line} ${left + chartWidth},${top + chartHeight}`;

  return (
    <div>
      <div className="mb-2 flex justify-between text-xs font-medium text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-income" />Income</span><span>{currency}</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} className="hidden h-auto w-full sm:block" role="img" aria-label="Monthly income chart">
        {[0, 0.5, 1].map((ratio) => { const y = top + chartHeight * ratio; return <line key={ratio} x1={left} x2={width - right} y1={y} y2={y} stroke="currentColor" className="text-border" strokeDasharray="3 5" />; })}
        <text x={left - 8} y={top + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">{formatAmount(max)}</text>
        <text x={left - 8} y={top + chartHeight + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">0</text>
        <polygon points={area} fill="#356b68" opacity="0.1" />
        <polyline points={line} fill="none" stroke="#356b68" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map(({ x, y }, index) => <circle key={points[index].key} cx={x} cy={y} r="4" fill="white" stroke="#356b68" strokeWidth="2.5" />)}
        {points.map((point, index) => <text key={point.key} x={coordinates[index].x} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">{point.label}</text>)}
      </svg>
      <MobileTrendChart points={points} currency={currency} periodLabel={periodLabel} />
    </div>
  );
}

function MobileTrendChart({ points, currency, periodLabel }: { points: MonthPoint[]; currency: string; periodLabel: string }) {
  const recent = points.length > 6 ? points.slice(-6) : points;
  const chartLabel = points.length > recent.length ? `Recent 6 of ${periodLabel}` : periodLabel;
  const width = 360;
  const height = 260;
  const left = 42;
  const right = 12;
  const top = 42;
  const bottom = 38;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const max = Math.max(1, ...recent.map((point) => point.amount));
  const coordinates = recent.map((point, index) => ({
    x: left + (recent.length === 1 ? chartWidth / 2 : (index / (recent.length - 1)) * chartWidth),
    y: top + chartHeight - (point.amount / max) * chartHeight,
  }));
  const line = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const area = `${left},${top + chartHeight} ${line} ${left + chartWidth},${top + chartHeight}`;
  const latest = recent[recent.length - 1];
  return (
    <div className="rounded-[14px] bg-income-soft/45 p-3 sm:hidden">
      <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold text-income">{chartLabel}</p><p className="mt-0.5 text-[11px] text-muted-foreground">Monthly earnings</p></div><p className="text-right text-sm font-semibold tabular-nums text-income">{currency} {formatAmount(latest?.amount ?? 0)}<span className="block text-[10px] font-medium text-muted-foreground">latest month</span></p></div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-auto w-full" role="img" aria-label={`${chartLabel} income chart`}>
        {[0, 0.5, 1].map((ratio) => { const y = top + chartHeight * ratio; return <line key={ratio} x1={left} x2={width - right} y1={y} y2={y} stroke="currentColor" className="text-income/20" strokeDasharray="3 5" />; })}
        <text x={left - 8} y={top + 4} textAnchor="end" className="fill-income text-[12px]">{formatAmount(max)}</text>
        <text x={left - 8} y={top + chartHeight + 4} textAnchor="end" className="fill-muted-foreground text-[12px]">0</text>
        <polygon points={area} fill="#356b68" opacity="0.14" />
        <polyline points={line} fill="none" stroke="#356b68" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map(({ x, y }, index) => <g key={recent[index].key}><circle cx={x} cy={y} r="6" fill="white" stroke="#356b68" strokeWidth="3" /><text x={x} y={y - 12} textAnchor="middle" className="fill-income text-[11px] font-semibold">{formatAmount(recent[index].amount)}</text><text x={x} y={height - 10} textAnchor="middle" className="fill-muted-foreground text-[12px]">{recent[index].label}</text></g>)}
      </svg>
    </div>
  );
}

function ExpenseDonut({ slices, currency }: { slices: Array<{ name: string; amount: number; color: string }>; currency: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0);
  let cursor = 0;
  const gradient = slices.length ? slices.map((slice) => { const start = cursor; cursor += (slice.amount / total) * 360; return `${slice.color} ${start}deg ${cursor}deg`; }).join(", ") : "#e7ece9 0deg 360deg";
  return (
    <div className="grid items-center gap-5 min-[420px]:grid-cols-[150px_1fr]">
      <div className="mx-auto grid size-44 place-items-center rounded-full min-[420px]:size-36" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label="Expense category donut chart"><div className="grid size-[110px] place-items-center rounded-full bg-card text-center min-[420px]:size-[92px]"><span><span className="block text-[11px] font-medium text-muted-foreground">Total spent</span><strong className="mt-1 block text-sm">{currencyAmount(total, currency)}</strong></span></div></div>
      <div className="space-y-2.5">{slices.length ? slices.map((slice) => <div key={slice.name} className="flex items-center gap-2 text-xs"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} /><span className="min-w-0 flex-1 truncate font-medium">{slice.name}</span><span className="shrink-0 tabular-nums text-muted-foreground">{currencyAmount(slice.amount, currency)}</span></div>) : <p className="text-sm text-muted-foreground">Expense categories will appear after you add transactions.</p>}</div>
    </div>
  );
}

function SavingsBars({ points, currency, periodLabel }: { points: MonthPoint[]; currency: string; periodLabel: string }) {
  const recent = points.length > 6 ? points.slice(-6) : points;
  const total = points.reduce((sum, point) => sum + point.amount, 0);
  const average = total / points.length;
  const max = Math.max(1, ...recent.map((point) => point.amount));
  return (
    <div className="rounded-[15px] bg-primary-soft/45 p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-3">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">Saved in {periodLabel}</p><p className="mt-1 text-xl font-semibold tabular-nums text-primary">{currencyAmount(total, currency)}</p></div>
        <div className="border-l border-primary/15 pl-3"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Monthly average</p><p className="mt-1 text-xl font-semibold tabular-nums">{currencyAmount(average, currency)}</p></div>
      </div>
      <div className="mt-6 space-y-3.5" role="img" aria-label="Savings pace by month">
        {recent.map((point) => <div key={point.key} className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5"><span className="text-xs font-semibold text-muted-foreground">{point.label}</span><div className="h-3 overflow-hidden rounded-full bg-primary/10"><div className="h-full min-w-[4px] rounded-full bg-primary transition-[width]" style={{ width: `${point.amount ? Math.max(6, (point.amount / max) * 100) : 3}%` }} /></div><span className="min-w-[58px] text-right text-xs font-semibold tabular-nums text-primary">{currencyAmount(point.amount, currency)}</span></div>)}
      </div>
      {!total ? <p className="mt-5 rounded-[10px] border border-dashed border-primary/25 bg-background/50 px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">Your savings pace will appear here after your first savings transaction.</p> : null}
    </div>
  );
}

function RelatedTransactions({ transactions, currency }: { transactions: ApiTransaction[]; currency: string }) {
  if (!transactions.length) return <div className="rounded-[14px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Related transactions will appear here after you add one.</div>;
  return <div className="divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-card">{transactions.slice(0, 12).map((transaction) => { const Icon = getCategoryIcon(transaction.categoryIcon, transaction.categoryName ?? undefined); return <div key={transaction.id} className="flex items-center gap-3 px-3.5 py-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-[10px]" style={{ backgroundColor: transaction.categoryColor ?? "#e3eee9", color: getCategoryForeground(transaction.categoryColor) }}><Icon aria-hidden="true" className="size-[17px]" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{transaction.title || transaction.categoryName || "Transaction"}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{transaction.categoryName ?? "Uncategorized"} · {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${transaction.date}T12:00:00`))}</p></div><p className={`shrink-0 text-sm font-semibold tabular-nums ${transaction.type === "expense" ? "text-expense" : "text-income"}`}>{transaction.type === "expense" ? "−" : "+"}{currencyAmount(transaction.amount, currency)}</p></div>; })}</div>;
}

export function AnalyticsDetail({ type }: { type: AnalyticsType }) {
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [currency, setCurrency] = useState("NPR");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<AppliedPeriod>(() => {
    const now = new Date();
    return { mode: "last", label: "Last 12 months", from: new Date(now.getFullYear(), now.getMonth() - 11, 1), to: now };
  });
  const meta = pageMeta[type];
  const TypeIcon = meta.icon;
  const rangeLabel = period.label;
  const periodLabel = period.label.startsWith("Last ") ? period.label.slice(5) : period.label;

  useEffect(() => {
    let active = true;
    void Promise.all([authenticatedFetch("/api/transactions"), authenticatedFetch("/api/auth/me")]).then(async ([transactionsResponse, profileResponse]) => {
      if (!transactionsResponse.ok) throw new Error("Unable to load analytics");
      const result = await transactionsResponse.json() as { transactions?: ApiTransaction[] };
      const profile = profileResponse.ok ? await profileResponse.json() as { user?: { currency?: string } } : null;
      if (!active) return;
      setTransactions(result.transactions ?? []);
      setCurrency(profile?.user?.currency ?? "NPR");
    }).catch(() => { if (active) setError("We could not load this analytics section right now."); }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const analytics = useMemo(() => {
    const sourceType = type === "expenses" ? "expense" : type;
    const scopedTransactions = transactions.filter((transaction) => transaction.type === sourceType);
    const dates = scopedTransactions.map((transaction) => new Date(`${transaction.date}T12:00:00`)).sort((left, right) => left.getTime() - right.getTime());
    const now = new Date();
    const fallbackFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const from = period.mode === "all" ? dates[0] ?? fallbackFrom : period.from ?? fallbackFrom;
    const to = period.mode === "all" ? dates[dates.length - 1] ?? now : period.to ?? now;
    const periodStart = new Date(from);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(to);
    periodEnd.setHours(23, 59, 59, 999);
    const points = createMonthsBetween(from, to);
    const byMonth = new Map(points.map((point) => [point.key, point]));
    const related = transactions.filter((transaction) => {
      if (transaction.type !== sourceType) return false;
      const date = new Date(`${transaction.date}T12:00:00`);
      return date >= periodStart && date <= periodEnd;
    });
    const categoryTotals = new Map<string, number>();
    for (const transaction of related) {
      const key = transaction.date.slice(0, 7);
      const point = byMonth.get(key);
      if (point) point.amount += transaction.amount;
      if (type === "expenses") {
        const category = transaction.categoryName ?? "Uncategorized";
        categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + transaction.amount);
      }
    }
    const entries = [...categoryTotals.entries()].sort((left, right) => right[1] - left[1]);
    const slices = entries.slice(0, 6).map(([name, amount], index) => ({ name, amount, color: chartColors[index % chartColors.length] }));
    const other = entries.slice(6).reduce((sum, [, amount]) => sum + amount, 0);
    if (other) slices.push({ name: "Other", amount: other, color: chartColors[7] });
    const total = related.reduce((sum, transaction) => sum + transaction.amount, 0);
    return { points, related, slices, total };
  }, [period, transactions, type]);

  return (
    <main className="page-route-enter min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-10 sm:px-5">
        <header className="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-border bg-background/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:-mx-5 sm:px-5 sm:pt-7"><Link href="/" aria-label="Back to overview" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground hover:bg-surface-subtle"><ArrowLeft aria-hidden="true" className="size-5" /></Link><span className={`flex size-11 shrink-0 items-center justify-center rounded-[11px] ${meta.iconClassName}`}><TypeIcon aria-hidden="true" className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted-foreground">Analytics</p><h1 className="truncate text-[25px] font-semibold tracking-[-0.04em]">{meta.label}</h1></div><DatePicker initialMode="last" initialLabel={period.label} triggerLabel="Filter" onApply={(nextPeriod) => setPeriod(normalizePeriod(nextPeriod))} /></header>
        <section className="mt-7"><div className="min-w-0"><p className="text-sm font-medium text-muted-foreground">{rangeLabel}</p><h2 className="mt-3 text-[30px] font-semibold tracking-[-0.05em]">{meta.description}</h2></div><p className="mt-2 text-sm leading-6 text-muted-foreground">Explore the chart and the transactions behind this number.</p></section>
        {error ? <p role="alert" className="mt-5 rounded-[12px] border border-expense/25 bg-expense-soft px-4 py-3 text-sm font-medium text-expense">{error}</p> : null}
        {isLoading ? <div className="mt-6 space-y-3"><ListDataSkeleton rows={4} /></div> : <>
          <section className="mt-7 rounded-[16px] border border-border bg-card p-4 shadow-[0_12px_32px_rgb(23_32_29_/_0.06)] sm:p-5"><div className="flex items-start gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${meta.iconClassName}`}><TypeIcon aria-hidden="true" className="size-5" /></span><div><h2 className="text-base font-semibold">{meta.chartTitle}</h2><p className="mt-1 text-xs text-muted-foreground">{meta.chartDescription}</p></div></div><div className="mt-5">{type === "income" ? <TrendChart points={analytics.points} currency={currency} periodLabel={periodLabel} /> : type === "expenses" ? <ExpenseDonut slices={analytics.slices} currency={currency} /> : <SavingsBars points={analytics.points} currency={currency} periodLabel={periodLabel} />}</div></section>
          <section className="mt-5"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">{rangeLabel}</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">Related transactions</h2></div><p className={`text-sm font-semibold tabular-nums ${type === "expenses" ? "text-expense" : "text-income"}`}>{type === "expenses" ? "−" : "+"}{currencyAmount(analytics.total, currency)}</p></div><RelatedTransactions transactions={analytics.related} currency={currency} /></section>
        </>}
        <p className="mt-6 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground"><CalendarDays aria-hidden="true" className="size-3.5" />Based on your recorded transactions</p>
      </div>
    </main>
  );
}
