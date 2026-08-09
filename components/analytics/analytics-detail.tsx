"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, CalendarDays, Check, ChevronDown, Landmark, Store, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DatePicker, type AppliedPeriod } from "@/components/home/date-picker";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import type { ApiTransaction } from "@/components/transactions/transaction-list";
import { ListDataSkeleton } from "@/components/ui/data-skeleton";
import { authenticatedFetch } from "@/lib/auth-client";
import { getCategoryForeground, getCategoryIcon } from "@/lib/category-appearance";
import { addMoney, sumMoney } from "@/lib/money";
import { GuideIcon } from "@/components/guides/feature-guide";

export type AnalyticsType = "income" | "expenses" | "savings";

type MonthPoint = { key: string; label: string; amount: number };
type AnalyticsFilterOption = { value: string; label: string };
type AnalyticsFilterKind = "category" | "tag" | "merchant";
type ExpenseBreakdownKind = AnalyticsFilterKind;
// Keep adjacent warm slices clearly separated: red and amber should not read as one segment.
const chartColors = ["#b24b4b", "#b47718", "#735b8f", "#2f7d5a", "#a9512e", "#537fae", "#356b68", "#7b8f8e"];
const expenseBreakdownOptions: AnalyticsFilterOption[] = [
  { value: "category", label: "Categories" },
  { value: "tag", label: "Tags" },
  { value: "merchant", label: "Merchants" },
];

const pageMeta = {
  income: { label: "Income", description: "How much you earn each month", icon: ArrowDownLeft, iconClassName: "bg-income-soft text-income", chartTitle: "Monthly income", chartDescription: "Your earnings during this period" },
  expenses: { label: "Expenses", description: "Where your money goes", icon: ArrowUpRight, iconClassName: "bg-expense-soft text-expense", chartTitle: "Spending by category", chartDescription: "See how your spending was distributed during this period" },
  savings: { label: "Savings", description: "How much you set aside", icon: Landmark, iconClassName: "bg-primary-soft text-primary", chartTitle: "Monthly savings", chartDescription: "Your progress month by month" },
} as const;

function AnalyticsFilterDropdown({
  kind,
  label,
  value,
  options,
  open,
  accent = false,
  textOnly = false,
  onToggle,
  onSelect,
}: {
  kind: AnalyticsFilterKind;
  label: string;
  value: string;
  options: AnalyticsFilterOption[];
  open: boolean;
  accent?: boolean;
  textOnly?: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
}) {
  const Icon = textOnly ? null : kind === "tag" ? Tag : kind === "merchant" ? Store : null;
  const selectedLabel = options.find((option) => option.value === value)?.label;
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Filter by ${label.toLowerCase()}`}
        onClick={onToggle}
        className={`inline-flex items-center gap-1.5 rounded-[9px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${textOnly ? "h-auto p-0 text-base text-primary hover:text-primary-hover" : `min-h-9 border px-2.5 text-xs ${value || accent ? "border-primary/30 bg-primary-soft text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/35 hover:text-primary"}`}`}
      >
        {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
        <span className="max-w-32 truncate">{selectedLabel ?? label}</span>
        <ChevronDown aria-hidden="true" className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div role="listbox" aria-label={`${label} filter options`} className={`absolute top-[calc(100%+0.5rem)] z-30 max-h-64 w-56 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[12px] border border-border bg-card p-1.5 shadow-xl ${textOnly ? "right-0" : "left-0"}`}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value || `all-${kind}`}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(option.value)}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-[8px] px-3 text-left text-base font-semibold text-foreground transition-colors hover:bg-primary-soft focus-visible:bg-primary-soft focus-visible:outline-none"
              >
                <span className="truncate">{option.label}</span>
                {selected ? <Check aria-hidden="true" className="size-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

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
  const monthMatch = period.mode === "last" ? period.label.match(/^Last (?:(\d+) months?|month)$/) : null;
  if (!monthMatch) return period;
  const count = monthMatch[1] ? Number(monthMatch[1]) : 1;
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
  const chartLabel = periodLabel;
  const width = 360;
  const height = 260;
  const left = 42;
  const right = 12;
  const top = 42;
  const bottom = 38;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const max = Math.max(1, ...points.map((point) => point.amount));
  const coordinates = points.map((point, index) => ({
    x: left + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth),
    y: top + chartHeight - (point.amount / max) * chartHeight,
  }));
  const line = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const area = `${left},${top + chartHeight} ${line} ${left + chartWidth},${top + chartHeight}`;
  const latest = points[points.length - 1];
  return (
    <div className="rounded-[14px] bg-income-soft/45 p-3 sm:hidden">
      <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold text-income">{chartLabel}</p><p className="mt-0.5 text-[11px] text-muted-foreground">Monthly earnings</p></div><p className="text-right text-sm font-semibold tabular-nums text-income">{currency} {formatAmount(latest?.amount ?? 0)}<span className="block text-[10px] font-medium text-muted-foreground">latest month</span></p></div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-auto w-full" role="img" aria-label={`${chartLabel} income chart`}>
        {[0, 0.5, 1].map((ratio) => { const y = top + chartHeight * ratio; return <line key={ratio} x1={left} x2={width - right} y1={y} y2={y} stroke="currentColor" className="text-income/20" strokeDasharray="3 5" />; })}
        <text x={left - 8} y={top + 4} textAnchor="end" className="fill-income text-[12px]">{formatAmount(max)}</text>
        <text x={left - 8} y={top + chartHeight + 4} textAnchor="end" className="fill-muted-foreground text-[12px]">0</text>
        <polygon points={area} fill="#356b68" opacity="0.14" />
        <polyline points={line} fill="none" stroke="#356b68" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map(({ x, y }, index) => <g key={points[index].key}><circle cx={x} cy={y} r="6" fill="white" stroke="#356b68" strokeWidth="3" /><text x={x} y={y - 12} textAnchor="middle" className="fill-income text-[11px] font-semibold">{formatAmount(points[index].amount)}</text><text x={x} y={height - 10} textAnchor="middle" className="fill-muted-foreground text-[12px]">{points[index].label}</text></g>)}
      </svg>
    </div>
  );
}

type ExpenseSlice = {
  categoryId: string | null;
  name: string;
  amount: number;
  color: string;
};

function ExpenseDonut({ slices, currency, breakdown, expanded = false }: { slices: ExpenseSlice[]; currency: string; breakdown: ExpenseBreakdownKind; expanded?: boolean }) {
  const total = sumMoney(slices.map((slice) => slice.amount));
  let cursor = 0;
  const gradient = slices.length ? slices.map((slice) => { const start = cursor; cursor += (slice.amount / total) * 360; return `${slice.color} ${start}deg ${cursor}deg`; }).join(", ") : "#e7ece9 0deg 360deg";
  const returnTo = expanded ? "/analytics/details/expense/expand" : "/analytics/expenses";
  return (
    <div className="grid items-center gap-5 min-[420px]:grid-cols-[150px_1fr]">
      <div className="mx-auto grid size-44 place-items-center rounded-full min-[420px]:size-36" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label={`Expense ${breakdown} donut chart`}><div className="grid size-[110px] place-items-center rounded-full bg-card text-center min-[420px]:size-[92px]"><span><span className="block text-[11px] font-medium text-muted-foreground">Total spent</span><strong className="mt-1 block text-sm">{currencyAmount(total, currency)}</strong></span></div></div>
      <div className="space-y-1">{slices.length ? slices.map((slice) => {
        const content = <><span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} /><span className={`min-w-0 flex-1 font-medium ${expanded ? "break-words" : "truncate"} ${slice.categoryId ? "text-primary underline decoration-primary/35 underline-offset-4 group-hover:decoration-primary" : ""}`}>{slice.name}</span><span className="shrink-0 tabular-nums text-muted-foreground">{currencyAmount(slice.amount, currency)}</span></>;
        return slice.categoryId ? <Link key={slice.categoryId} href={{ pathname: `/categories/${slice.categoryId}`, query: { returnTo } }} aria-label={`View ${slice.name} category details`} className="group -mx-2 flex min-h-9 items-start gap-2 rounded-[8px] px-2 py-2 text-xs transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">{content}</Link> : <div key={slice.name} className="flex min-h-9 items-start gap-2 px-0 py-2 text-xs">{content}</div>;
      }) : <p className="text-sm text-muted-foreground">Expense {breakdown === "category" ? "categories" : breakdown === "tag" ? "tags" : "merchants"} will appear after you add transactions.</p>}</div>
    </div>
  );
}

function SavingsBars({ points, currency, periodLabel }: { points: MonthPoint[]; currency: string; periodLabel: string }) {
  const recent = points.length > 6 ? points.slice(-6) : points;
  const total = sumMoney(points.map((point) => point.amount));
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

function analyticsDateValue(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function analyticsDateLabel(date: string) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  if (date === dateKey(today)) return "Today";
  if (date === dateKey(yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(analyticsDateValue(date));
}

function RelatedTransactions({ transactions, currency, expanded = false }: { transactions: ApiTransaction[]; currency: string; expanded?: boolean }) {
  if (!transactions.length) return <div className="rounded-[14px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Related transactions will appear here after you add one.</div>;
  const visibleTransactions = expanded ? transactions : transactions.slice(0, 12);
  const groups = Array.from(visibleTransactions.reduce<Map<string, ApiTransaction[]>>((result, transaction) => {
    result.set(transaction.date, [...(result.get(transaction.date) ?? []), transaction]);
    return result;
  }, new Map()));
  return <div className="space-y-7">{groups.map(([date, items]) => <section key={date} aria-labelledby={`analytics-transaction-group-${date}`}><div className="px-1"><h3 id={`analytics-transaction-group-${date}`} className="text-[15px] font-semibold">{analyticsDateLabel(date)}</h3></div><div className="mt-3 divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-card">{items.map((transaction) => { const primarySplit = transaction.splits[0]; const Icon = getCategoryIcon(transaction.categoryIcon ?? primarySplit?.categoryIcon, transaction.categoryName ?? primarySplit?.categoryName); const categoryLabel = transaction.splits.length ? `${transaction.splits.length} categories` : transaction.categoryName ?? "Uncategorized"; const categoryColor = transaction.categoryColor ?? primarySplit?.categoryColor; return <div key={transaction.id} className="flex items-center gap-3 px-3.5 py-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-[10px]" style={{ backgroundColor: categoryColor ?? "#e3eee9", color: getCategoryForeground(categoryColor) }}><Icon aria-hidden="true" className="size-[17px]" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{transaction.title || transaction.categoryName || "Transaction"}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{categoryLabel}</p></div><p className={`shrink-0 text-sm font-semibold tabular-nums ${transaction.type === "expense" ? "text-expense" : "text-income"}`}>{transaction.type === "expense" ? "−" : "+"}{currencyAmount(transaction.amount, currency)}</p></div>; })}</div></section>)}</div>;
}

export function AnalyticsDetail({ type, expanded = false }: { type: AnalyticsType; expanded?: boolean }) {
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [currency, setCurrency] = useState("NPR");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdownKind>("category");
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [period, setPeriod] = useState<AppliedPeriod>(() => {
    const now = new Date();
    return { mode: "month", label: "This month", from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  });
  const meta = pageMeta[type];
  const TypeIcon = meta.icon;
  const rangeLabel = period.label;
  const periodLabel = period.label.startsWith("Last ") ? period.label.slice(5) : period.label;

  useEffect(() => {
    let active = true;
    void authenticatedFetch("/api/auth/me").then(async (profileResponse) => {
      const profile = profileResponse.ok ? await profileResponse.json() as { user?: { currency?: string } } : null;
      if (!active) return;
      setCurrency(profile?.user?.currency ?? "NPR");
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void authenticatedFetch("/api/transactions")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load analytics");
        const result = await response.json() as { transactions?: ApiTransaction[] };
        if (active) setTransactions(result.transactions ?? []);
      })
      .catch(() => { if (active) setError("We could not load this analytics section right now."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [type]);

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
    const breakdownTotals = new Map<string, { categoryId: string | null; name: string; amount: number }>();
    const addBreakdownTotal = (categoryId: string | null, name: string, amount: number) => {
      const normalizedName = name.trim() || "Other";
      const key = categoryId ?? `uncategorized:${normalizedName.toLocaleLowerCase()}`;
      const current = breakdownTotals.get(key);
      breakdownTotals.set(key, { categoryId, name: current?.name ?? normalizedName, amount: addMoney(current?.amount ?? 0, amount) });
    };
    for (const transaction of related) {
      const key = transaction.date.slice(0, 7);
      const point = byMonth.get(key);
      if (point) point.amount = addMoney(point.amount, transaction.amount);
      if (type === "expenses") {
        if (expenseBreakdown === "merchant") {
          addBreakdownTotal(null, transaction.merchantName?.trim() || "Other", transaction.amount);
        } else if (expenseBreakdown === "tag") {
          const tags = (transaction.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
          if (tags.length) {
            const sharedAmount = transaction.amount / tags.length;
            for (const tag of tags) addBreakdownTotal(null, tag, sharedAmount);
          } else {
            addBreakdownTotal(null, "Other", transaction.amount);
          }
        } else if (transaction.splits.length) {
          for (const split of transaction.splits) {
            addBreakdownTotal(split.categoryId, split.categoryName, split.amount);
          }
        } else {
          addBreakdownTotal(transaction.categoryId, transaction.categoryName ?? "Uncategorized", transaction.amount);
        }
      }
    }
    const entries = [...breakdownTotals.values()].sort((left, right) => right.amount - left.amount);
    const slices: ExpenseSlice[] = entries.map((entry, index) => ({ ...entry, color: chartColors[index % chartColors.length] }));
    const total = sumMoney(related.map((transaction) => transaction.amount));
    return { points, related, slices, total };
  }, [expenseBreakdown, period, transactions, type]);

  return (
    <main className="page-route-enter min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-10 sm:px-5">
        <StickyPageHeader className="-mx-4 !z-30 flex items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5 sm:pt-7"><Link href={expanded ? "/analytics/expenses" : "/"} aria-label={expanded ? "Back to expenses analytics" : "Back to overview"} className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card/90 text-foreground hover:bg-surface-subtle"><ArrowLeft aria-hidden="true" className="size-5" /></Link><div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted-foreground">Analytics</p><h1 className="truncate text-[25px] font-semibold tracking-[-0.04em]">{meta.label}</h1></div><GuideIcon href={`/analytics/guide?returnTo=${encodeURIComponent(`/analytics/${type}`)}`} label="Analytics" /><DatePicker initialMode="month" initialLabel={period.label} triggerLabel="Filter" onApply={(nextPeriod) => setPeriod(normalizePeriod(nextPeriod))} /></StickyPageHeader>
        <section className="mt-7"><div className="min-w-0"><p className="text-sm font-medium text-muted-foreground">{rangeLabel}</p><h2 className="mt-3 text-[30px] font-semibold tracking-[-0.05em]">{meta.description}</h2></div></section>
        {error ? <p role="alert" className="mt-5 rounded-[12px] border border-expense/25 bg-expense-soft px-4 py-3 text-sm font-medium text-expense">{error}</p> : null}
        {isLoading ? <div className="mt-6 space-y-3"><ListDataSkeleton rows={4} /></div> : <>
          <section className="mt-7 rounded-[16px] border border-border bg-card p-4 shadow-[0_12px_32px_rgb(23_32_29_/_0.06)] sm:p-5"><div className="flex items-start gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${meta.iconClassName}`}><TypeIcon aria-hidden="true" className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex items-center">{type === "expenses" ? <h2 className="flex items-baseline gap-1.5 whitespace-nowrap text-base font-semibold"><span>Spending by</span><AnalyticsFilterDropdown kind={expenseBreakdown} label="Breakdown" value={expenseBreakdown} options={expenseBreakdownOptions} open={breakdownOpen} textOnly onToggle={() => setBreakdownOpen((current) => !current)} onSelect={(value) => { setExpenseBreakdown(value as ExpenseBreakdownKind); setBreakdownOpen(false); }} /></h2> : <h2 className="text-base font-semibold">{meta.chartTitle}</h2>}</div><p className="mt-1 text-xs text-muted-foreground">{meta.chartDescription}</p></div></div><div className="mt-5">{type === "income" ? <TrendChart points={analytics.points} currency={currency} periodLabel={periodLabel} /> : type === "expenses" ? <ExpenseDonut slices={analytics.slices} currency={currency} breakdown={expenseBreakdown} expanded={expanded} /> : <SavingsBars points={analytics.points} currency={currency} periodLabel={periodLabel} />}</div></section>
          <section className="mt-5"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">{rangeLabel}</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">Related transactions</h2></div><div className="flex items-center gap-3">{!expanded && type === "expenses" && analytics.related.length > 12 ? <Link href="/analytics/details/expense/expand" className="text-xs font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">See all</Link> : null}<p className={`text-sm font-semibold tabular-nums ${type === "expenses" ? "text-expense" : "text-income"}`}>{type === "expenses" ? "−" : "+"}{currencyAmount(analytics.total, currency)}</p></div></div><RelatedTransactions transactions={analytics.related} currency={currency} expanded={expanded} /></section>
        </>}
        <p className="mt-6 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground"><CalendarDays aria-hidden="true" className="size-3.5" />Based on your recorded transactions</p>
      </div>
    </main>
  );
}
