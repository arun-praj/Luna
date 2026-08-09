"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, Check, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { AccountAvatar } from "@/components/accounts/account-avatar";
import { Calendar } from "@/components/ui/calendar";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { getAccountBackgroundColor, getAccountForeground } from "@/lib/account-appearance";
import { authenticatedFetch } from "@/lib/auth-client";
import { getReturnTo } from "@/lib/navigation";
import { useAnimatedVisibility } from "@/lib/use-animated-visibility";
import { useUnsavedChangesGuard } from "@/components/ui/unsaved-changes-dialog";

type Account = { id: string; name: string; type: string; currency: string; icon: string | null; backgroundColor: string | null; currentBalance: number; isDefault?: boolean };

function money(value: number, currency: string) {
  return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export default function NewGoalPage() {
  const router = useRouter();
  const [backHref] = useState(() => typeof window === "undefined" ? "/goals" : getReturnTo("/goals"));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [initialDraft, setInitialDraft] = useState<string | null>(null);
  const dateTransition = useAnimatedVisibility(dateOpen);

  const draftSnapshot = JSON.stringify({ name, targetAmount, monthlyContribution, targetDate, accountId });
  const { requestDiscard, discardDialog } = useUnsavedChangesGuard(initialDraft !== null && draftSnapshot !== initialDraft);

  useEffect(() => {
    if (!accounts.length || initialDraft !== null) return;
    const frame = window.requestAnimationFrame(() => setInitialDraft(draftSnapshot));
    return () => window.cancelAnimationFrame(frame);
  }, [accounts.length, draftSnapshot, initialDraft]);

  useEffect(() => {
    void authenticatedFetch("/api/accounts").then(async (response) => {
      if (!response.ok) throw new Error("Could not load accounts.");
      const result = await response.json() as { accounts?: Account[] };
      const next = result.accounts ?? [];
      setAccounts(next);
      setAccountId(next.find((account) => account.isDefault)?.id ?? next[0]?.id ?? "");
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load accounts."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(targetAmount);
    const monthlyAmount = Number(monthlyContribution || 0);
    if (!name.trim() || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(monthlyAmount) || monthlyAmount < 0 || !accountId) {
      setError("Add a name, target amount, and goal account.");
      return;
    }
    setSaving(true);
    setError("");
    const response = await authenticatedFetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), targetAmount: amount, monthlyContribution: monthlyAmount, targetDate: targetDate || null, accountId }),
    }).catch(() => null);
    if (!response?.ok) {
      const result = await response?.json().catch(() => null) as { error?: string } | null;
      setError(result?.error ?? "Could not create this goal.");
      setSaving(false);
      return;
    }
    const result = await response.json() as { goal?: { id: string } };
    router.push(result.goal?.id ? `/goals/${result.goal.id}` : "/goals");
  }

  const selectedAccount = accounts.find((account) => account.id === accountId);
  const openDatePicker = () => {
    setCalendarMonth(targetDate ? new Date(`${targetDate}T12:00:00`) : new Date());
    setDateOpen(true);
  };

  return <main className="page-route-enter min-h-dvh bg-background"><div className="mx-auto w-full max-w-[560px] px-4 pb-12 sm:px-5">
    <StickyPageHeader className="-mx-4 flex items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5"><Link href={backHref} aria-label="Back to goals" onClick={(event) => { event.preventDefault(); requestDiscard(() => router.push(backHref)); }} className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card"><ArrowLeft aria-hidden="true" className="size-5" /></Link><div><p className="text-xs font-medium text-muted-foreground">Goals</p><h1 className="text-[25px] font-semibold tracking-[-0.04em]">New goal</h1></div></StickyPageHeader>
    <h2 className="mt-8 px-1 text-[22px] font-semibold tracking-[-0.04em]">Give your money a destination</h2>
    <form onSubmit={submit} className="mt-5 space-y-5 rounded-[18px] border border-border bg-card p-4 sm:p-5">
      {error ? <p role="alert" className="rounded-[12px] border border-expense/25 bg-expense-soft px-3 py-2.5 text-sm font-medium text-expense">{error}</p> : null}
      <label className="block"><span className="block text-xs font-semibold text-muted-foreground">Goal name</span><p className="mb-1.5 mt-1 text-xs text-muted-foreground">What are you saving for?</p><input required value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="h-12 w-full rounded-[11px] border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>
      <label className="block"><span className="block text-xs font-semibold text-muted-foreground">Target amount</span><p className="mb-1.5 mt-1 text-xs text-muted-foreground">How much do you want to save?</p><input required inputMode="decimal" type="number" min="0.01" step="0.01" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} className="h-12 w-full rounded-[11px] border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>
      <label className="block"><span className="block text-xs font-semibold text-muted-foreground">Monthly set-aside</span><p className="mb-1.5 mt-1 text-xs text-muted-foreground">How much do you want to set aside for this goal per month?</p><input inputMode="decimal" type="number" min="0" step="0.01" value={monthlyContribution} onChange={(event) => setMonthlyContribution(event.target.value)} placeholder="Optional" className="h-12 w-full rounded-[11px] border border-border bg-background px-3 text-sm font-medium outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>
      <fieldset className="min-w-0">
        <legend className="text-xs font-semibold text-muted-foreground">Goal account{selectedAccount ? <span className="ml-2 font-semibold text-muted-foreground">· {selectedAccount.currency}</span> : null}</legend>
        <div className="mt-2 flex min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain px-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {accounts.map((account) => {
            const selected = account.id === accountId;
            const accountColor = getAccountBackgroundColor(account.backgroundColor, account.type);
            const accountForeground = getAccountForeground(accountColor, account.type);
            return <button key={account.id} type="button" aria-pressed={selected} onClick={() => setAccountId(account.id)} style={{ backgroundColor: selected ? accountColor : undefined, borderColor: `${accountForeground}8c`, color: accountForeground }} className="flex min-h-14 shrink-0 items-center gap-2 rounded-[12px] border bg-card px-3 text-sm font-semibold transition-colors hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><span className="flex size-10 shrink-0 overflow-hidden rounded-[10px]"><AccountAvatar icon={account.icon} name={account.name} type={account.type} backgroundColor={accountColor} size={40} /></span><span className="flex min-w-0 flex-col items-start leading-tight"><span className="max-w-[145px] truncate">{account.name.replace(" Wallet", "").replace(" account", "")}</span><span className="mt-1 text-[11px] font-medium tabular-nums opacity-75">{money(account.currentBalance, account.currency)}</span></span>{selected ? <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background"><Check aria-hidden="true" className="size-3.5 stroke-[3]" /></span> : null}</button>;
          })}
        </div>
        {accounts.length === 0 ? <p className="mt-2 rounded-[12px] bg-surface-subtle px-3 py-2 text-xs text-muted-foreground">Create an account before creating a goal.</p> : <p className="mt-2 text-xs leading-5 text-muted-foreground">This becomes the goal’s holding account. It cannot be the source account for its own contributions.</p>}
      </fieldset>
      <div><p className="text-xs font-semibold text-muted-foreground">Target date (optional)</p><button type="button" aria-label="Choose target date" onClick={openDatePicker} className="mt-1.5 flex h-12 w-full items-center gap-3 rounded-[11px] border border-border bg-background px-3 text-left text-sm font-medium outline-none transition-colors hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/20"><CalendarDays aria-hidden="true" className="size-4 shrink-0 text-primary" /><span className={targetDate ? "text-foreground" : "text-muted-foreground"}>{targetDate ? format(new Date(`${targetDate}T12:00:00`), "MMM d, yyyy") : "Choose a target date"}</span></button></div>
      <button type="submit" disabled={saving || !accounts.length} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">{saving ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}{saving ? "Creating goal…" : "Create goal"}</button>
    </form>
    {dateTransition.mounted ? <div role="presentation" className={`fixed inset-0 z-[70] flex items-end bg-foreground/25 ${dateTransition.closing ? "drawer-scrim-exit" : "drawer-scrim-enter"}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setDateOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="goal-target-date-title" className={`flex max-h-[88dvh] w-full flex-col rounded-t-[24px] border-t border-border bg-background shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)] ${dateTransition.closing ? "drawer-exit" : "drawer-enter"}`} onMouseDown={(event) => event.stopPropagation()}><div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-foreground/20" aria-hidden="true" /><header className="flex shrink-0 items-center justify-between border-b border-border px-4 pb-3 pt-3"><button type="button" aria-label="Close target date picker" onClick={() => setDateOpen(false)} className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card text-foreground"><X aria-hidden="true" className="size-5" /></button><h2 id="goal-target-date-title" className="text-base font-semibold">Choose target date</h2><button type="button" onClick={() => setDateOpen(false)} className="rounded-[10px] bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">Done</button></header><div className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"><div className="w-full max-w-[420px] space-y-3"><Calendar mode="single" month={calendarMonth} onMonthChange={setCalendarMonth} selected={targetDate ? new Date(`${targetDate}T12:00:00`) : undefined} modifiers={{ today: new Date() }} onSelect={(selected) => { if (selected) setTargetDate(format(selected, "yyyy-MM-dd")); }} className="w-full rounded-[18px] border border-border bg-card p-4 shadow-[0_18px_50px_rgb(23_32_29_/_0.10)] [--cell-size:2.5rem] min-[420px]:[--cell-size:2.75rem]" /><div className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">Pick the date you want to reach this goal.</p>{targetDate ? <button type="button" onClick={() => setTargetDate("")} className="shrink-0 text-xs font-semibold text-primary">Clear</button> : null}</div></div></div></section></div> : null}
    {discardDialog}
  </div></main>;
}
