"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarRange, Check, ChevronRight, Gauge, Plus, Search, Tags, Trash2, WalletCards, X } from "lucide-react";

import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { MoneyEditor } from "@/components/money/money-editor";
import { ListDataSkeleton } from "@/components/ui/data-skeleton";
import { authenticatedFetch } from "@/lib/auth-client";
import type { Budget, BudgetPeriod } from "@/lib/budgets";
import { getCategoryForeground, getCategoryIcon } from "@/lib/category-appearance";
import { formatCurrencyAmount } from "@/lib/currency";
import { useOfflineSnapshot } from "@/lib/offline/use-offline-snapshot";
import { queueOfflineBudgetCreate, queueOfflineBudgetDelete, queueOfflineBudgetUpdate } from "@/lib/offline/sync";

type Category = { id: string; name: string; type: "expense" | "income"; icon: string | null; color: string | null };
type EditorDraft = { budget: Budget | null; scope: "overall" | "category"; categoryId: string | null; period: BudgetPeriod; amount: string };
const PERIODS: Array<{ value: BudgetPeriod; label: string }> = [{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }];

function tone(percentage: number) {
  if (percentage >= 100) return { bar: "bg-expense", text: "text-expense", soft: "bg-expense-soft" };
  if (percentage >= 80) return { bar: "bg-warning", text: "text-warning-foreground", soft: "bg-warning-soft" };
  return { bar: "bg-primary", text: "text-primary", soft: "bg-primary-soft" };
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function BudgetCard({ budget, currency, onEdit }: { budget: Budget; currency: string; onEdit: () => void }) {
  const colors = tone(budget.percentage);
  const over = budget.remaining < 0;
  return (
    <button type="button" onClick={onEdit} className="w-full rounded-[16px] border border-border bg-card p-4 text-left shadow-[0_8px_24px_rgb(23_32_29_/_0.04)] transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
      <div className="flex items-start gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-[11px] ${colors.soft} ${colors.text}`}>
          {budget.categoryId ? <Tags aria-hidden="true" className="size-[18px]" /> : <WalletCards aria-hidden="true" className="size-[18px]" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h2 className="truncate text-sm font-semibold">{budget.name}</h2><p className="mt-1 text-[11px] text-muted-foreground">{dateLabel(budget.periodStart)} – {dateLabel(budget.periodEnd)}</p></div>
            <span className={`shrink-0 text-sm font-semibold tabular-nums ${colors.text}`}>{budget.percentage}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-subtle"><div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${Math.min(100, Math.max(0, budget.percentage))}%` }} /></div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <div><p className="text-muted-foreground">Limit</p><p className="mt-0.5 font-semibold tabular-nums">{currency} {formatCurrencyAmount(budget.limitAmount)}</p></div>
            <div><p className="text-muted-foreground">Spent</p><p className="mt-0.5 font-semibold tabular-nums">{currency} {formatCurrencyAmount(budget.spent)}</p></div>
            <div className="text-right"><p className="text-muted-foreground">{over ? "Over" : "Remaining"}</p><p className={`mt-0.5 font-semibold tabular-nums ${over ? "text-expense" : ""}`}>{currency} {formatCurrencyAmount(Math.abs(budget.remaining))}</p></div>
          </div>
        </div>
        <ChevronRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-foreground-subtle" />
      </div>
    </button>
  );
}

function CategoryPicker({ categories, selectedId, search, onSearchChange, onClose, onSelect }: {
  categories: Category[];
  selectedId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  onSelect: (category: Category) => void;
}) {
  if (typeof document === "undefined") return null;
  const query = search.trim().toLocaleLowerCase();
  const filtered = categories.filter((category) => category.name.toLocaleLowerCase().includes(query));

  return createPortal((
    <div className="drawer-scrim-enter fixed inset-0 z-[80] flex items-end bg-foreground/25 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="budget-category-picker-title" className="drawer-enter flex h-[min(82dvh,640px)] w-full flex-col overflow-hidden rounded-t-[18px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgb(23_32_29_/_0.14)]">
        <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col">
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-foreground/15" aria-hidden="true" />
          <header className="grid shrink-0 grid-cols-[44px_1fr_44px] items-center">
            <button type="button" aria-label="Close category picker" onClick={onClose} className="flex size-11 items-center justify-center rounded-[10px] text-expense hover:bg-expense-soft">
              <X aria-hidden="true" className="size-5" />
            </button>
            <h2 id="budget-category-picker-title" className="text-center text-[17px] font-semibold">Choose category</h2>
            <span />
          </header>
          <label className="mt-3 flex min-h-11 shrink-0 items-center gap-2 rounded-[12px] border border-border bg-card px-3 text-muted-foreground focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
            <Search aria-hidden="true" className="size-4 shrink-0" />
            <span className="sr-only">Search expense categories</span>
            <input autoFocus value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search categories" aria-label="Search expense categories" className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground" />
            {search ? <button type="button" aria-label="Clear category search" onClick={() => onSearchChange("")} className="rounded-full p-1 hover:bg-surface-subtle"><X aria-hidden="true" className="size-4" /></button> : null}
          </label>
          <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto overscroll-contain pb-3 pr-0.5">
            {filtered.map((category) => {
              const selected = category.id === selectedId;
              const Icon = getCategoryIcon(category.icon, category.name);
              return (
                <button type="button" key={category.id} aria-pressed={selected} onClick={() => onSelect(category)} style={!selected && category.color ? { backgroundColor: category.color } : undefined} className={`flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-left text-sm font-semibold transition-colors ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"}`}>
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full ${selected ? "bg-white/20" : "bg-white/65"}`} style={!selected ? { color: getCategoryForeground(category.color) } : undefined}><Icon aria-hidden="true" className="size-[17px]" strokeWidth={1.9} /></span>
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  {selected ? <Check aria-hidden="true" className="size-4 shrink-0" /> : null}
                </button>
              );
            })}
          </div>
          {!filtered.length ? <p className="py-8 text-center text-sm text-muted-foreground">No matching expense categories.</p> : null}
        </div>
      </section>
    </div>
  ), document.body);
}

export function BudgetManager() {
  const searchParams = useSearchParams();
  const { snapshot } = useOfflineSnapshot();
  const requestedPeriod = searchParams.get("period") as BudgetPeriod | null;
  const [period, setPeriod] = useState<BudgetPeriod>(PERIODS.some((item) => item.value === requestedPeriod) ? requestedPeriod! : "monthly");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currency, setCurrency] = useState("NPR");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<EditorDraft | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const appliedQuery = useRef("");

  const offlineBudgets = useMemo(() => snapshot.budgets.filter((budget) => budget.period === period && !budget.deleted), [period, snapshot.budgets]);
  const expenseCategories = categories.filter((category) => category.type === "expense");

  async function load(nextPeriod = period) {
    setLoading(true); setError("");
    try {
      const [budgetResponse, categoryResponse, profileResponse] = await Promise.all([authenticatedFetch(`/api/budgets?period=${nextPeriod}`), authenticatedFetch("/api/categories"), authenticatedFetch("/api/auth/me")]);
      if (![budgetResponse, categoryResponse, profileResponse].every((response) => response.ok)) throw new Error("Budget data is unavailable.");
      const budgetData = await budgetResponse.json() as { budgets: Budget[] };
      const categoryData = await categoryResponse.json() as { categories: Category[] };
      const profileData = await profileResponse.json() as { user: { currency: string } };
      setBudgets(budgetData.budgets); setCategories(categoryData.categories); setCurrency(profileData.user.currency);
    } catch {
      setBudgets(offlineBudgets);
      setCategories(snapshot.categories.map((category) => ({ id: category.serverId, name: category.name, type: category.type, icon: category.icon, color: category.color })));
      setCurrency(snapshot.profile?.currency ?? "NPR");
      if (!offlineBudgets.length) setError("Budgets could not be loaded. Reconnect and try again.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load(period));
    return () => window.cancelAnimationFrame(frame);
    // The request is intentionally keyed to the selected tab; cached offline
    // collections are fallback inputs, not reload triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);
  useEffect(() => {
    if (loading || editor) return;
    const budgetId = searchParams.get("budget");
    const categoryId = searchParams.get("category");
    const queryKey = budgetId ? `budget:${budgetId}` : categoryId ? `category:${categoryId}:${period}` : "";
    if (!queryKey || appliedQuery.current === queryKey) return;
    const frame = window.requestAnimationFrame(() => {
      if (budgetId) {
        const existing = budgets.find((budget) => budget.id === budgetId);
        if (existing) { appliedQuery.current = queryKey; setEditor({ budget: existing, scope: existing.categoryId ? "category" : "overall", categoryId: existing.categoryId, period: existing.period, amount: String(existing.limitAmount) }); }
      } else if (categoryId) {
        const existing = budgets.find((budget) => budget.categoryId === categoryId);
        appliedQuery.current = queryKey;
        setEditor(existing ? { budget: existing, scope: "category", categoryId: existing.categoryId, period: existing.period, amount: String(existing.limitAmount) } : { budget: null, scope: "category", categoryId, period, amount: "0" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [budgets, editor, loading, period, searchParams]);

  function openEditor(budget: Budget | null = null) {
    setEditor({ budget, scope: budget?.categoryId ? "category" : "overall", categoryId: budget?.categoryId ?? null, period: budget?.period ?? period, amount: String(budget?.limitAmount ?? 0) });
    setError("");
  }

  async function save(value: string) {
    if (!editor) return;
    const limitAmount = Number(value);
    if (!(limitAmount > 0)) { setError("Enter a budget limit greater than zero."); return; }
    setSaving(true); setError("");
    if (editor.scope === "category" && !editor.categoryId) { setError("Choose an expense category for this budget."); return; }
    const input = { categoryId: editor.scope === "category" ? editor.categoryId : null, limitAmount, period: editor.period };
    let queuedOffline = false;
    try {
      if (!navigator.onLine) throw new Error("offline");
      const response = await authenticatedFetch(editor.budget ? `/api/budgets/${editor.budget.id}` : "/api/budgets", { method: editor.budget ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, clientGeneratedId: crypto.randomUUID() }) });
      const result = await response.json().catch(() => null) as { existingBudgetId?: string; error?: string } | null;
      if (response.status === 409 && result?.existingBudgetId) {
        const existing = budgets.find((budget) => budget.id === result.existingBudgetId);
        if (existing) setEditor({ budget: existing, scope: existing.categoryId ? "category" : "overall", categoryId: existing.categoryId, period: existing.period, amount: String(existing.limitAmount) });
        setError("That budget already exists. You can edit it here."); setSaving(false); return;
      }
      if (!response.ok) throw new Error(result?.error ?? "Unable to save budget.");
    } catch (reason) {
      if (reason instanceof Error && reason.message !== "offline" && navigator.onLine) { setError(reason.message); setSaving(false); return; }
      queuedOffline = true;
      if (editor.budget) {
        const updated = await queueOfflineBudgetUpdate(editor.budget.id, input);
        setBudgets((current) => current.map((budget) => budget.id === editor.budget?.id ? updated : budget));
      } else {
        const queued = await queueOfflineBudgetCreate(input);
        if (queued.existing) setError("That budget already exists and is ready to edit.");
        else setBudgets((current) => [...current, queued.budget].sort((left, right) => left.categoryId ? right.categoryId ? right.percentage - left.percentage : 1 : -1));
      }
    }
    setEditor(null); setSaving(false); if (!queuedOffline) await load(period);
  }

  async function remove() {
    if (!editor?.budget) return;
    setSaving(true); setError("");
    let queuedOffline = false;
    try {
      if (!navigator.onLine) throw new Error("offline");
      const response = await authenticatedFetch(`/api/budgets/${editor.budget.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete budget.");
    } catch (reason) {
      if (reason instanceof Error && reason.message !== "offline" && navigator.onLine) { setError(reason.message); setSaving(false); return; }
      queuedOffline = true;
      await queueOfflineBudgetDelete(editor.budget.id);
      setBudgets((current) => current.filter((budget) => budget.id !== editor.budget?.id));
    }
    setEditor(null); setSaving(false); if (!queuedOffline) await load(period);
  }

  const overall = budgets.find((budget) => !budget.categoryId) ?? null;
  const categoryBudgets = budgets.filter((budget) => budget.categoryId);
  return (
    <main className="page-route-enter min-h-dvh bg-background"><div className="mx-auto w-full max-w-[720px] px-4 pb-16 sm:px-5">
      <StickyPageHeader className="-mx-4 flex items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
        <Link href={searchParams.get("returnTo") || "/profile"} aria-label="Back" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card/90"><ArrowLeft className="size-5" /></Link>
        <div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted-foreground">Plan your spending</p><h1 className="truncate text-[27px] font-semibold tracking-[-0.04em]">Budgets</h1></div>
        <button type="button" onClick={() => openEditor()} aria-label="Add budget" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] bg-primary text-primary-foreground"><Plus className="size-5" /></button>
      </StickyPageHeader>
      <div role="tablist" aria-label="Budget period" className="mt-5 grid grid-cols-3 gap-1 rounded-[13px] bg-surface-subtle p-1">{PERIODS.map((item) => <button key={item.value} role="tab" aria-selected={period === item.value} onClick={() => setPeriod(item.value)} className={`min-h-10 rounded-[10px] text-sm font-semibold ${period === item.value ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>{item.label}</button>)}</div>
      {error ? <p role="alert" className="mt-4 rounded-[12px] border border-expense/20 bg-expense-soft px-3 py-2.5 text-sm text-expense">{error}</p> : null}
      {loading ? <div className="mt-6"><ListDataSkeleton rows={3} /></div> : !budgets.length ? <section className="mt-6 rounded-[18px] border border-dashed border-border bg-card px-5 py-10 text-center"><Gauge className="mx-auto size-8 text-primary" /><h2 className="mt-4 text-base font-semibold">Set a comfortable spending limit</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Start with an overall budget, or focus on one expense category.</p><button onClick={() => openEditor()} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground"><Plus className="size-4" />Create budget</button></section> : <div className="mt-6 space-y-6">{overall ? <section><p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Overall spending</p><BudgetCard budget={overall} currency={currency} onEdit={() => openEditor(overall)} /></section> : <button onClick={() => openEditor()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] border border-dashed border-primary/35 bg-primary-soft/40 text-sm font-semibold text-primary"><Plus className="size-4" />Set overall budget</button>}<section><div className="mb-2 flex items-end justify-between px-1"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Categories</p><h2 className="mt-1 text-lg font-semibold">Category budgets</h2></div><span className="text-xs font-semibold text-muted-foreground">{categoryBudgets.length}</span></div>{categoryBudgets.length ? <div className="space-y-3">{categoryBudgets.map((budget) => <BudgetCard key={budget.id} budget={budget} currency={currency} onEdit={() => openEditor(budget)} />)}</div> : <div className="rounded-[14px] border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">No category budgets for this period.</div>}</section></div>}
      <MoneyEditor open={Boolean(editor)} value={editor?.amount ?? "0"} instanceKey={editor?.budget?.id ?? "new-budget"} onCancel={() => { setCategoryPickerOpen(false); setEditor(null); }} onSet={(value) => void save(value)} title={editor?.budget ? "Edit budget" : "Set budget"} currency={currency} confirmPlacement="bottom" confirmLabel={saving ? "Saving…" : "Save budget"} confirmDisabled={(value) => saving || !(Number(value) > 0) || (editor?.scope === "category" && !editor.categoryId)} previousLabel="Limit" topContent={editor ? <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setEditor((current) => current ? { ...current, scope: "overall", categoryId: null } : current)} className={`min-h-11 rounded-[11px] border px-3 text-sm font-semibold ${editor.scope === "overall" ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}><WalletCards className="mr-2 inline size-4" />Overall</button><button type="button" onClick={() => { setEditor((current) => current ? { ...current, scope: "category" } : current); setCategorySearch(""); setCategoryPickerOpen(true); }} className={`min-h-11 rounded-[11px] border px-3 text-sm font-semibold ${editor.scope === "category" ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}><Tags className="mr-2 inline size-4" />Category</button></div>
        {editor.scope === "category" ? <button type="button" onClick={() => { setCategorySearch(""); setCategoryPickerOpen(true); }} className="flex min-h-12 w-full items-center gap-3 rounded-[12px] border border-border bg-card px-3 text-left transition-colors hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"><span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-primary-soft text-primary"><Tags aria-hidden="true" className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-[11px] font-medium text-muted-foreground">Expense category</span><span className={`block truncate text-sm font-semibold ${editor.categoryId ? "text-foreground" : "text-primary"}`}>{expenseCategories.find((category) => category.id === editor.categoryId)?.name ?? "Choose category"}</span></span><ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></button> : null}
        <div className="grid grid-cols-3 gap-2">{PERIODS.map((item) => <button type="button" key={item.value} onClick={() => setEditor((current) => current ? { ...current, period: item.value } : current)} className={`min-h-9 rounded-[10px] border text-xs font-semibold ${editor.period === item.value ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}>{item.label}</button>)}</div>
        {editor.budget ? <button type="button" onClick={() => void remove()} disabled={saving} className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-expense"><Trash2 className="size-4" />Delete budget</button> : <p className="flex items-center gap-2 text-[11px] text-muted-foreground"><CalendarRange className="size-4" />Calendar periods reset automatically.</p>}
      </div> : null} />
      {categoryPickerOpen ? <CategoryPicker categories={expenseCategories} selectedId={editor?.categoryId ?? null} search={categorySearch} onSearchChange={setCategorySearch} onClose={() => setCategoryPickerOpen(false)} onSelect={(category) => { setEditor((current) => current ? { ...current, scope: "category", categoryId: category.id } : current); setCategoryPickerOpen(false); setCategorySearch(""); }} /> : null}
    </div></main>
  );
}
