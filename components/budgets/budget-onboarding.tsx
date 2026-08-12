"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SelectHTMLAttributes } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeDollarSign, Check, ChevronDown, CircleDollarSign, Plus, ReceiptText, Search, ShieldCheck, Sparkles, Target, Trash2, TrendingUp, WalletCards } from "lucide-react";

import { LunaLoader } from "@/components/ui/luna-loader";
import { authenticatedFetch, loginPathFor, safeReturnPath } from "@/lib/auth-client";
import { formatCurrencyAmount } from "@/lib/currency";
import { BUDGET_INCOME_INTERVAL_LABELS, monthlyIncomeEstimate, type BudgetCategory, type BudgetIncomeInterval, type BudgetOnboardingStatus } from "@/lib/budgets";
import { getCategoryIcon } from "@/lib/category-appearance";

type IncomeDraft = {
  id: string;
  name: string;
  amount: string;
  interval: BudgetIncomeInterval;
  categoryId: string;
};

type Props = { initialReturnTo?: string };

const INTERVALS = Object.entries(BUDGET_INCOME_INTERVAL_LABELS) as Array<[BudgetIncomeInterval, string]>;
const EMPTY_SOURCE = (): IncomeDraft => ({ id: crypto.randomUUID(), name: "", amount: "", interval: "monthly", categoryId: "" });
const SELECT_CLASS = "min-h-11 w-full appearance-none rounded-[12px] border border-border bg-background px-3.5 pr-10 text-sm font-medium text-foreground shadow-[0_4px_12px_rgb(23_32_29_/_0.04)] outline-none transition-[border-color,box-shadow,background-color] hover:border-primary/35 hover:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10";

function BudgetSelect({ children, className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <div className="relative"><select {...props} className={`${SELECT_CLASS} ${className}`}>{children}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /></div>;
}

function money(value: number, currency: string) {
  return `${currency} ${formatCurrencyAmount(value)}`;
}

function defaultBucket(name: string) {
  return /home|housing|rent|food|grocer|transport|vehicle|health|education|electric|water|internet|family|loan/i.test(name) ? "needs" : "wants";
}

function IntroStep({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-12 size-80 rounded-full bg-[#D7A34E]/12 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-28 bottom-20 size-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-5 py-5 sm:px-10 sm:py-8">
        <header className="flex items-center justify-between"><span className="text-sm font-bold tracking-[-0.03em] text-primary">Luna</span><button type="button" onClick={onCancel} className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-card hover:text-foreground">Cancel</button></header>
        <div className="relative z-10 flex flex-1 flex-col justify-center gap-10 py-12 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
          <section className="max-w-[520px]">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-primary"><Sparkles aria-hidden="true" className="size-3.5" /> A calmer money plan</span>
            <h1 className="mt-5 text-[42px] font-semibold leading-[0.98] tracking-[-0.065em] sm:text-[64px]">Give your money a place to go.</h1>
            <p className="mt-5 max-w-[470px] text-base leading-7 text-muted-foreground sm:text-lg">A budget is not a restriction. It is a gentle plan for what matters before the month gets busy.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[{ icon: TrendingUp, title: "See the whole picture", text: "Estimate income and compare it with real deposits." }, { icon: Target, title: "Plan with intention", text: "Give everyday categories a comfortable limit." }, { icon: ShieldCheck, title: "Stay flexible", text: "Adjust your plan when real life changes." }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-[18px] border border-border bg-card/80 p-3.5 shadow-sm backdrop-blur-sm"><span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary"><Icon aria-hidden="true" className="size-[18px]" /></span><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>)}
            </div>
          </section>
          <div className="relative mx-auto h-[270px] w-full max-w-[500px] sm:h-[360px]" role="img" aria-label="Illustration of a calm monthly budget">
            <div aria-hidden="true" className="absolute left-[8%] top-[14%] size-24 rotate-[-12deg] rounded-[28px] bg-[#D98E64] shadow-[0_20px_35px_rgb(217_142_100_/_0.26)] sm:size-28" />
            <div aria-hidden="true" className="absolute right-[8%] top-[2%] grid size-16 rotate-[12deg] place-items-center rounded-2xl bg-[#7D8DC4] text-white shadow-[0_17px_30px_rgb(125_141_196_/_0.3)]"><BadgeDollarSign className="size-8" /></div>
            <div aria-hidden="true" className="absolute left-[16%] top-[24%] size-56 rounded-full bg-primary-soft/80 blur-3xl" />
            <div className="absolute left-[10%] top-[23%] w-[80%] rotate-[-5deg] rounded-[30px] border border-border bg-card/90 p-5 shadow-[0_26px_60px_rgb(23_32_29_/_0.13)] backdrop-blur-sm sm:left-[14%] sm:w-[72%] sm:p-6">
              <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Monthly plan</p><p className="mt-1 text-3xl font-semibold tracking-[-0.06em]">NPR 95,000</p></div><span className="grid size-11 place-items-center rounded-2xl bg-income-soft text-income"><CircleDollarSign className="size-5" /></span></div>
              <div className="mt-7 space-y-3"><div><div className="mb-1 flex justify-between text-xs font-semibold"><span>Essentials</span><span className="text-muted-foreground">50%</span></div><div className="h-3 rounded-full bg-surface-subtle"><div className="h-full w-1/2 rounded-full bg-primary" /></div></div><div><div className="mb-1 flex justify-between text-xs font-semibold"><span>Wants</span><span className="text-muted-foreground">30%</span></div><div className="h-3 rounded-full bg-surface-subtle"><div className="h-full w-[30%] rounded-full bg-[#D7A34E]" /></div></div><div><div className="mb-1 flex justify-between text-xs font-semibold"><span>Savings</span><span className="text-muted-foreground">20%</span></div><div className="h-3 rounded-full bg-surface-subtle"><div className="h-full w-1/5 rounded-full bg-income" /></div></div></div>
            </div>
            <div className="absolute bottom-[3%] left-[2%] flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 text-xs font-bold shadow-[0_16px_30px_rgb(23_32_29_/_0.1)]"><span className="grid size-8 place-items-center rounded-xl bg-income-soft text-income"><ReceiptText className="size-4" /></span>Every rupee has a job</div>
            <div className="absolute bottom-[0%] right-[2%] flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 text-xs font-bold shadow-[0_16px_30px_rgb(23_32_29_/_0.1)]"><span className="grid size-8 place-items-center rounded-xl bg-primary-soft text-primary"><WalletCards className="size-4" /></span>Flexible by design</div>
          </div>
        </div>
        <footer className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between sm:pt-6"><p className="text-xs leading-5 text-muted-foreground">You can cancel at any point. Your plan is saved only when you start budgeting.</p><button type="button" onClick={onContinue} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_rgb(53_107_104_/_0.15)] transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">Build my plan <ArrowRight aria-hidden="true" className="size-4" /></button></footer>
      </div>
    </div>
  );
}

function StepHeader({ step, onCancel }: { step: number; onCancel: () => void }) {
  return <header><div className="flex items-center justify-between text-sm font-semibold"><span className="text-primary">Luna</span><button type="button" onClick={onCancel} className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-surface-subtle">Cancel</button></div><div className="mt-4 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Budget setup</span><span className="text-xs font-semibold text-muted-foreground">{step} of 2</span></div><div className="mt-3 grid grid-cols-2 gap-2" role="progressbar" aria-label={`Budget setup step ${step} of 2`} aria-valuemin={1} aria-valuemax={2} aria-valuenow={step}>{[1, 2].map((segment) => <span key={segment} className={`h-1.5 rounded-full transition-colors ${segment <= step ? "bg-primary" : "bg-primary-soft"}`} />)}</div></header>;
}

function IncomeStep({ sources, incomeCategories, status, currency, onChange, onAdd, onRemove, onNext, onBack, error }: { sources: IncomeDraft[]; incomeCategories: BudgetCategory[]; status: BudgetOnboardingStatus; currency: string; onChange: (id: string, patch: Partial<IncomeDraft>) => void; onAdd: () => void; onRemove: (id: string) => void; onNext: () => void; onBack: () => void; error: string }) {
  const estimated = sources.reduce((total, source) => addAmount(total, Number(source.amount) > 0 ? monthlyIncomeEstimate(Number(source.amount), source.interval) : 0), 0);
  return <section className="mx-auto w-full max-w-[680px]"><div className="max-w-[560px]"><p className="text-sm font-semibold text-primary">Step 1</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">What usually comes in?</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Use estimates for planning, not promises. Your actual income will always come from the transactions you record.</p></div><div className="mt-6 rounded-[17px] border border-primary/20 bg-primary-soft/45 p-4"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-primary"><TrendingUp className="size-5" /></span><div><p className="text-sm font-semibold">Estimated monthly income</p><p className="mt-1 text-2xl font-semibold tabular-nums">{money(estimated, currency)}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Normalized from the intervals below. Actual this month: <strong className="text-foreground">{money(status.income.actualThisMonth, currency)}</strong></p></div></div></div><div className="mt-5 space-y-3">{sources.map((source, index) => <div key={source.id} className="rounded-[16px] border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Income source {index + 1}</p>{sources.length > 1 ? <button type="button" onClick={() => onRemove(source.id)} aria-label={`Remove income source ${index + 1}`} className="rounded-full p-2 text-muted-foreground hover:bg-expense-soft hover:text-expense"><Trash2 className="size-4" /></button> : null}</div><div className="mt-3 grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr]"><label className="block"><span className="sr-only">Income source name</span><input value={source.name} onChange={(event) => onChange(source.id, { name: event.target.value })} placeholder="Name, e.g. Salary" className="min-h-11 w-full rounded-[11px] border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></label><label className="block"><span className="sr-only">Income amount</span><input value={source.amount} onChange={(event) => onChange(source.id, { amount: event.target.value })} inputMode="decimal" placeholder="Amount" className="min-h-11 w-full rounded-[11px] border border-border bg-background px-3 text-sm tabular-nums outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></label><label className="block"><span className="sr-only">Income interval</span><BudgetSelect value={source.interval} onChange={(event) => onChange(source.id, { interval: event.target.value as BudgetIncomeInterval })}>{INTERVALS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</BudgetSelect></label></div><label className="mt-2 block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">Match actual income to a category <span className="text-foreground-subtle">(optional)</span></span><BudgetSelect value={source.categoryId} onChange={(event) => onChange(source.id, { categoryId: event.target.value })}><option value="">No category match</option>{incomeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</BudgetSelect></label></div>)}</div><button type="button" onClick={onAdd} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-[11px] bg-primary-soft px-3.5 text-sm font-semibold text-primary hover:bg-primary-soft/70"><Plus className="size-4" /> Add another source</button>{error ? <p role="alert" className="mt-4 rounded-[12px] border border-expense/20 bg-expense-soft px-3 py-2.5 text-sm text-expense">{error}</p> : null}<div className="mt-8 flex items-center justify-between gap-3"><button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-[11px] px-3 text-sm font-semibold text-muted-foreground hover:bg-surface-subtle"><ArrowLeft className="size-4" /> Back</button><button type="button" onClick={onNext} className="inline-flex min-h-11 items-center gap-2 rounded-[11px] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">Continue <ArrowRight className="size-4" /></button></div></section>;
}

function addAmount(left: number, right: number) {
  return Math.round((left + right) * 100) / 100;
}

function CategoriesStep({ sources, categories, currency, allocations, buckets, savingsTarget, onAmountChange, onBucketChange, onSavingsChange, onPrefill, onBack, onStart, saving, error }: { sources: IncomeDraft[]; categories: BudgetCategory[]; currency: string; allocations: Record<string, string>; buckets: Record<string, "needs" | "wants">; savingsTarget: string; onAmountChange: (id: string, value: string) => void; onBucketChange: (id: string, bucket: "needs" | "wants") => void; onSavingsChange: (value: string) => void; onPrefill: () => void; onBack: () => void; onStart: () => void; saving: boolean; error: string }) {
  const estimatedMonthly = sources.reduce((total, source) => addAmount(total, Number(source.amount) > 0 ? monthlyIncomeEstimate(Number(source.amount), source.interval) : 0), 0);
  const allocated = Object.values(allocations).reduce((total, value) => addAmount(total, Number(value) > 0 ? Number(value) : 0), 0);
  const savings = Number(savingsTarget) > 0 ? Number(savingsTarget) : 0;
  const unallocated = estimatedMonthly - allocated - savings;
  const [categorySearch, setCategorySearch] = useState("");
  const visibleCategories = categories.filter((category) => {
    const query = categorySearch.trim().toLocaleLowerCase();
    return !query || category.name.toLocaleLowerCase().includes(query) || (category.icon ?? "").toLocaleLowerCase().includes(query);
  });
  return <section className="mx-auto w-full max-w-[720px]"><div className="max-w-[600px]"><p className="text-sm font-semibold text-primary">Step 2</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Give your spending a place to land.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Choose a comfortable monthly amount for the categories you care about. Anything you do not allocate stays visible as unallocated money.</p></div><div className="mt-6 grid grid-cols-3 gap-2 rounded-[16px] border border-border bg-card p-3 text-xs"><div><p className="text-muted-foreground">Estimated income</p><p className="mt-1 font-semibold tabular-nums">{money(estimatedMonthly, currency)}</p></div><div><p className="text-muted-foreground">Allocated</p><p className="mt-1 font-semibold tabular-nums">{money(allocated + savings, currency)}</p></div><div><p className="text-muted-foreground">Unallocated</p><p className={`mt-1 font-semibold tabular-nums ${unallocated < 0 ? "text-expense" : "text-primary"}`}>{money(Math.abs(unallocated), currency)}{unallocated < 0 ? " over" : ""}</p></div></div><div className="mt-5 rounded-[16px] border border-primary/20 bg-primary-soft/35 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Want a simple starting point?</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Prefill 50% needs, 30% wants, and a 20% savings target. You can edit every amount.</p></div><button type="button" onClick={onPrefill} className="inline-flex min-h-10 items-center gap-2 rounded-[11px] bg-primary px-3.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"><Sparkles className="size-3.5" /> Use 50/30/20</button></div></div><label className="mt-5 flex min-h-11 items-center gap-2 rounded-[12px] border border-border bg-card px-3 text-muted-foreground focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10"><Search aria-hidden="true" className="size-4 shrink-0" /><span className="sr-only">Search categories or icons</span><input value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Search categories or icons" aria-label="Search categories or icons" className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground" /></label><div className="mt-3 space-y-2">{visibleCategories.map((category) => <div key={category.id} className="rounded-[14px] border border-border bg-card px-3 py-2.5"><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-subtle text-primary">{(() => { const Icon = getCategoryIcon(category.icon, category.name); return <Icon aria-hidden="true" className="size-4" />; })()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{category.name}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{category.icon ?? "Category icon"}</p><div className="mt-1 flex gap-1"><button type="button" onClick={() => onBucketChange(category.id, "needs")} aria-pressed={buckets[category.id] === "needs"} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${buckets[category.id] === "needs" ? "bg-primary text-primary-foreground" : "bg-surface-subtle text-muted-foreground"}`}>Needs</button><button type="button" onClick={() => onBucketChange(category.id, "wants")} aria-pressed={buckets[category.id] === "wants"} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${buckets[category.id] === "wants" ? "bg-[#D7A34E] text-white" : "bg-surface-subtle text-muted-foreground"}`}>Wants</button></div></div><label className="flex w-[125px] shrink-0 items-center gap-2"><span className="sr-only">Monthly amount for {category.name}</span><span className="text-xs text-muted-foreground">{currency}</span><input value={allocations[category.id] ?? ""} onChange={(event) => onAmountChange(category.id, event.target.value)} inputMode="decimal" placeholder="0" className="min-h-10 w-full rounded-[10px] border border-border bg-background px-2 text-right text-sm tabular-nums outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></label></div></div>)}</div>{categories.length > 0 && !visibleCategories.length ? <div className="mt-3 rounded-[14px] border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">No matching categories or icons.</div> : null}{!categories.length ? <div className="rounded-[14px] border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Add an expense category before starting your budget.</div> : null}<div className="mt-4 rounded-[14px] border border-border bg-card p-3.5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-income-soft text-income"><Target className="size-4" /></span><div className="flex-1"><p className="text-sm font-semibold">Savings target <span className="text-xs font-normal text-muted-foreground">(optional)</span></p><p className="mt-1 text-xs text-muted-foreground">Keep a little room for the future.</p></div><label className="flex w-[125px] items-center gap-2"><span className="text-xs text-muted-foreground">{currency}</span><input value={savingsTarget} onChange={(event) => onSavingsChange(event.target.value)} inputMode="decimal" placeholder="0" aria-label="Monthly savings target" className="min-h-10 w-full rounded-[10px] border border-border bg-background px-2 text-right text-sm tabular-nums outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></label></div></div>{error ? <p role="alert" className="mt-4 rounded-[12px] border border-expense/20 bg-expense-soft px-3 py-2.5 text-sm text-expense">{error}</p> : null}<div className="mt-8 flex items-center justify-between gap-3"><button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-[11px] px-3 text-sm font-semibold text-muted-foreground hover:bg-surface-subtle"><ArrowLeft className="size-4" /> Back</button><button type="button" onClick={onStart} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-[11px] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60">{saving ? "Starting…" : "Start budgeting"} <Check className="size-4" /></button></div></section>;
}

export function BudgetOnboarding({ initialReturnTo = "/" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get("returnTo") ?? initialReturnTo);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<BudgetOnboardingStatus | null>(null);
  const [sources, setSources] = useState<IncomeDraft[]>([EMPTY_SOURCE()]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [buckets, setBuckets] = useState<Record<string, "needs" | "wants">>({});
  const [savingsTarget, setSavingsTarget] = useState("");
  const [currency, setCurrency] = useState("NPR");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void authenticatedFetch("/api/budgets/onboarding").then(async (response) => {
      if (!response.ok) { if (response.status === 401) router.replace(loginPathFor("/budgets/onboarding")); else if (active) setError("Budget setup could not be loaded. Try again."); return; }
      const result = await response.json() as BudgetOnboardingStatus;
      if (!active) return;
      if (result.completed) { router.replace(returnTo === "/" ? "/budgets" : returnTo); return; }
      setStatus(result);
      setCurrency(result.currency);
      setSources(result.income.sources.length ? result.income.sources.map((source) => ({ id: source.id, name: source.name, amount: String(source.amount), interval: source.interval, categoryId: source.categoryId ?? "" })) : [EMPTY_SOURCE()]);
      setAllocations(Object.fromEntries(result.expenseCategories.map((category) => [category.id, ""])));
    }).catch(() => { if (active) setError("Budget setup could not be loaded. Try again."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [returnTo, router]);

  const estimatedMonthly = useMemo(() => sources.reduce((total, source) => addAmount(total, Number(source.amount) > 0 ? monthlyIncomeEstimate(Number(source.amount), source.interval) : 0), 0), [sources]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
      contentRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  function cancel() { router.replace(returnTo); }
  function updateSource(id: string, patch: Partial<IncomeDraft>) { setSources((current) => current.map((source) => source.id === id ? { ...source, ...patch } : source)); }
  function prefill() {
    const nextBuckets = Object.fromEntries((status?.expenseCategories ?? []).map((category) => [category.id, defaultBucket(category.name)])) as Record<string, "needs" | "wants">;
    const needs = (status?.expenseCategories ?? []).filter((category) => nextBuckets[category.id] === "needs");
    const wants = (status?.expenseCategories ?? []).filter((category) => nextBuckets[category.id] === "wants");
    const nextAllocations: Record<string, string> = {};
    for (const category of needs) nextAllocations[category.id] = String(Math.round((estimatedMonthly * 0.5 / needs.length) * 100) / 100);
    for (const category of wants) nextAllocations[category.id] = String(Math.round((estimatedMonthly * 0.3 / wants.length) * 100) / 100);
    setBuckets(nextBuckets); setAllocations(nextAllocations); setSavingsTarget(String(Math.round(estimatedMonthly * 0.2 * 100) / 100)); setError("");
  }
  function nextFromIncome() {
    const valid = sources.every((source) => source.name.trim() && Number(source.amount) > 0 && Number.isFinite(Number(source.amount)));
    if (!valid) { setError("Add a name and positive amount for every income source."); return; }
    setError(""); setStep(2);
  }
  async function startBudgeting() {
    const payloadAllocations: Array<{ categoryId: string | null; kind: "expense" | "savings"; amount: number }> = Object.entries(allocations).filter(([, value]) => Number(value) > 0 && Number.isFinite(Number(value))).map(([categoryId, amount]) => ({ categoryId, kind: "expense" as const, amount: Number(amount) }));
    if (Number(savingsTarget) > 0) payloadAllocations.push({ categoryId: null, kind: "savings", amount: Number(savingsTarget) });
    if (!payloadAllocations.some((allocation) => allocation.kind === "expense")) { setError("Add at least one category amount before starting."); return; }
    setSaving(true); setError("");
    try {
      const response = await authenticatedFetch("/api/budgets/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ incomeSources: sources.map((source) => ({ name: source.name.trim(), amount: Number(source.amount), interval: source.interval, categoryId: source.categoryId || null })), allocations: payloadAllocations }) });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to start your budget.");
      router.replace("/budgets");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to start your budget."); setSaving(false); }
  }

  if (loading || !status) return error ? <main className="grid min-h-dvh place-items-center bg-background px-5 text-center"><section className="max-w-sm"><h1 className="text-lg font-semibold">Budget setup unavailable</h1><p role="alert" className="mt-2 text-sm leading-6 text-expense">{error}</p><button type="button" onClick={() => window.location.reload()} className="mt-5 min-h-11 rounded-[12px] bg-primary px-5 text-sm font-semibold text-primary-foreground">Try again</button></section></main> : <LunaLoader label="Preparing budget setup" />;
  if (step === 0) return <IntroStep onContinue={() => setStep(1)} onCancel={cancel} />;
  return <main className="min-h-dvh bg-background px-4 py-5 sm:px-6 sm:py-8"><div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-[760px] flex-col"><StepHeader step={step} onCancel={cancel} /><div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto py-8">{step === 1 ? <IncomeStep sources={sources} incomeCategories={status.incomeCategories} status={status} currency={currency} onChange={updateSource} onAdd={() => setSources((current) => [...current, EMPTY_SOURCE()])} onRemove={(id) => setSources((current) => current.filter((source) => source.id !== id))} onNext={nextFromIncome} onBack={() => setStep(0)} error={error} /> : <CategoriesStep sources={sources} categories={status.expenseCategories} currency={currency} allocations={allocations} buckets={buckets} savingsTarget={savingsTarget} onAmountChange={(id, value) => setAllocations((current) => ({ ...current, [id]: value }))} onBucketChange={(id, bucket) => setBuckets((current) => ({ ...current, [id]: bucket }))} onSavingsChange={setSavingsTarget} onPrefill={prefill} onBack={() => { setError(""); setStep(1); }} onStart={() => void startBudgeting()} saving={saving} error={error} />}</div></div></main>;
}
