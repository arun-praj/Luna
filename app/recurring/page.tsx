"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import { format } from "date-fns";
import { ArrowDownLeft, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, CalendarClock, CalendarDays, Check, ChevronDown, CirclePause, CirclePlay, Clock3, Landmark, Pencil, Plus, Repeat2, SkipForward, Target, X } from "lucide-react";

import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { PageHeader } from "@/components/layout/page-header";
import { GuideIcon } from "@/components/guides/feature-guide";
import { AccountAvatar } from "@/components/accounts/account-avatar";
import { Calendar } from "@/components/ui/calendar";
import { MoneyEditor } from "@/components/money/money-editor";
import { authenticatedFetch } from "@/lib/auth-client";
import { getAccountBackgroundColor, getAccountForeground } from "@/lib/account-appearance";
import { getCategoryIcon } from "@/lib/category-appearance";
import { formatCurrencyAmount } from "@/lib/currency";
import { PageDataSkeleton } from "@/components/ui/data-skeleton";
import { useUnsavedChangesGuard } from "@/components/ui/unsaved-changes-dialog";

type Account = { id: string; name: string; currency: string; type?: string; icon?: string | null; backgroundColor?: string | null; currentBalance?: number };
type Category = { id: string; name: string; type: string; icon?: string | null; color?: string | null };
type Goal = { id: string; name: string; monthlyContribution: number; accountId: string | null };
type Occurrence = { id: string; scheduledDate: string; status: "pending" | "posted" | "skipped" };
type Template = {
  id: string;
  title: string;
  type: "expense" | "income" | "savings" | "transfer";
  amount: number;
  accountId: string;
  account: Account | null;
  transferToAccount: Account | null;
  category: Category | null;
  notes: string | null;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  nextDueDate: string;
  endDate: string | null;
  approvalRequired: boolean;
  isActive: boolean;
  occurrences: Occurrence[];
  goal: Goal | null;
};

type FormState = {
  title: string;
  type: Template["type"];
  amount: string;
  accountId: string;
  categoryId: string;
  frequency: Template["frequency"];
  nextDueDate: string;
  endDate: string;
  approvalRequired: boolean;
  transferToAccountId: string;
  goalId: string;
  notes: string;
};

const typeMeta = {
  expense: { label: "Expense", tone: "text-expense", soft: "bg-expense-soft", sign: "−", icon: ArrowUpRight, description: "Money leaving an account" },
  income: { label: "Income", tone: "text-income", soft: "bg-income-soft", sign: "+", icon: ArrowDownLeft, description: "Money added to an account" },
  savings: { label: "Savings", tone: "text-info", soft: "bg-info-soft", sign: "→", icon: Landmark, description: "Set money aside" },
  transfer: { label: "Transfer", tone: "text-info", soft: "bg-info-soft", sign: "↔", icon: ArrowLeftRight, description: "Move money between accounts" },
} as const;

const frequencyLabels = { daily: "Every day", weekly: "Every week", monthly: "Every month", yearly: "Every year" } as const;

function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function emptyForm(accountId = ""): FormState {
  return { title: "", type: "expense", amount: "", accountId, categoryId: "", frequency: "monthly", nextDueDate: todayDate(), endDate: "", approvalRequired: true, transferToAccountId: "", goalId: "", notes: "" };
}

function templateToForm(template: Template): FormState {
  return { title: template.title, type: template.type, amount: String(template.amount), accountId: template.accountId, categoryId: template.category?.id ?? "", frequency: template.frequency, nextDueDate: template.nextDueDate, endDate: template.endDate ?? "", approvalRequired: template.approvalRequired, transferToAccountId: template.transferToAccount?.id ?? "", goalId: template.goal?.id ?? "", notes: template.notes ?? "" };
}

function isOverdue(template: Template, today: string) {
  return template.isActive && template.occurrences.some((occurrence) => occurrence.status === "pending" && occurrence.scheduledDate < today);
}

function pendingOccurrence(template: Template) {
  return template.occurrences.find((occurrence) => occurrence.status === "pending") ?? null;
}

function displayAmount(template: Template) {
  return `${typeMeta[template.type].sign} ${template.account?.currency ?? "NPR"} ${formatCurrencyAmount(template.amount)}`;
}

export default function RecurringPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [editorStep, setEditorStep] = useState<0 | 1 | 2>(0);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [editorInitial, setEditorInitial] = useState<string | null>(null);
  const formSnapshot = JSON.stringify(form);
  const { requestDiscard, discardDialog } = useUnsavedChangesGuard(editorInitial !== null && formSnapshot !== editorInitial);

  async function load() {
    setError("");
    const [templateResponse, accountResponse, categoryResponse] = await Promise.all([
      authenticatedFetch("/api/recurring-templates"),
      authenticatedFetch("/api/accounts"),
      authenticatedFetch("/api/categories"),
    ]);
    if (!templateResponse.ok || !accountResponse.ok || !categoryResponse.ok) throw new Error("Could not load recurring transactions.");
    const templateData = await templateResponse.json() as { recurringTemplates?: Template[] };
    const accountData = await accountResponse.json() as { accounts?: Account[] };
    const categoryData = await categoryResponse.json() as { categories?: Category[] };
    const goalResponse = await authenticatedFetch("/api/goals");
    const goalData = goalResponse.ok ? await goalResponse.json() as { goals?: Goal[] } : {};
    setTemplates(templateData.recurringTemplates ?? []);
    setAccounts(accountData.accounts ?? []);
    setCategories(categoryData.categories ?? []);
    setGoals(goalData.goals ?? []);
  }

  useEffect(() => {
    let active = true;
    const frame = window.requestAnimationFrame(() => {
      void load().catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load recurring transactions.");
      }).finally(() => {
        if (active) setIsLoading(false);
      });
    });
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const today = todayDate();
  const overdue = useMemo(() => templates.filter((template) => isOverdue(template, today)), [templates, today]);
  const upcoming = useMemo(() => templates.filter((template) => template.isActive && !isOverdue(template, today)), [templates, today]);
  const activeCount = templates.filter((template) => template.isActive).length;

  function openCreate() {
    setEditing(null);
    const nextForm = emptyForm(accounts[0]?.id ?? "");
    setEditorInitial(JSON.stringify(nextForm));
    setForm(nextForm);
    setEditorStep(0);
    setReviewing(false);
    setEditorOpen(true);
  }

  function openEdit(template: Template) {
    setEditing(template);
    const nextForm = templateToForm(template);
    setEditorInitial(JSON.stringify(nextForm));
    setForm(nextForm);
    setEditorStep(0);
    setReviewing(false);
    setEditorOpen(true);
  }

  async function saveTemplate(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!form.title.trim() || !Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0 || !form.accountId || !form.nextDueDate || (form.type === "transfer" && !form.transferToAccountId)) {
      setError(form.type === "transfer" && !form.transferToAccountId ? "Choose the account this transfer should move to." : "Add a name, amount, account, and next date before saving.");
      return;
    }
    setIsSaving(true);
    setError("");
    const payload = { ...form, amount: Number(form.amount), categoryId: form.categoryId || null, endDate: form.endDate || null, transferToAccountId: form.transferToAccountId || null, goalId: form.goalId || null, notes: form.notes || null };
    const response = await authenticatedFetch(editing ? `/api/recurring-templates/${editing.id}` : "/api/recurring-templates", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      setError(result.error ?? "Could not save recurring transaction.");
      setIsSaving(false);
      return;
    }
    const result = await response.json() as { recurringTemplates?: Template[] };
    if (result.recurringTemplates) setTemplates(result.recurringTemplates);
    setEditorOpen(false);
    setEditorInitial(null);
    setReviewing(false);
    setEditorStep(0);
    setIsSaving(false);
  }

  async function act(template: Template, action: "approve" | "post" | "skip" | "pause" | "resume", occurrenceId?: string) {
    setActingId(template.id);
    setError("");
    const response = await authenticatedFetch(`/api/recurring-templates/${template.id}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, occurrenceId }) });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      setError(result.error ?? "Could not update recurring transaction.");
    } else {
      await load();
    }
    setActingId(null);
  }

  if (isLoading) return <PageDataSkeleton label="Loading recurring transactions" />;

  if (reviewing) {
    return <ReviewPanel form={form} accounts={accounts} categories={categories} goals={goals} editing={Boolean(editing)} isSaving={isSaving} onBack={() => { setReviewing(false); setEditorStep(2); setEditorOpen(true); }} onEditStep={(step) => { setReviewing(false); setEditorStep(step); setEditorOpen(true); }} onSave={() => void saveTemplate()} />;
  }

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-12 sm:px-5">
        <StickyPageHeader className="-mx-4 px-4 pb-3 sm:-mx-5 sm:px-5">
          <PageHeader
            leading={<Link href="/" aria-label="Back to home" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><ArrowLeft aria-hidden="true" className="size-5" /></Link>}
            title={<div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Scheduled transactions</p><h1 className="text-[26px] font-semibold tracking-[-0.04em]">Recurring</h1></div>}
            secondary={<GuideIcon href="/recurring/guide" label="Recurring" />}
            actions={<button type="button" onClick={openCreate} aria-label="Add recurring transaction" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-primary/25 bg-primary-soft text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><Plus aria-hidden="true" className="size-5" /></button>}
          />
        </StickyPageHeader>

        <section aria-labelledby="recurring-overview-heading" className="mt-8 px-1">
          <div className="flex items-center gap-2"><Repeat2 aria-hidden="true" className="size-5 text-primary" /><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Overview</p><h2 id="recurring-overview-heading" className="mt-1 text-[21px] font-semibold tracking-[-0.035em]">Recurring transactions</h2></div></div>
          <div className="mt-5 grid grid-cols-3 border-y border-border/70"><div className="min-w-0 py-3 pr-3"><p className="text-[11px] text-muted-foreground">Active</p><p className="mt-1 text-xl font-semibold">{activeCount}</p></div><div className="min-w-0 border-l border-border/70 px-3 py-3"><p className="text-[11px] text-muted-foreground">Needs review</p><p className={`mt-1 text-xl font-semibold ${overdue.length ? "text-expense" : "text-income"}`}>{overdue.length}</p></div><div className="min-w-0 border-l border-border/70 py-3 pl-3"><p className="text-[11px] text-muted-foreground">Upcoming</p><p className="mt-1 text-xl font-semibold">{upcoming.length}</p></div></div>
        </section>

        {error ? <p role="alert" className="mt-4 rounded-[12px] bg-expense-soft px-3 py-2.5 text-sm font-medium text-expense">{error}</p> : null}

        {overdue.length ? <section className="mt-8"><SectionHeading icon={Clock3} title="Needs your attention" detail="Due and waiting for you" tone="expense" /> <div className="mt-3 space-y-3">{overdue.map((template) => <RecurringCard key={template.id} template={template} today={today} actingId={actingId} onEdit={openEdit} onAction={act} attention />)}</div></section> : null}

        <section className="mt-8"><SectionHeading icon={CalendarClock} title="Upcoming" detail="Your next scheduled moves" tone="primary" />{upcoming.length ? <div className="mt-3 space-y-3">{upcoming.map((template) => <RecurringCard key={template.id} template={template} today={today} actingId={actingId} onEdit={openEdit} onAction={act} />)}</div> : <EmptyState onAdd={openCreate} />}</section>

        {templates.some((template) => !template.isActive) ? <section className="mt-8"><SectionHeading icon={CirclePause} title="Paused" detail="Quiet for now" tone="muted" /><div className="mt-3 space-y-3">{templates.filter((template) => !template.isActive).map((template) => <RecurringCard key={template.id} template={template} today={today} actingId={actingId} onEdit={openEdit} onAction={act} />)}</div></section> : null}
      </div>

      {editorOpen ? <EditorDrawer form={form} setForm={setForm} accounts={accounts} categories={categories} goals={goals} editing={Boolean(editing)} step={editorStep} onStepChange={setEditorStep} onReview={() => { setEditorOpen(false); setReviewing(true); }} onClose={() => requestDiscard(() => { setEditorOpen(false); setEditorStep(0); setEditing(null); setEditorInitial(null); })} /> : null}
      {discardDialog}
    </main>
  );
}

function SectionHeading({ icon: Icon, title, detail, tone }: { icon: typeof CalendarClock; title: string; detail: string; tone: "primary" | "expense" | "muted" }) {
  const toneClass = tone === "expense" ? "bg-expense-soft text-expense" : tone === "muted" ? "bg-surface-subtle text-muted-foreground" : "bg-primary-soft text-primary";
  return <div className="flex items-center gap-3"><span className={`flex size-9 items-center justify-center rounded-[10px] ${toneClass}`}><Icon aria-hidden="true" className="size-[17px]" /></span><div><h2 className="text-[18px] font-semibold tracking-[-0.025em]">{title}</h2><p className="text-xs text-muted-foreground">{detail}</p></div></div>;
}

function RecurringCard({ template, today, actingId, onEdit, onAction, attention = false }: { template: Template; today: string; actingId: string | null; onEdit: (template: Template) => void; onAction: (template: Template, action: "approve" | "post" | "skip" | "pause" | "resume", occurrenceId?: string) => void; attention?: boolean }) {
  const meta = typeMeta[template.type];
  const occurrence = pendingOccurrence(template);
  const overdue = isOverdue(template, today);
  const busy = actingId === template.id;
  return <article className={`overflow-hidden rounded-[16px] border bg-card shadow-[0_8px_24px_rgb(23_32_29_/_0.04)] ${attention ? "border-expense/25" : "border-border"}`}>
    <div className="flex items-start gap-3 px-4 py-4"><span className={`flex size-10 shrink-0 items-center justify-center rounded-[11px] ${meta.soft} ${meta.tone}`}><Repeat2 aria-hidden="true" className="size-[18px]" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-[15px] font-semibold">{template.title || "Recurring transaction"}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{frequencyLabels[template.frequency]} · {template.account?.name ?? "Unknown account"}{template.transferToAccount ? ` → ${template.transferToAccount.name}` : ""}</p></div><p className={`shrink-0 text-[15px] font-semibold tabular-nums ${meta.tone}`}>{displayAmount(template)}</p></div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${overdue ? "bg-expense-soft text-expense" : "bg-surface-subtle text-muted-foreground"}`}>{overdue ? "Overdue" : "Next"} · {formatDate(occurrence?.scheduledDate ?? template.nextDueDate)}</span>{template.approvalRequired ? <span className="rounded-full bg-info-soft px-2.5 py-1 font-semibold text-info">Review before posting</span> : <span className="rounded-full bg-income-soft px-2.5 py-1 font-semibold text-income">Auto-posting</span>}</div></div></div>
    <div className="flex items-center justify-between gap-2 border-t border-border bg-background/60 px-4 py-2.5"><button type="button" onClick={() => onEdit(template)} className="inline-flex min-h-9 items-center gap-1.5 rounded-[9px] px-2 text-xs font-semibold text-muted-foreground hover:bg-surface-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><Pencil aria-hidden="true" className="size-3.5" />Edit</button><div className="flex items-center gap-1.5">{occurrence ? <><button type="button" disabled={busy} onClick={() => onAction(template, "skip", occurrence.id)} className="inline-flex min-h-9 items-center gap-1 rounded-[9px] px-2.5 text-xs font-semibold text-muted-foreground hover:bg-surface-subtle disabled:opacity-50"><SkipForward aria-hidden="true" className="size-3.5" />Skip</button><button type="button" disabled={busy} onClick={() => onAction(template, "approve", occurrence.id)} className="inline-flex min-h-9 items-center gap-1 rounded-[9px] bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover disabled:opacity-50"><Check aria-hidden="true" className="size-3.5" />{busy ? "Saving…" : template.approvalRequired ? "Approve & post" : "Post"}</button></> : null}<button type="button" disabled={busy} onClick={() => onAction(template, template.isActive ? "pause" : "resume")} aria-label={template.isActive ? "Pause recurring transaction" : "Resume recurring transaction"} className="flex size-9 items-center justify-center rounded-[9px] border border-border text-muted-foreground hover:bg-surface-subtle disabled:opacity-50">{template.isActive ? <CirclePause aria-hidden="true" className="size-4" /> : <CirclePlay aria-hidden="true" className="size-4" />}</button></div></div>
  </article>;
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return <div className="mt-3 rounded-[16px] border border-dashed border-primary/25 bg-primary-soft/35 px-5 py-7 text-center"><span className="mx-auto flex size-11 items-center justify-center rounded-[12px] bg-card text-primary shadow-sm"><Repeat2 aria-hidden="true" className="size-5" /></span><h3 className="mt-3 text-[16px] font-semibold">Nothing on repeat yet</h3><p className="mx-auto mt-1 max-w-[280px] text-xs leading-5 text-muted-foreground">Set up rent, salary, subscriptions, savings, or any payment you never want to forget.</p><button type="button" onClick={onAdd} className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover"><Plus aria-hidden="true" className="size-4" />Add recurring</button></div>;
}

function EditorDrawer({ form, setForm, accounts, categories, goals, editing, step, onStepChange, onReview, onClose }: { form: FormState; setForm: Dispatch<SetStateAction<FormState>>; accounts: Account[]; categories: Category[]; goals: Goal[]; editing: boolean; step: 0 | 1 | 2; onStepChange: (step: 0 | 1 | 2) => void; onReview: () => void; onClose: () => void }) {
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const [amountOpen, setAmountOpen] = useState(false);
  const [picker, setPicker] = useState<"type" | "category" | "frequency" | null>(null);
  const [datePicker, setDatePicker] = useState<"nextDueDate" | "endDate" | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const availableCategories = categories.filter((category) => form.type === "income" ? category.type === "income" : category.type === "expense");
  const selectedAccount = accounts.find((account) => account.id === form.accountId) ?? null;
  const targetAccounts = accounts.filter((account) => account.id !== form.accountId);
  const selectedCategory = categories.find((category) => category.id === form.categoryId) ?? null;
  const selectedType = typeMeta[form.type];

  const updateType = (type: FormState["type"]) => {
    update("type", type);
    update("categoryId", "");
    update("transferToAccountId", "");
    if (type !== "savings") update("goalId", "");
    setPicker(null);
  };

  const openDatePicker = (field: "nextDueDate" | "endDate") => {
    const value = form[field];
    setCalendarMonth(value ? new Date(`${value}T12:00:00`) : new Date());
    setDatePicker(field);
  };

  const selectDate = (selected: Date | undefined) => {
    if (!selected || !datePicker) return;
    update(datePicker, format(selected, "yyyy-MM-dd"));
  };

  return <div className="fixed inset-0 z-50 flex items-end bg-foreground/25" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="recurring-editor-title" onPointerDown={(event) => event.stopPropagation()} className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[24px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)] sm:mx-auto sm:max-w-[720px] sm:px-5">
      <div className="mx-auto h-1 w-10 rounded-full bg-border-strong/70" />
      <header className="flex items-center justify-between gap-3 py-3">
        <div><p className="text-xs font-medium text-muted-foreground">Recurring setup · Step {step + 1} of 3</p><h2 id="recurring-editor-title" className="text-xl font-semibold tracking-[-0.03em]">{editing ? "Edit recurring transaction" : "Add recurring transaction"}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close recurring editor" className="flex size-10 items-center justify-center rounded-[10px] border border-border bg-card text-foreground"><X aria-hidden="true" className="size-4" /></button>
      </header>
      <div className="mb-5 grid grid-cols-3 gap-1.5" aria-label="Recurring setup progress">{[0, 1, 2].map((item) => <span key={item} className={`h-1.5 rounded-full ${item <= step ? "bg-primary" : "bg-border"}`} />)}</div>

      {step === 0 ? <div className="space-y-5">
        <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Start with the movement</p><h3 className="mt-1 text-[24px] font-semibold tracking-[-0.04em]">What is it?</h3><p className="mt-1 text-sm text-muted-foreground">Tell Luna what should happen automatically.</p></div>
        <label className="block"><span className="text-xs font-semibold text-muted-foreground">Name</span><input required value={form.title} onChange={(event) => update("title", event.target.value)} className="mt-1.5 h-12 w-full rounded-[12px] border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="Rent, salary, Netflix" /></label>
        <div><p className="text-xs font-semibold text-muted-foreground">Type</p><button type="button" onClick={() => setPicker("type")} className="mt-1.5 flex min-h-14 w-full items-center gap-3 rounded-[13px] border border-border bg-card px-3 text-left shadow-sm transition-colors hover:border-primary/45"><span className={`flex size-10 shrink-0 items-center justify-center rounded-[11px] ${selectedType.soft} ${selectedType.tone}`}><selectedType.icon aria-hidden="true" className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{selectedType.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{selectedType.description}</span></span><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" /></button></div>
        <AccountRail label={form.type === "income" ? "Add money to" : "Pay money from"} accounts={accounts} selectedId={form.accountId} onSelect={(id) => update("accountId", id)} />
        <div><p className="text-xs font-semibold text-muted-foreground">Amount</p><button type="button" onClick={() => setAmountOpen(true)} className={`mt-1.5 flex min-h-[76px] w-full items-center justify-between rounded-[14px] border px-4 text-left transition-colors ${form.amount ? "border-primary/35 bg-primary-soft/45" : "border-dashed border-primary/40 bg-card hover:bg-primary-soft/30"}`}><span><span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{selectedAccount?.currency ?? "Account currency"}</span><span className="mt-1 block text-[27px] font-semibold tabular-nums tracking-[-0.04em]">{form.amount ? Number(form.amount).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "Enter amount"}</span></span><ArrowRight aria-hidden="true" className="size-5 text-primary" /></button></div>
        <button type="button" disabled={!form.title.trim() || !form.accountId || Number(form.amount) <= 0} onClick={() => onStepChange(1)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45">Continue <ArrowRight aria-hidden="true" className="size-4" /></button>
      </div> : null}

      {step === 1 ? <div className="space-y-5">
        <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Make it specific</p><h3 className="mt-1 text-[24px] font-semibold tracking-[-0.04em]">Add the details</h3><p className="mt-1 text-sm text-muted-foreground">You can always change these later.</p></div>
        {form.type === "transfer" ? <AccountRail label="Move money to" accounts={targetAccounts} selectedId={form.transferToAccountId} onSelect={(id) => update("transferToAccountId", id)} /> : form.type === "savings" ? <label className="block"><span className="text-xs font-semibold text-muted-foreground">Goal <span className="font-normal">(optional)</span></span><select value={form.goalId} onChange={(event) => { const goal = goals.find((item) => item.id === event.target.value); update("goalId", event.target.value); if (goal?.monthlyContribution) update("amount", String(goal.monthlyContribution)); }} className="mt-1.5 h-14 w-full rounded-[13px] border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"><option value="">No linked goal</option>{goals.filter((goal) => goal.accountId !== form.accountId).map((goal) => <option key={goal.id} value={goal.id}>{goal.name}{goal.monthlyContribution ? ` · ${goal.monthlyContribution}/month` : ""}</option>)}</select><span className="mt-1.5 block text-xs text-muted-foreground">Selecting a goal uses its monthly set-aside as the recurring amount.</span></label> : <div><p className="text-xs font-semibold text-muted-foreground">Category <span className="font-normal">(optional)</span></p><button type="button" onClick={() => setPicker("category")} className="mt-1.5 flex min-h-14 w-full items-center gap-3 rounded-[13px] border border-border bg-card px-3 text-left shadow-sm transition-colors hover:border-primary/45"><span className={`flex size-10 shrink-0 items-center justify-center rounded-[11px] ${selectedCategory ? "bg-primary-soft text-primary" : "bg-surface-subtle text-muted-foreground"}`}>{selectedCategory ? (() => { const Icon = getCategoryIcon(selectedCategory.icon, selectedCategory.name); return <Icon aria-hidden="true" className="size-5" />; })() : <Target aria-hidden="true" className="size-5" />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{selectedCategory?.name ?? "No category"}</span><span className="mt-0.5 block text-xs text-muted-foreground">{selectedCategory ? "Used to organize upcoming activity" : "Keep this item uncategorized"}</span></span><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" /></button></div>}
        <div className="rounded-[14px] bg-primary-soft/45 px-4 py-3 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{form.amount ? Number(form.amount).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0"} {selectedAccount?.currency ?? "NPR"}</span> will repeat from <span className="font-semibold text-foreground">{selectedAccount?.name ?? "your account"}</span>.</div>
        <div className="flex gap-2"><button type="button" onClick={() => onStepChange(0)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[12px] border border-border bg-card px-4 text-sm font-semibold"><ArrowLeft aria-hidden="true" className="size-4" />Back</button><button type="button" disabled={form.type === "transfer" && !form.transferToAccountId} onClick={() => onStepChange(2)} className="flex min-h-12 flex-[1.5] items-center justify-center gap-2 rounded-[12px] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45">Continue <ArrowRight aria-hidden="true" className="size-4" /></button></div>
      </div> : null}

      {step === 2 ? <div className="space-y-5">
        <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Set the rhythm</p><h3 className="mt-1 text-[24px] font-semibold tracking-[-0.04em]">When should it repeat?</h3><p className="mt-1 text-sm text-muted-foreground">Choose the schedule and we’ll show every upcoming occurrence.</p></div>
        <PickerButton label="Repeats" value={frequencyLabels[form.frequency]} icon={<Repeat2 aria-hidden="true" className="size-5" />} onClick={() => setPicker("frequency")} />
        <DateButton label="Next date" value={form.nextDueDate} onClick={() => openDatePicker("nextDueDate")} required />
        <DateButton label="End date" value={form.endDate} onClick={() => openDatePicker("endDate")} />
        <label className="flex cursor-pointer items-start gap-3 rounded-[13px] border border-border bg-card px-3 py-3.5"><input type="checkbox" checked={form.approvalRequired} onChange={(event) => update("approvalRequired", event.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" /><span><span className="block text-sm font-semibold">Ask before posting</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">Keep each occurrence in review until you approve it.</span></span></label>
        <label className="block"><span className="text-xs font-semibold text-muted-foreground">Note <span className="font-normal">(optional)</span></span><textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={2} className="mt-1.5 w-full resize-none rounded-[12px] border border-border bg-card px-3 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="Add a helpful note" /></label>
        <div className="flex gap-2"><button type="button" onClick={() => onStepChange(1)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[12px] border border-border bg-card px-4 text-sm font-semibold"><ArrowLeft aria-hidden="true" className="size-4" />Back</button><button type="button" onClick={onReview} className="flex min-h-12 flex-[1.5] items-center justify-center gap-2 rounded-[12px] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover"><Check aria-hidden="true" className="size-4" />Review</button></div>
      </div> : null}
    </section>
    <MoneyEditor open={amountOpen} value={form.amount || "0"} title="Enter recurring amount" currency={selectedAccount?.currency ?? "NPR"} confirmPlacement="bottom" confirmLabel="Continue" confirmDisabled={(value) => !Number.isFinite(Number(value)) || Number(value) <= 0} cancelVariant="text" cancelLabel="Cancel" onCancel={() => setAmountOpen(false)} onSet={(value) => { update("amount", value); setAmountOpen(false); }} />
    {picker ? <PickerSheet picker={picker} form={form} categories={availableCategories} onClose={() => setPicker(null)} onType={updateType} onCategory={(value) => { update("categoryId", value); setPicker(null); }} onFrequency={(value) => { update("frequency", value); setPicker(null); }} /> : null}
    {datePicker ? <DatePickerSheet field={datePicker} value={form[datePicker]} month={calendarMonth} onMonthChange={setCalendarMonth} onSelect={selectDate} onClear={() => update(datePicker, "")} onClose={() => setDatePicker(null)} /> : null}
  </div>;
}

function AccountRail({ label, accounts, selectedId, onSelect }: { label: string; accounts: Account[]; selectedId: string; onSelect: (id: string) => void }) {
  return <div><p className="text-xs font-semibold text-muted-foreground">{label}</p><div className="mt-1.5 flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{accounts.map((account) => { const selected = account.id === selectedId; const background = getAccountBackgroundColor(account.backgroundColor, account.type); const foreground = getAccountForeground(background, account.type); return <button key={account.id} type="button" aria-pressed={selected} onClick={() => onSelect(account.id)} style={{ backgroundColor: selected ? background : undefined, borderColor: `${foreground}8c`, color: foreground }} className="flex min-h-14 shrink-0 items-center gap-2 rounded-[12px] border bg-card px-3 text-left text-sm font-semibold transition-colors hover:brightness-[0.98]"><span className="flex size-9 shrink-0 overflow-hidden rounded-[9px]"><AccountAvatar icon={account.icon} name={account.name} type={account.type ?? "wallet"} backgroundColor={background} size={36} /></span><span className="flex min-w-0 flex-col items-start leading-tight"><span className="max-w-[145px] truncate">{account.name.replace(" Wallet", "").replace(" account", "")}</span><span className="mt-1 text-[11px] font-medium tabular-nums opacity-75">{account.currency}{account.currentBalance == null ? "" : ` ${account.currentBalance.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}</span></span>{selected ? <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background"><Check aria-hidden="true" className="size-3.5 stroke-[3]" /></span> : null}</button>; })}{accounts.length === 0 ? <p className="rounded-[12px] bg-surface-subtle px-3 py-3 text-xs text-muted-foreground">No accounts available.</p> : null}</div></div>;
}

function PickerButton({ label, value, icon, onClick }: { label: string; value: string; icon: ReactNode; onClick: () => void }) {
  return <div><p className="text-xs font-semibold text-muted-foreground">{label}</p><button type="button" onClick={onClick} className="mt-1.5 flex min-h-14 w-full items-center gap-3 rounded-[13px] border border-border bg-card px-3 text-left shadow-sm transition-colors hover:border-primary/45"><span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-primary-soft text-primary">{icon}</span><span className="min-w-0 flex-1 text-sm font-semibold">{value}</span><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" /></button></div>;
}

function DateButton({ label, value, required = false, onClick }: { label: string; value: string; required?: boolean; onClick: () => void }) {
  return <div><p className="text-xs font-semibold text-muted-foreground">{label} {!required ? <span className="font-normal">(optional)</span> : null}</p><button type="button" onClick={onClick} className="mt-1.5 flex min-h-14 w-full items-center gap-3 rounded-[13px] border border-border bg-card px-3 text-left shadow-sm transition-colors hover:border-primary/45"><span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-primary-soft text-primary"><CalendarDays aria-hidden="true" className="size-5" /></span><span className={`min-w-0 flex-1 text-sm font-semibold ${value ? "text-foreground" : "text-muted-foreground"}`}>{value ? format(new Date(`${value}T12:00:00`), "MMM d, yyyy") : "Choose a date"}</span><ArrowRight aria-hidden="true" className="size-4 text-primary" /></button></div>;
}

function PickerSheet({ picker, form, categories, onClose, onType, onCategory, onFrequency }: { picker: "type" | "category" | "frequency"; form: FormState; categories: Category[]; onClose: () => void; onType: (value: FormState["type"]) => void; onCategory: (value: string) => void; onFrequency: (value: FormState["frequency"]) => void }) {
  const title = picker === "type" ? "Choose type" : picker === "category" ? "Choose category" : "Repeats";
  return <div role="dialog" aria-modal="true" aria-labelledby="recurring-picker-title" className="fixed inset-0 z-[80] flex items-end bg-foreground/25" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="max-h-[78dvh] w-full overflow-y-auto rounded-t-[24px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)]" onPointerDown={(event) => event.stopPropagation()}><div className="mx-auto h-1 w-10 rounded-full bg-border-strong/70" /><header className="flex items-center justify-between gap-3 py-3"><div><p className="text-xs font-medium text-muted-foreground">Recurring setup</p><h2 id="recurring-picker-title" className="text-xl font-semibold tracking-[-0.03em]">{title}</h2></div><button type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} className="flex size-10 items-center justify-center rounded-[10px] border border-border bg-card"><X aria-hidden="true" className="size-4" /></button></header><div className="grid gap-2">{picker === "type" ? (Object.entries(typeMeta) as Array<[FormState["type"], typeof typeMeta[FormState["type"]]]>).map(([value, meta]) => { const Icon = meta.icon; const selected = form.type === value; return <button type="button" key={value} aria-pressed={selected} onClick={() => onType(value)} className={`flex min-h-14 items-center gap-3 rounded-[13px] border px-3 text-left ${selected ? "border-primary bg-primary-soft" : "border-border bg-card"}`}><span className={`flex size-10 items-center justify-center rounded-[11px] ${meta.soft} ${meta.tone}`}><Icon aria-hidden="true" className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{meta.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{meta.description}</span></span>{selected ? <Check aria-hidden="true" className="size-5 text-primary" /> : null}</button>; }) : picker === "frequency" ? (Object.entries(frequencyLabels) as Array<[FormState["frequency"], string]>).map(([value, label]) => <button type="button" key={value} aria-pressed={form.frequency === value} onClick={() => onFrequency(value)} className={`flex min-h-12 items-center justify-between rounded-[12px] border px-4 text-left text-sm font-semibold ${form.frequency === value ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}>{label}{form.frequency === value ? <Check aria-hidden="true" className="size-4" /> : null}</button>) : [<button type="button" key="none" aria-pressed={!form.categoryId} onClick={() => onCategory("")} className={`flex min-h-12 items-center justify-between rounded-[12px] border px-4 text-left text-sm font-semibold ${!form.categoryId ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}>No category{!form.categoryId ? <Check aria-hidden="true" className="size-4" /> : null}</button>, ...categories.map((category) => { const Icon = getCategoryIcon(category.icon, category.name); const selected = form.categoryId === category.id; return <button type="button" key={category.id} aria-pressed={selected} onClick={() => onCategory(category.id)} className={`flex min-h-12 items-center gap-3 rounded-[12px] border px-3 text-left text-sm font-semibold ${selected ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}><span className="flex size-8 items-center justify-center rounded-[9px] bg-surface-subtle"><Icon aria-hidden="true" className="size-4" /></span><span className="min-w-0 flex-1 truncate">{category.name}</span>{selected ? <Check aria-hidden="true" className="size-4" /> : null}</button>; })]}</div></section></div>;
}

function DatePickerSheet({ field, value, month, onMonthChange, onSelect, onClear, onClose }: { field: "nextDueDate" | "endDate"; value: string; month: Date; onMonthChange: (month: Date) => void; onSelect: (date: Date | undefined) => void; onClear: () => void; onClose: () => void }) {
  return <div role="dialog" aria-modal="true" aria-labelledby="recurring-date-title" className="fixed inset-0 z-[80] flex items-end bg-foreground/25" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="flex max-h-[88dvh] w-full flex-col rounded-t-[24px] border-t border-border bg-background shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)]" onPointerDown={(event) => event.stopPropagation()}><div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-foreground/20" /><header className="flex shrink-0 items-center justify-between border-b border-border px-4 pb-3 pt-3"><button type="button" onClick={onClose} aria-label="Close date picker" className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card"><X aria-hidden="true" className="size-5" /></button><h2 id="recurring-date-title" className="text-base font-semibold">{field === "nextDueDate" ? "Choose next date" : "Choose end date"}</h2><button type="button" onClick={onClose} className="rounded-[10px] bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">Done</button></header><div className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"><div className="w-full max-w-[420px] space-y-3"><Calendar mode="single" month={month} onMonthChange={onMonthChange} selected={value ? new Date(`${value}T12:00:00`) : undefined} modifiers={{ today: new Date() }} onSelect={onSelect} className="w-full rounded-[18px] border border-border bg-card p-4 shadow-[0_18px_50px_rgb(23_32_29_/_0.10)] [--cell-size:2.5rem] min-[420px]:[--cell-size:2.75rem]" />{value ? <div className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">{format(new Date(`${value}T12:00:00`), "EEEE, MMM d, yyyy")}</p><button type="button" onClick={() => { onClear(); onClose(); }} className="shrink-0 text-xs font-semibold text-primary">Clear</button></div> : null}</div></div></section></div>;
}

function ReviewPanel({ form, accounts, categories, goals, editing, isSaving, onBack, onEditStep, onSave }: { form: FormState; accounts: Account[]; categories: Category[]; goals: Goal[]; editing: boolean; isSaving: boolean; onBack: () => void; onEditStep: (step: 0 | 1 | 2) => void; onSave: () => void }) {
  const account = accounts.find((item) => item.id === form.accountId);
  const target = accounts.find((item) => item.id === form.transferToAccountId);
  const category = categories.find((item) => item.id === form.categoryId);
  const goal = goals.find((item) => item.id === form.goalId);
  const meta = typeMeta[form.type];
  return <main className="min-h-dvh bg-background"><div className="mx-auto w-full max-w-[720px] px-4 pb-12 sm:px-5"><StickyPageHeader className="-mx-4 flex items-center justify-between gap-3 px-4 pb-3 sm:-mx-5 sm:px-5"><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={onBack} aria-label="Back to recurring setup" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card"><ArrowLeft aria-hidden="true" className="size-5" /></button><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Recurring setup</p><h1 className="truncate text-[25px] font-semibold tracking-[-0.04em]">Review {editing ? "changes" : "recurring"}</h1></div></div><button type="button" disabled={isSaving} onClick={onSave} className="inline-flex min-h-11 items-center gap-1.5 rounded-[11px] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover disabled:opacity-60">{isSaving ? "Saving…" : "Save"}<Check aria-hidden="true" className="size-4" /></button></StickyPageHeader><section className="mt-6 overflow-hidden rounded-[22px] bg-primary-soft/55 shadow-[0_12px_30px_rgb(23_32_29_/_0.05)]"><div className="flex items-start gap-3 px-5 pb-5 pt-5"><span className={`flex size-12 shrink-0 items-center justify-center rounded-[14px] ${meta.soft} ${meta.tone}`}><meta.icon aria-hidden="true" className="size-6" /></span><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">{meta.label} · ready to repeat</p><h2 className="mt-1 truncate text-[27px] font-semibold tracking-[-0.05em]">{form.title || "Recurring transaction"}</h2><p className={`mt-2 text-[24px] font-semibold tabular-nums tracking-[-0.03em] ${meta.tone}`}>{meta.sign} {account?.currency ?? "NPR"} {Number(form.amount || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}</p></div></div><div className="border-t border-primary/15 bg-background/45 px-5"><div className="grid grid-cols-2 gap-x-5"><ReviewRow label="Type" value={meta.label} onEdit={() => onEditStep(0)} /><ReviewRow label="Repeats" value={frequencyLabels[form.frequency]} onEdit={() => onEditStep(2)} /><ReviewRow label={form.type === "transfer" ? "Move from" : "Account"} value={account?.name ?? "Not selected"} onEdit={() => onEditStep(0)} /><ReviewRow label={form.type === "transfer" ? "Move to" : form.type === "savings" ? "Goal" : "Category"} value={form.type === "transfer" ? target?.name ?? "Not selected" : form.type === "savings" ? goal?.name ?? "No linked goal" : category?.name ?? "No category"} onEdit={() => onEditStep(1)} /><ReviewRow label="Next date" value={form.nextDueDate ? format(new Date(`${form.nextDueDate}T12:00:00`), "MMM d, yyyy") : "Not selected"} onEdit={() => onEditStep(2)} /><ReviewRow label="End date" value={form.endDate ? format(new Date(`${form.endDate}T12:00:00`), "MMM d, yyyy") : "No end date"} onEdit={() => onEditStep(2)} /></div></div></section><div className="mt-5 flex items-start gap-3 rounded-[14px] bg-surface-subtle px-4 py-3.5 text-xs leading-5 text-muted-foreground"><Repeat2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><p>{form.approvalRequired ? "Each occurrence will wait for your approval before posting." : "Occurrences will post automatically on their scheduled dates."}</p></div>{form.notes ? <section className="mt-4 rounded-[14px] border border-border bg-card px-4 py-3"><p className="text-xs font-semibold text-muted-foreground">Note</p><p className="mt-1 text-sm leading-6">{form.notes}</p></section> : null}</div></main>;
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return <button type="button" onClick={onEdit} className="group flex min-w-0 items-center justify-between gap-2 border-b border-primary/15 py-3 text-left transition-colors hover:border-primary/45"><span className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">{label}</span><span className="mt-1 block truncate text-[13px] font-semibold">{value}</span></span><span className="flex size-7 shrink-0 items-center justify-center rounded-full text-primary opacity-70 transition-colors group-hover:bg-primary-soft group-hover:opacity-100"><Pencil aria-hidden="true" className="size-3.5" /></span></button>;
}
