"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, CalendarRange, Check, ChevronDown, ChevronRight, Copy, Gauge, Lightbulb, Plus, Search, Tags, Target, Trash2, WalletCards, X } from "lucide-react";

import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { BottomSheet } from "@/components/layout/bottom-sheet";
import { MoneyEditor } from "@/components/money/money-editor";
import { ListDataSkeleton } from "@/components/ui/data-skeleton";
import { LunaLoader } from "@/components/ui/luna-loader";
import { authenticatedFetch } from "@/lib/auth-client";
import { BUDGET_INCOME_INTERVAL_LABELS, type Budget, type BudgetAllocationKind, type BudgetCategoryBucket, type BudgetIncomeInterval, type BudgetIncomeSummary, type BudgetPeriod, type BudgetReview, type BudgetRolloverRule } from "@/lib/budgets";
import { getCategoryForeground, getCategoryIcon } from "@/lib/category-appearance";
import { formatCurrencyAmount } from "@/lib/currency";
import { useOfflineSnapshot } from "@/lib/offline/use-offline-snapshot";
import { queueOfflineBudgetCreate, queueOfflineBudgetDelete, queueOfflineBudgetUpdate } from "@/lib/offline/sync";

type Category = { id: string; name: string; type: "expense" | "income"; icon: string | null; color: string | null };
type BudgetMove = { id: string; fromAllocationId: string; toAllocationId: string; amount: number; reversalOfId: string | null; reversedAt: string | null; createdAt: string };
type IncomeEditorRow = { id: string; name: string; amount: string; interval: BudgetIncomeInterval; categoryId: string };
type EditorDraft = { budget: Budget | null; scope: "overall" | "category"; kind: BudgetAllocationKind; categoryId: string | null; period: BudgetPeriod; amount: string; rolloverRule: BudgetRolloverRule };
const PERIODS: Array<{ value: BudgetPeriod; label: string }> = [{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }];
const ROLLOVER_RULES: Array<{ value: BudgetRolloverRule; label: string; description: string }> = [
  { value: "none", label: "Reset every period", description: "Start each period with the base plan." },
  { value: "cap", label: "Carry forward up to the plan", description: "Carry unused money up to the original plan." },
  { value: "uncapped", label: "Carry forward all unused amount", description: "Carry every unused amount into the next period." },
];

function tone(percentage: number) {
  if (percentage >= 100) return { bar: "bg-expense", text: "text-expense", soft: "bg-expense-soft" };
  if (percentage >= 80) return { bar: "bg-warning", text: "text-warning-foreground", soft: "bg-warning-soft" };
  return { bar: "bg-primary", text: "text-primary", soft: "bg-primary-soft" };
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function BudgetCard({ budget, currency, href }: { budget: Budget; currency: string; href: string }) {
  const colors = tone(budget.percentage);
  const over = budget.remaining < 0;
  return (
    <Link href={href} className="block w-full rounded-[16px] border border-border bg-card p-4 text-left shadow-[0_8px_24px_rgb(23_32_29_/_0.04)] transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
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
            <div><p className="text-muted-foreground">Plan</p><p className="mt-0.5 font-semibold tabular-nums">{currency} {formatCurrencyAmount(budget.limitAmount)}</p></div>
            <div><p className="text-muted-foreground">Spent</p><p className="mt-0.5 font-semibold tabular-nums">{currency} {formatCurrencyAmount(budget.spent)}</p></div>
            <div className="text-right"><p className="text-muted-foreground">{over ? "Over" : "Remaining"}</p><p className={`mt-0.5 font-semibold tabular-nums ${over ? "text-expense" : ""}`}>{currency} {formatCurrencyAmount(Math.abs(budget.remaining))}</p></div>
          </div>
        </div>
        <ChevronRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-foreground-subtle" />
      </div>
    </Link>
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

  return (
    <BottomSheet open onClose={onClose} labelledBy="budget-category-picker-title" className="drawer-enter flex h-[min(82dvh,640px)] w-full flex-col overflow-hidden rounded-t-[18px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgb(23_32_29_/_0.14)]" backdropClassName="drawer-scrim-enter z-[80]">
        <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col">
          <header className="grid shrink-0 grid-cols-[44px_1fr_44px] items-center">
            <button type="button" data-luna-bottom-sheet-close="true" aria-label="Close category picker" onClick={onClose} className="flex size-11 items-center justify-center rounded-[10px] text-expense hover:bg-expense-soft">
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
    </BottomSheet>
  );
}

function PreviousBudgetDrawer({ period, currency, budgets, periodStart, periodEnd, loading, copying, error, onClose, onCopy }: {
  period: BudgetPeriod;
  currency: string;
  budgets: Budget[];
  periodStart: string | null;
  periodEnd: string | null;
  loading: boolean;
  copying: boolean;
  error: string;
  onClose: () => void;
  onCopy: () => void;
}) {
  if (typeof document === "undefined") return null;
  const periodLabel = PERIODS.find((item) => item.value === period)?.label ?? period;
  return createPortal((
    <div className="drawer-scrim-enter fixed inset-0 z-[80] flex items-end bg-foreground/25 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="previous-budget-title" data-luna-bottom-sheet="true" className="drawer-enter flex h-[min(78dvh,620px)] w-full flex-col overflow-hidden rounded-t-[18px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgb(23_32_29_/_0.14)]">
        <div className="mx-auto flex min-h-0 w-full max-w-[520px] flex-1 flex-col">
          <div data-luna-bottom-sheet-handle="true" className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-foreground/15" aria-hidden="true" />
          <header className="grid shrink-0 grid-cols-[44px_1fr_44px] items-center">
            <button type="button" data-luna-bottom-sheet-close="true" aria-label="Close previous budget" onClick={onClose} className="flex size-11 items-center justify-center rounded-[10px] text-expense hover:bg-expense-soft"><X aria-hidden="true" className="size-5" /></button>
            <h2 id="previous-budget-title" className="text-center text-[17px] font-semibold">Previous {periodLabel.toLowerCase()} plan</h2>
            <span />
          </header>
          <p className="mt-1 text-center text-xs text-muted-foreground">{periodStart && periodEnd ? `${dateLabel(periodStart)} – ${dateLabel(periodEnd)}` : "Review the last period before copying"}</p>
          {error ? <p role="alert" className="mt-4 rounded-[12px] border border-expense/20 bg-expense-soft px-3 py-2.5 text-sm text-expense">{error}</p> : null}
          <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pb-3">
            {loading ? <ListDataSkeleton rows={3} /> : budgets.length ? budgets.map((budget) => <div key={budget.id} className="rounded-[13px] border border-border bg-card px-3.5 py-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{budget.name}</p><p className="mt-1 text-xs text-muted-foreground">{currency} {formatCurrencyAmount(budget.spent)} spent · {budget.remaining < 0 ? "over plan" : `${currency} ${formatCurrencyAmount(budget.remaining)} remaining`}</p></div><p className="shrink-0 text-sm font-semibold tabular-nums">{currency} {formatCurrencyAmount(budget.limitAmount)}</p></div></div>) : <div className="rounded-[14px] border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">No previous budget was found for this period.</div>}
          </div>
          <div className="shrink-0 border-t border-border pt-3"><button type="button" onClick={onCopy} disabled={loading || copying || !budgets.length} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[11px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><Copy aria-hidden="true" className="size-4" />{copying ? "Copying…" : `Copy to ${periodLabel.toLowerCase()} plan`}</button></div>
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
  const [gateReady, setGateReady] = useState(false);
  const [incomeSummary, setIncomeSummary] = useState<BudgetIncomeSummary | null>(null);
  const [incomeEditorOpen, setIncomeEditorOpen] = useState(false);
  const [incomeEditorRows, setIncomeEditorRows] = useState<IncomeEditorRow[]>([]);
  const [incomeSaving, setIncomeSaving] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<EditorDraft | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [previousDrawerOpen, setPreviousDrawerOpen] = useState(false);
  const [previousBudgets, setPreviousBudgets] = useState<Budget[]>([]);
  const [previousPeriodStart, setPreviousPeriodStart] = useState<string | null>(null);
  const [previousPeriodEnd, setPreviousPeriodEnd] = useState<string | null>(null);
  const [previousLoading, setPreviousLoading] = useState(false);
  const [previousCopying, setPreviousCopying] = useState(false);
  const [previousError, setPreviousError] = useState("");
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [review, setReview] = useState<BudgetReview | null>(null);
  const [recommendations, setRecommendations] = useState<Array<{ categoryId: string | null; name: string; amount: number; kind: BudgetAllocationKind }>>([]);
  const [recommendationMeta, setRecommendationMeta] = useState<{ overall: number; savings: number; months: number } | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateAmount, setTemplateAmount] = useState("");
  const [bucketAssignments, setBucketAssignments] = useState<Record<string, BudgetCategoryBucket>>({});
  const [templateSaving, setTemplateSaving] = useState(false);
  const [moveFrom, setMoveFrom] = useState("");
  const [moveTo, setMoveTo] = useState("");
  const [moveAmount, setMoveAmount] = useState("");
  const [moveSaving, setMoveSaving] = useState(false);
  const [moves, setMoves] = useState<BudgetMove[]>([]);
  const [moveReversing, setMoveReversing] = useState("");
  const appliedQuery = useRef("");

  const offlineBudgets = useMemo(() => snapshot.budgets.filter((budget) => budget.period === period && !budget.deleted), [period, snapshot.budgets]);
  const expenseCategories = categories.filter((category) => category.type === "expense");

  useEffect(() => {
    let active = true;
    void authenticatedFetch("/api/budgets/onboarding").then(async (response) => {
      if (!response.ok) {
        if (active) setError("Budget setup status could not be loaded. Reconnect and try again.");
        return;
      }
      const result = await response.json() as { completed: boolean; currency: string; income: BudgetIncomeSummary };
      if (!active) return;
      if (!result.completed) {
        window.location.replace(`/budgets/onboarding?returnTo=${encodeURIComponent("/budgets")}`);
        return;
      }
      setCurrency(result.currency);
      setIncomeSummary(result.income);
      setGateReady(true);
    }).catch(() => { if (active) setError("Budget setup status could not be loaded. Reconnect and try again."); });
    return () => { active = false; };
  }, []);

  async function load(nextPeriod = period) {
    setLoading(true); setError("");
    try {
      const [budgetResponse, categoryResponse, profileResponse, reviewResponse] = await Promise.all([authenticatedFetch(`/api/budgets?period=${nextPeriod}`), authenticatedFetch("/api/categories"), authenticatedFetch("/api/auth/me"), authenticatedFetch(`/api/budgets/review?period=${nextPeriod}`)]);
      if (![budgetResponse, categoryResponse, profileResponse].every((response) => response.ok)) throw new Error("Budget data is unavailable.");
      const budgetData = await budgetResponse.json() as { budgets: Budget[] };
      const categoryData = await categoryResponse.json() as { categories: Category[] };
      const profileData = await profileResponse.json() as { user: { currency: string } };
      const periodId = budgetData.budgets[0]?.periodId;
      const moveResponse = periodId ? await authenticatedFetch(`/api/budgets/moves?periodId=${encodeURIComponent(periodId)}`) : null;
      const moveData = moveResponse?.ok ? await moveResponse.json() as { moves?: BudgetMove[] } : { moves: [] };
      setBudgets(budgetData.budgets); setCategories(categoryData.categories); setCurrency(profileData.user.currency); setReview(reviewResponse.ok ? await reviewResponse.json() as BudgetReview : null); setMoves(moveData.moves ?? []);
    } catch {
      setBudgets(offlineBudgets);
      setCategories(snapshot.categories.map((category) => ({ id: category.serverId, name: category.name, type: category.type, icon: category.icon, color: category.color })));
      setCurrency(snapshot.profile?.currency ?? "NPR");
      setReview(null); setMoves([]);
      if (!offlineBudgets.length) setError("Budgets could not be loaded. Reconnect and try again.");
    } finally { setLoading(false); }
  }

  function openIncomePlan() {
    setIncomeEditorRows((incomeSummary?.sources ?? []).map((source) => ({ id: source.id, name: source.name, amount: String(source.amount), interval: source.interval, categoryId: source.categoryId ?? "" })));
    setIncomeEditorOpen(true);
    setError("");
  }

  async function saveIncomePlan() {
    if (!incomeEditorRows.every((row) => row.name.trim() && Number(row.amount) > 0 && Number.isFinite(Number(row.amount)))) { setError("Add a name and positive amount for every income source."); return; }
    setIncomeSaving(true); setError("");
    try {
      const response = await authenticatedFetch("/api/budgets/income-sources", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ incomeSources: incomeEditorRows.map((row) => ({ name: row.name.trim(), amount: Number(row.amount), interval: row.interval, categoryId: row.categoryId || null })) }) });
      const result = await response.json().catch(() => null) as { income?: BudgetIncomeSummary; error?: string } | null;
      if (!response.ok || !result?.income) throw new Error(result?.error ?? "Unable to save income estimates.");
      setIncomeSummary(result.income); setIncomeEditorOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save income estimates."); } finally { setIncomeSaving(false); }
  }

  useEffect(() => {
    if (!gateReady) return;
    const frame = window.requestAnimationFrame(() => void load(period));
    return () => window.cancelAnimationFrame(frame);
    // The request is intentionally keyed to the selected tab; cached offline
    // collections are fallback inputs, not reload triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateReady, period]);
  useEffect(() => {
    if (loading || editor) return;
    const budgetId = searchParams.get("budget");
    const categoryId = searchParams.get("category");
    const queryKey = budgetId ? `budget:${budgetId}` : categoryId ? `category:${categoryId}:${period}` : "";
    if (!queryKey || appliedQuery.current === queryKey) return;
    const frame = window.requestAnimationFrame(() => {
      if (budgetId) {
        const existing = budgets.find((budget) => budget.id === budgetId);
        if (existing) { appliedQuery.current = queryKey; setEditor({ budget: existing, scope: existing.categoryId ? "category" : "overall", kind: existing.kind ?? "expense", categoryId: existing.categoryId, period: existing.period, amount: String(existing.limitAmount), rolloverRule: existing.rolloverRule ?? "none" }); }
      } else if (categoryId) {
        const existing = budgets.find((budget) => budget.categoryId === categoryId);
        appliedQuery.current = queryKey;
        setEditor(existing ? { budget: existing, scope: "category", kind: existing.kind ?? "expense", categoryId: existing.categoryId, period: existing.period, amount: String(existing.limitAmount), rolloverRule: existing.rolloverRule ?? "none" } : { budget: null, scope: "category", kind: "expense", categoryId, period, amount: "0", rolloverRule: "none" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [budgets, editor, loading, period, searchParams]);

  function openEditor(budget: Budget | null = null) {
    setRolloverOpen(false);
    setEditor({ budget, scope: budget?.categoryId ? "category" : "overall", kind: budget?.kind ?? "expense", categoryId: budget?.categoryId ?? null, period: budget?.period ?? period, amount: String(budget?.limitAmount ?? 0), rolloverRule: budget?.rolloverRule ?? "none" });
    setError("");
  }

  async function save(value: string) {
    if (!editor) return;
    const limitAmount = Number(value);
    if (!(limitAmount > 0)) { setError("Enter a budget limit greater than zero."); return; }
    setSaving(true); setError("");
    if (editor.scope === "category" && !editor.categoryId) { setError("Choose an expense category for this budget."); return; }
    const input = { categoryId: editor.kind === "savings" ? null : editor.scope === "category" ? editor.categoryId : null, kind: editor.kind, limitAmount, period: editor.period, rolloverRule: editor.rolloverRule };
    let queuedOffline = false;
    try {
      if (!navigator.onLine) throw new Error("offline");
      const response = await authenticatedFetch(editor.budget ? `/api/budgets/${editor.budget.id}` : "/api/budgets", { method: editor.budget ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, clientGeneratedId: crypto.randomUUID() }) });
      const result = await response.json().catch(() => null) as { existingBudgetId?: string; error?: string } | null;
      if (response.status === 409 && result?.existingBudgetId) {
        const existing = budgets.find((budget) => budget.id === result.existingBudgetId);
        if (existing) setEditor({ budget: existing, scope: existing.categoryId ? "category" : "overall", kind: existing.kind ?? "expense", categoryId: existing.categoryId, period: existing.period, amount: String(existing.limitAmount), rolloverRule: existing.rolloverRule ?? "none" });
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
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to delete budget.");
    } catch (reason) {
      if (reason instanceof Error && reason.message !== "offline" && navigator.onLine) { setError(reason.message); setSaving(false); return; }
      queuedOffline = true;
      await queueOfflineBudgetDelete(editor.budget.id);
      setBudgets((current) => current.filter((budget) => budget.id !== editor.budget?.id));
    }
    setEditor(null); setSaving(false); if (!queuedOffline) await load(period);
  }

  async function openPreviousDrawer() {
    setPreviousDrawerOpen(true); setPreviousLoading(true); setPreviousError(""); setPreviousBudgets([]); setPreviousPeriodStart(null); setPreviousPeriodEnd(null);
    try {
      const response = await authenticatedFetch(`/api/budgets/copy?period=${period}`);
      const result = await response.json().catch(() => null) as { budgets?: Budget[]; periodStart?: string | null; periodEnd?: string | null; error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to load the previous period.");
      setPreviousBudgets(result?.budgets ?? []); setPreviousPeriodStart(result?.periodStart ?? null); setPreviousPeriodEnd(result?.periodEnd ?? null);
    } catch (reason) {
      setPreviousError(reason instanceof Error ? reason.message : "Unable to load the previous period.");
    } finally {
      setPreviousLoading(false);
    }
  }

  async function copyPrevious() {
    setPreviousCopying(true); setPreviousError("");
    try {
      const response = await authenticatedFetch("/api/budgets/copy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period }) });
      const result = await response.json().catch(() => null) as { copied?: number; error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to copy the previous period.");
      setPreviousDrawerOpen(false); await load(period);
    } catch (reason) {
      setPreviousError(reason instanceof Error ? reason.message : "Unable to copy the previous period.");
    } finally {
      setPreviousCopying(false);
    }
  }

  async function loadRecommendations() {
    setRecommendationLoading(true); setError("");
    try {
      const response = await authenticatedFetch(`/api/budgets/recommendations?period=${period}&months=6`);
      const result = await response.json() as { recommendations?: Array<{ categoryId: string | null; name: string; amount: number; kind: BudgetAllocationKind }>; recommendedOverall?: number; recommendedSavings?: number; months?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to calculate recommendations.");
      setRecommendations(result.recommendations ?? []);
      setRecommendationMeta({ overall: result.recommendedOverall ?? 0, savings: result.recommendedSavings ?? 0, months: result.months ?? 6 });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to calculate recommendations.");
    } finally { setRecommendationLoading(false); }
  }

  async function applyRecommendations() {
    setRecommendationLoading(true); setError("");
    try {
      const response = await authenticatedFetch(`/api/budgets/recommendations?period=${period}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period }) });
      const result = await response.json() as { budgets?: Budget[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to apply recommendations.");
      setRecommendations([]); setRecommendationMeta(null); setBudgets(result.budgets ?? []); await load(period);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to apply recommendations."); } finally { setRecommendationLoading(false); }
  }

  async function applyStarterPlan() {
    const totalAmount = Number(templateAmount);
    if (!(totalAmount > 0)) { setError("Enter the total monthly planning amount."); return; }
    setTemplateSaving(true); setError("");
    try {
      const response = await authenticatedFetch("/api/budgets/template", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ totalAmount, assignments: Object.entries(bucketAssignments).map(([categoryId, bucket]) => ({ categoryId, bucket })) }) });
      const result = await response.json() as { budgets?: Budget[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to apply starter plan.");
      setTemplateOpen(false); setBudgets(result.budgets ?? []); await load(period);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to apply starter plan."); } finally { setTemplateSaving(false); }
  }

  async function moveMoney() {
    const amount = Number(moveAmount);
    if (!moveFrom || !moveTo || !(amount > 0)) { setError("Choose two categories and enter an amount to move."); return; }
    setMoveSaving(true); setError("");
    try {
      const response = await authenticatedFetch("/api/budgets/moves", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fromAllocationId: moveFrom, toAllocationId: moveTo, amount }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to move budget money.");
      setMoveAmount(""); await load(period);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to move budget money."); } finally { setMoveSaving(false); }
  }

  async function reverseMove(moveId: string) {
    setMoveReversing(moveId); setError("");
    try {
      const response = await authenticatedFetch(`/api/budgets/moves/${moveId}/reverse`, { method: "POST" });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to undo this budget move.");
      await load(period);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to undo this budget move."); } finally { setMoveReversing(""); }
  }

  if (!gateReady) return error ? <main className="grid min-h-dvh place-items-center bg-background px-5 text-center"><section className="max-w-sm"><h1 className="text-lg font-semibold">Budgets could not load</h1><p role="alert" className="mt-2 text-sm leading-6 text-expense">{error}</p><button type="button" onClick={() => window.location.reload()} className="mt-5 min-h-11 rounded-[12px] bg-primary px-5 text-sm font-semibold text-primary-foreground">Try again</button></section></main> : <LunaLoader label="Preparing your budget" />;

  const overall = budgets.find((budget) => budget.kind !== "savings" && !budget.categoryId) ?? null;
  const savingsBudget = budgets.find((budget) => budget.kind === "savings") ?? null;
  const categoryBudgets = budgets.filter((budget) => budget.kind !== "savings" && budget.categoryId);
  return (
    <main className="page-route-enter min-h-dvh bg-background"><div className="mx-auto w-full max-w-[720px] px-4 pb-16 sm:px-5">
      <StickyPageHeader className="-mx-4 flex items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
        <Link href={searchParams.get("returnTo") || "/profile"} aria-label="Back" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card/90"><ArrowLeft className="size-5" /></Link>
        <div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted-foreground">Plan your spending</p><h1 className="truncate text-[27px] font-semibold tracking-[-0.04em]">Budgets</h1></div>
        <div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => setTemplateOpen((current) => !current)} aria-label="Start a 50/30/20 plan" className="flex size-11 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary"><Lightbulb className="size-[18px]" /></button><button type="button" onClick={() => openEditor()} aria-label="Add budget" className="flex size-11 items-center justify-center rounded-[11px] bg-primary text-primary-foreground"><Plus className="size-5" /></button></div>
      </StickyPageHeader>
      <div role="tablist" aria-label="Budget period" className="mt-5 grid grid-cols-3 gap-1 rounded-[13px] bg-surface-subtle p-1">{PERIODS.map((item) => <button key={item.value} role="tab" aria-selected={period === item.value} onClick={() => { setPreviousDrawerOpen(false); setPeriod(item.value); }} className={`min-h-10 rounded-[10px] text-sm font-semibold ${period === item.value ? "bg-card text-primary shadow-sm" : "text-foreground"}`}>{item.label}</button>)}</div>
      <div className="mt-3 flex items-center justify-between gap-3 px-1"><p className="text-xs text-muted-foreground">Each period keeps its own plan and adjustments.</p><button type="button" onClick={() => void openPreviousDrawer()} disabled={saving || previousLoading} className="shrink-0 text-xs font-semibold text-primary disabled:opacity-50">Copy previous</button></div>
      {review ? <section aria-labelledby="budget-plan-summary" className="mt-5 rounded-[16px] border border-border bg-card p-4 shadow-[0_8px_24px_rgb(23_32_29_/_0.04)]"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">{review.periodStart} – {review.periodEnd}</p><h2 id="budget-plan-summary" className="mt-1 text-lg font-semibold">Your plan at a glance</h2></div><Gauge aria-hidden="true" className="size-5 text-primary" /></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><div><p className="text-muted-foreground">Plan remaining</p><p className="mt-1 text-base font-semibold tabular-nums">{currency} {formatCurrencyAmount(Math.max(review.remaining, 0))}</p></div><div><p className="text-muted-foreground">Unallocated</p><p className={`mt-1 text-base font-semibold tabular-nums ${review.unallocated < 0 ? "text-expense" : "text-primary"}`}>{currency} {formatCurrencyAmount(Math.abs(review.unallocated))}</p></div><div><p className="text-muted-foreground">Projected month-end</p><p className="mt-1 text-base font-semibold tabular-nums">{review.projectedSpending == null ? "—" : `${currency} ${formatCurrencyAmount(review.projectedSpending)}`}</p></div><div><p className="text-muted-foreground">Safe daily</p><p className="mt-1 text-base font-semibold tabular-nums">{review.safeDailySpending == null ? "—" : `${currency} ${formatCurrencyAmount(review.safeDailySpending)}`}</p></div></div>{review.projectedSpending != null && review.projectedSpending > review.overallPlan ? <p className="mt-4 rounded-[11px] bg-expense-soft px-3 py-2.5 text-xs leading-5 text-expense-strong">At your current rate, projected spending is {currency} {formatCurrencyAmount(review.projectedSpending - review.overallPlan)} over the overall plan.</p> : null}</section> : null}
      {error && !editor ? <p role="alert" className="mt-4 rounded-[12px] border border-expense/20 bg-expense-soft px-3 py-2.5 text-sm text-expense">{error}</p> : null}
      {incomeSummary ? <section aria-labelledby="income-plan-heading" className="mt-5 rounded-[16px] border border-border bg-card p-4 shadow-[0_8px_24px_rgb(23_32_29_/_0.04)]"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">Income plan</p><h2 id="income-plan-heading" className="mt-1 text-lg font-semibold">Estimate versus actual</h2></div><button type="button" onClick={openIncomePlan} className="rounded-[10px] bg-primary-soft px-3 py-2 text-xs font-semibold text-primary">Edit plan</button></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-[11px] bg-primary-soft/50 px-3 py-2.5"><p className="text-[11px] text-muted-foreground">Estimated monthly</p><p className="mt-1 text-base font-semibold tabular-nums">{currency} {formatCurrencyAmount(incomeSummary.estimatedMonthly)}</p></div><div className="rounded-[11px] bg-income-soft px-3 py-2.5"><p className="text-[11px] text-muted-foreground">Actual this month</p><p className="mt-1 text-base font-semibold tabular-nums">{currency} {formatCurrencyAmount(incomeSummary.actualThisMonth)}</p></div><div className="rounded-[11px] bg-surface-subtle px-3 py-2.5"><p className="text-[11px] text-muted-foreground">Unmatched actual</p><p className="mt-1 text-base font-semibold tabular-nums">{currency} {formatCurrencyAmount(incomeSummary.unmatchedActualThisMonth)}</p></div></div><div className="mt-4 divide-y divide-border rounded-[12px] border border-border">{incomeSummary.sources.map((source) => <div key={source.id} className="flex items-center justify-between gap-3 px-3 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-semibold">{source.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{BUDGET_INCOME_INTERVAL_LABELS[source.interval]} · Estimate {currency} {formatCurrencyAmount(source.monthlyEstimate)}{source.categoryName ? ` · ${source.categoryName}` : ""}</p></div><p className="shrink-0 text-xs font-semibold tabular-nums text-income">Actual {currency} {formatCurrencyAmount(source.actualThisMonth)}</p></div>)}</div>{incomeEditorOpen ? <div className="mt-4 rounded-[13px] border border-primary/20 bg-primary-soft/30 p-3"><p className="text-sm font-semibold">Edit income estimates</p><div className="mt-3 space-y-2">{incomeEditorRows.map((row, index) => <div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"><label><span className="sr-only">Income source {index + 1} name</span><input value={row.name} onChange={(event) => setIncomeEditorRows((current) => current.map((item) => item.id === row.id ? { ...item, name: event.target.value } : item))} className="min-h-10 w-full rounded-[10px] border border-border bg-card px-2.5 text-sm outline-none focus:border-primary" /></label><label><span className="sr-only">Income source {index + 1} amount</span><input value={row.amount} onChange={(event) => setIncomeEditorRows((current) => current.map((item) => item.id === row.id ? { ...item, amount: event.target.value } : item))} inputMode="decimal" className="min-h-10 w-full rounded-[10px] border border-border bg-card px-2.5 text-sm tabular-nums outline-none focus:border-primary" /></label><label><span className="sr-only">Income source {index + 1} interval</span><select value={row.interval} onChange={(event) => setIncomeEditorRows((current) => current.map((item) => item.id === row.id ? { ...item, interval: event.target.value as BudgetIncomeInterval } : item))} className="min-h-10 w-full rounded-[10px] border border-border bg-card px-2.5 text-sm outline-none focus:border-primary">{Object.entries(BUDGET_INCOME_INTERVAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="sr-only">Income source {index + 1} category</span><select value={row.categoryId} onChange={(event) => setIncomeEditorRows((current) => current.map((item) => item.id === row.id ? { ...item, categoryId: event.target.value } : item))} className="min-h-10 w-full rounded-[10px] border border-border bg-card px-2.5 text-sm outline-none focus:border-primary"><option value="">No category</option>{categories.filter((category) => category.type === "income").map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>{incomeEditorRows.length > 1 ? <button type="button" onClick={() => setIncomeEditorRows((current) => current.filter((item) => item.id !== row.id))} aria-label={`Remove income source ${index + 1}`} className="flex size-10 items-center justify-center rounded-[10px] text-expense hover:bg-expense-soft"><Trash2 className="size-4" /></button> : <span />}</div>)}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={() => setIncomeEditorRows((current) => [...current, { id: crypto.randomUUID(), name: "", amount: "", interval: "monthly", categoryId: "" }])} className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] bg-card px-2.5 text-xs font-semibold text-primary"><Plus className="size-3.5" /> Add source</button><div className="flex gap-2"><button type="button" onClick={() => setIncomeEditorOpen(false)} className="min-h-9 rounded-[10px] px-2.5 text-xs font-semibold text-muted-foreground">Cancel</button><button type="button" onClick={() => void saveIncomePlan()} disabled={incomeSaving} className="min-h-9 rounded-[10px] bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">{incomeSaving ? "Saving…" : "Save estimates"}</button></div></div></div> : null}</section> : null}
      {templateOpen ? <section aria-labelledby="starter-plan-heading" className="mt-5 rounded-[16px] border border-primary/20 bg-primary-soft/40 p-4">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-primary">A simple starting point</p><h2 id="starter-plan-heading" className="mt-1 text-lg font-semibold">Set up 50/30/20</h2></div><button type="button" onClick={() => setTemplateOpen(false)} aria-label="Close starter plan" className="rounded-full p-1 text-muted-foreground hover:bg-card"><X className="size-4" /></button></div>
        <label className="mt-4 block text-xs font-semibold" htmlFor="budget-template-amount">Total monthly planning amount<input id="budget-template-amount" name="templateAmount" inputMode="decimal" value={templateAmount} onChange={(event) => setTemplateAmount(event.target.value)} placeholder="e.g. 100000" className="mt-1 min-h-11 w-full rounded-[11px] border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-primary" /></label>
        <p className="mt-3 text-xs leading-5 text-foreground">Needs get 50%, wants get 30%, and positive savings transactions are compared with the remaining 20% target.</p>
        <div className="mt-4 space-y-2">{expenseCategories.map((category) => <div key={category.id} className="flex items-center justify-between gap-3 rounded-[11px] border border-border bg-card px-3 py-2.5"><span className="truncate text-sm font-semibold">{category.name}</span><div className="flex shrink-0 gap-1"><button type="button" onClick={() => setBucketAssignments((current) => ({ ...current, [category.id]: "needs" }))} aria-pressed={bucketAssignments[category.id] === "needs"} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${bucketAssignments[category.id] === "needs" ? "bg-primary text-primary-foreground" : "bg-surface-subtle text-foreground"}`}>Needs</button><button type="button" onClick={() => setBucketAssignments((current) => ({ ...current, [category.id]: "wants" }))} aria-pressed={bucketAssignments[category.id] === "wants"} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${bucketAssignments[category.id] === "wants" ? "bg-primary text-primary-foreground" : "bg-surface-subtle text-foreground"}`}>Wants</button></div></div>)}</div>
        <button type="button" onClick={() => void applyStarterPlan()} disabled={templateSaving} className="mt-4 flex min-h-11 w-full items-center justify-center rounded-[11px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{templateSaving ? "Applying…" : "Apply starter plan"}</button>
      </section> : null}
      {period === "monthly" ? <section aria-labelledby="recommendations-heading" className="mt-5 rounded-[16px] border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">Based on completed months</p><h2 id="recommendations-heading" className="mt-1 text-lg font-semibold">Recommended allocations</h2></div><button type="button" onClick={() => void loadRecommendations()} disabled={recommendationLoading} className="rounded-[10px] bg-primary-soft px-3 py-2 text-xs font-semibold text-primary">{recommendationLoading ? "Loading…" : "Review"}</button></div>{recommendations.length ? <><p className="mt-3 text-xs leading-5 text-muted-foreground">Median spending from the last {recommendationMeta?.months ?? 6} completed months. Existing plans will be left unchanged.</p><div className="mt-3 divide-y divide-border rounded-[12px] border border-border">{recommendations.slice(0, 8).map((recommendation) => <div key={`${recommendation.kind}:${recommendation.categoryId}`} className="flex items-center justify-between gap-3 px-3 py-2.5"><span className="truncate text-sm font-semibold">{recommendation.name}</span><span className="shrink-0 text-sm font-semibold tabular-nums">{currency} {formatCurrencyAmount(recommendation.amount)}</span></div>)}</div><div className="mt-3 grid gap-2 rounded-[12px] bg-surface-subtle px-3 py-2.5 text-xs sm:grid-cols-2"><span className="text-foreground">Suggested overall <strong>{currency} {formatCurrencyAmount(recommendationMeta?.overall ?? 0)}</strong></span><span className="text-foreground">Savings target <strong>{currency} {formatCurrencyAmount(recommendationMeta?.savings ?? 0)}</strong></span></div><div className="mt-3 flex items-center justify-end"><button type="button" onClick={() => void applyRecommendations()} disabled={recommendationLoading} className="font-semibold text-primary">Apply missing plans</button></div></> : <p className="mt-3 text-xs leading-5 text-muted-foreground">Review your history to get a calm starting point for this month.</p>}</section> : null}
      {loading ? <div className="mt-6"><ListDataSkeleton rows={3} /></div> : !budgets.length ? <section className="mt-6 rounded-[18px] border border-dashed border-border bg-card px-5 py-10 text-center"><Gauge className="mx-auto size-8 text-primary" /><h2 className="mt-4 text-base font-semibold">Set a comfortable spending limit</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Start with an overall budget, or focus on one expense category.</p><button onClick={() => openEditor()} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground"><Plus className="size-4" />Create budget</button></section> : <div className="mt-6 space-y-6">{overall ? <section><p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Overall spending</p><BudgetCard budget={overall} currency={currency} href={`/budgets/${overall.id}?returnTo=${encodeURIComponent(`/budgets?period=${period}`)}`} /></section> : <button onClick={() => openEditor()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] border border-dashed border-primary/35 bg-primary-soft/40 text-sm font-semibold text-primary"><Plus className="size-4" />Set overall budget</button>}<section><div className="mb-2 flex items-end justify-between px-1"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Categories</p><h2 className="mt-1 text-lg font-semibold">Category budgets</h2></div><span className="text-xs font-semibold text-muted-foreground">{categoryBudgets.length}</span></div>{categoryBudgets.length ? <div className="space-y-3">{categoryBudgets.map((budget) => <BudgetCard key={budget.id} budget={budget} currency={currency} href={`/budgets/${budget.id}?returnTo=${encodeURIComponent(`/budgets?period=${period}`)}`} />)}</div> : <div className="rounded-[14px] border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">No category budgets for this period.</div>}</section></div>}
      <MoneyEditor open={Boolean(editor)} value={editor?.amount ?? "0"} instanceKey={editor?.budget?.id ?? "new-budget"} onCancel={() => { setCategoryPickerOpen(false); setRolloverOpen(false); setEditor(null); }} onSet={(value) => void save(value)} title={editor?.budget ? "Edit budget plan" : "Set budget plan"} currency={currency} confirmPlacement="bottom" confirmLabel={saving ? "Saving…" : "Save budget"} confirmDisabled={(value) => saving || !(Number(value) > 0) || (editor?.scope === "category" && !editor.categoryId)} previousLabel="Plan" topContent={editor ? <div className="space-y-3">
        {error ? <p role="alert" className="rounded-[12px] border border-expense/20 bg-expense-soft px-3 py-2.5 text-sm text-expense">{error}</p> : null}
        <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setEditor((current) => current ? { ...current, scope: "overall", kind: "expense", categoryId: null } : current)} className={`min-h-11 rounded-[11px] border px-3 text-sm font-semibold ${editor.scope === "overall" && editor.kind === "expense" ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}><WalletCards className="mr-2 inline size-4" />Overall</button><button type="button" onClick={() => { setEditor((current) => current ? { ...current, scope: "category", kind: "expense" } : current); setCategorySearch(""); setCategoryPickerOpen(true); }} className={`min-h-11 rounded-[11px] border px-3 text-sm font-semibold ${editor.scope === "category" && editor.kind === "expense" ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}><Tags className="mr-2 inline size-4" />Category</button></div>
        <button type="button" onClick={() => setEditor((current) => current ? { ...current, scope: "overall", kind: "savings", categoryId: null } : current)} className={`flex min-h-11 w-full items-center justify-center rounded-[11px] border px-3 text-sm font-semibold ${editor.kind === "savings" ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}><Target className="mr-2 inline size-4" />Savings target</button>
        {editor.scope === "category" ? <button type="button" onClick={() => { setCategorySearch(""); setCategoryPickerOpen(true); }} className="flex min-h-12 w-full items-center gap-3 rounded-[12px] border border-border bg-card px-3 text-left transition-colors hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"><span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-primary-soft text-primary"><Tags aria-hidden="true" className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-[11px] font-medium text-muted-foreground">Expense category</span><span className={`block truncate text-sm font-semibold ${editor.categoryId ? "text-foreground" : "text-primary"}`}>{expenseCategories.find((category) => category.id === editor.categoryId)?.name ?? "Choose category"}</span></span><ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></button> : null}
        <div className="grid grid-cols-3 gap-2">{PERIODS.map((item) => <button type="button" key={item.value} disabled={Boolean(editor.budget && editor.budget.period !== item.value)} onClick={() => setEditor((current) => current ? { ...current, period: item.value } : current)} className={`min-h-9 rounded-[10px] border text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${editor.period === item.value ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}>{item.label}</button>)}</div>
        <div className="relative"><span className="text-[11px] font-medium text-muted-foreground">Rollover rule</span><button type="button" aria-haspopup="listbox" aria-expanded={rolloverOpen} aria-label="Rollover rule" onClick={() => setRolloverOpen((current) => !current)} className={`mt-1 flex min-h-11 w-full items-center gap-3 rounded-[11px] border bg-card px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${rolloverOpen ? "border-primary" : "border-border hover:border-primary/45"}`}><span className="min-w-0 flex-1 truncate">{ROLLOVER_RULES.find((rule) => rule.value === editor.rolloverRule)?.label}</span><ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-muted-foreground transition-transform ${rolloverOpen ? "rotate-180" : ""}`} /></button>{rolloverOpen ? <div role="listbox" aria-label="Rollover rule options" className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-[13px] border border-border bg-card p-1.5 shadow-[0_12px_32px_rgb(23_32_29_/_0.14)]">{ROLLOVER_RULES.map((rule) => { const selected = editor.rolloverRule === rule.value; return <button key={rule.value} type="button" role="option" aria-selected={selected} onClick={() => { setEditor((current) => current ? { ...current, rolloverRule: rule.value } : current); setRolloverOpen(false); }} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-[10px] px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 ${selected ? "bg-primary-soft text-primary" : "text-foreground hover:bg-surface-subtle"}`}><span className="min-w-0"><span className="block truncate text-sm font-semibold">{rule.label}</span><span className={`mt-0.5 block truncate text-[11px] font-medium ${selected ? "text-primary/75" : "text-muted-foreground"}`}>{rule.description}</span></span>{selected ? <Check aria-hidden="true" className="size-4 shrink-0" /> : null}</button>; })}</div> : null}</div>
        {editor.budget ? <button type="button" onClick={() => void remove()} disabled={saving} className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-expense"><Trash2 className="size-4" />Delete budget</button> : <p className="flex items-center gap-2 text-[11px] text-muted-foreground"><CalendarRange className="size-4" />Calendar periods reset automatically.</p>}
      </div> : null} />
      {categoryPickerOpen ? <CategoryPicker categories={expenseCategories} selectedId={editor?.categoryId ?? null} search={categorySearch} onSearchChange={setCategorySearch} onClose={() => setCategoryPickerOpen(false)} onSelect={(category) => { setEditor((current) => current ? { ...current, scope: "category", categoryId: category.id } : current); setCategoryPickerOpen(false); setCategorySearch(""); }} /> : null}
      {previousDrawerOpen ? <PreviousBudgetDrawer period={period} currency={currency} budgets={previousBudgets} periodStart={previousPeriodStart} periodEnd={previousPeriodEnd} loading={previousLoading} copying={previousCopying} error={previousError} onClose={() => setPreviousDrawerOpen(false)} onCopy={() => void copyPrevious()} /> : null}
      {savingsBudget ? <section className="mt-6 rounded-[16px] border border-primary/20 bg-primary-soft/30 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Savings target</p><p className="mt-1 text-sm text-foreground">Positive savings transactions count toward this plan.</p></div><p className="text-base font-semibold tabular-nums">{currency} {formatCurrencyAmount(savingsBudget.spent)} / {formatCurrencyAmount(savingsBudget.limitAmount)}</p></div></section> : null}
      {categoryBudgets.length > 1 ? <section className="mt-6 rounded-[16px] border border-border bg-card p-4"><div className="flex items-center gap-2"><ArrowRightLeft className="size-4 text-primary" /><h2 className="text-base font-semibold">Move money</h2></div><p className="mt-1 text-xs leading-5 text-muted-foreground">Adjust this month’s plan while keeping an audit trail.</p><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_110px_auto]"><label className="sr-only" htmlFor="budget-move-from">From category</label><select id="budget-move-from" name="moveFrom" aria-label="From category" value={moveFrom} onChange={(event) => setMoveFrom(event.target.value)} className="min-h-10 rounded-[10px] border border-border bg-card px-2 text-sm"><option value="">From category</option>{categoryBudgets.map((budget) => <option key={budget.id} value={budget.id}>{budget.name}</option>)}</select><label className="sr-only" htmlFor="budget-move-to">To category</label><select id="budget-move-to" name="moveTo" aria-label="To category" value={moveTo} onChange={(event) => setMoveTo(event.target.value)} className="min-h-10 rounded-[10px] border border-border bg-card px-2 text-sm"><option value="">To category</option>{categoryBudgets.filter((budget) => budget.id !== moveFrom).map((budget) => <option key={budget.id} value={budget.id}>{budget.name}</option>)}</select><label className="sr-only" htmlFor="budget-move-amount">Amount</label><input id="budget-move-amount" name="moveAmount" aria-label="Amount" inputMode="decimal" value={moveAmount} onChange={(event) => setMoveAmount(event.target.value)} placeholder="Amount" className="min-h-10 rounded-[10px] border border-border bg-card px-2 text-sm" /><button type="button" onClick={() => void moveMoney()} disabled={moveSaving} className="min-h-10 rounded-[10px] bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">{moveSaving ? "Moving…" : "Move"}</button></div></section> : null}
      {moves.filter((move) => !move.reversalOfId).length ? <section aria-labelledby="budget-move-history" className="mt-6 rounded-[16px] border border-border bg-card p-4"><div className="flex items-center gap-2"><ArrowRightLeft className="size-4 text-primary" /><h2 id="budget-move-history" className="text-base font-semibold">Recent adjustments</h2></div><div className="mt-3 divide-y divide-border rounded-[12px] border border-border">{moves.filter((move) => !move.reversalOfId).slice(0, 6).map((move) => { const fromName = budgets.find((budget) => budget.id === move.fromAllocationId)?.name ?? "Previous category"; const toName = budgets.find((budget) => budget.id === move.toAllocationId)?.name ?? "Current category"; return <div key={move.id} className="flex items-center justify-between gap-3 px-3 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-semibold">{currency} {formatCurrencyAmount(move.amount)} moved</p><p className="truncate text-[11px] text-muted-foreground">{fromName} → {toName}</p></div>{move.reversedAt ? <span className="shrink-0 text-xs font-semibold text-muted-foreground">Undone</span> : <button type="button" onClick={() => void reverseMove(move.id)} disabled={moveReversing === move.id} className="shrink-0 rounded-[9px] bg-primary-soft px-2.5 py-1.5 text-xs font-semibold text-primary disabled:opacity-50">{moveReversing === move.id ? "Undoing…" : "Undo"}</button>}</div>; })}</div></section> : null}
      {review ? <section className="mt-6 rounded-[16px] border border-border bg-card p-4"><h2 className="text-base font-semibold">Planned versus actual</h2><div className="mt-3 divide-y divide-border rounded-[12px] border border-border">{review.rows.filter((row) => row.kind === "expense" && row.categoryId).map((row) => <div key={`${row.kind}:${row.allocationId ?? row.name}`} className="flex items-center justify-between gap-3 px-3 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-semibold">{row.name}</p><p className="text-[11px] text-muted-foreground">Plan {currency} {formatCurrencyAmount(row.planned)} · Actual {currency} {formatCurrencyAmount(row.spent)}</p></div><span className={`shrink-0 text-xs font-semibold tabular-nums ${row.variance < 0 ? "text-expense" : "text-primary"}`}>{row.variance < 0 ? "Over " : "Under "}{currency} {formatCurrencyAmount(Math.abs(row.variance))}</span></div>)}{review.rows.filter((row) => row.kind === "expense" && row.categoryId).length === 0 ? <p className="px-3 py-4 text-sm text-muted-foreground">Add category plans to see a monthly review.</p> : null}</div></section> : null}
    </div></main>
  );
}
