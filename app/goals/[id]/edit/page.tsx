"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Check, LoaderCircle, Target } from "lucide-react";
import { useRouter } from "next/navigation";

import { AccountAvatar } from "@/components/accounts/account-avatar";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { getAccountBackgroundColor, getAccountForeground } from "@/lib/account-appearance";
import { authenticatedFetch } from "@/lib/auth-client";
import { getReturnTo } from "@/lib/navigation";

type Goal = { id: string; name: string; targetAmount: number; targetDate: string | null; allocatedAmount: number; accountId: string | null };
type Account = { id: string; name: string; type: string; currency: string; icon: string | null; backgroundColor: string | null; currentBalance: number; isDefault?: boolean };

function money(value: number, currency: string) {
  return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export default function EditGoalPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [goalId, setGoalId] = useState("");
  const [goal, setGoal] = useState<Goal | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [backHref] = useState(() => typeof window === "undefined" ? "/goals" : getReturnTo("/goals"));
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { void params.then(({ id }) => setGoalId(id)); }, [params]);

  useEffect(() => {
    if (!goalId) return;
    void Promise.all([authenticatedFetch(`/api/goals/${goalId}`), authenticatedFetch("/api/accounts")]).then(async ([goalResponse, accountResponse]) => {
      if (!goalResponse.ok) throw new Error("Could not load this goal.");
      const result = await goalResponse.json() as { goal: Goal };
      const accountsResult = accountResponse.ok ? await accountResponse.json() as { accounts?: Account[] } : {};
      setGoal(result.goal);
      setAccounts(accountsResult.accounts ?? []);
      setName(result.goal.name);
      setTargetAmount(String(result.goal.targetAmount));
      setTargetDate(result.goal.targetDate ?? "");
      setAccountId(result.goal.accountId ?? accountsResult.accounts?.[0]?.id ?? "");
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load this goal."));
  }, [goalId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(targetAmount);
    if (!name.trim() || !Number.isFinite(amount) || amount <= 0 || !accountId) {
      setError("Add a name, target amount, and goal account.");
      return;
    }
    setSaving(true);
    setError("");
    const response = await authenticatedFetch(`/api/goals/${goalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), targetAmount: amount, targetDate: targetDate || null, accountId }),
    }).catch(() => null);
    if (!response?.ok) {
      const result = await response?.json().catch(() => null) as { error?: string } | null;
      setError(result?.error ?? "Could not save this goal.");
      setSaving(false);
      return;
    }
    router.push(`/goals/${goalId}`);
  }

  if (!goal && !error) return <main className="min-h-dvh bg-background" />;

  const accountLocked = Boolean(goal?.allocatedAmount && goal.allocatedAmount > 0.000001);
  const selectedAccount = accounts.find((account) => account.id === accountId);

  return <main className="page-route-enter min-h-dvh bg-background"><div className="mx-auto w-full max-w-[560px] px-4 pb-12 sm:px-5">
    <StickyPageHeader className="-mx-4 flex items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5"><Link href={backHref} aria-label="Back to goal" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card"><ArrowLeft aria-hidden="true" className="size-5" /></Link><div><p className="text-xs font-medium text-muted-foreground">Goals</p><h1 className="text-[25px] font-semibold tracking-[-0.04em]">Edit goal</h1></div></StickyPageHeader>
    <section className="mt-8 rounded-[21px] border border-primary/20 bg-primary-soft/45 p-6"><span className="flex size-12 items-center justify-center rounded-[14px] bg-card text-primary"><Target aria-hidden="true" className="size-6" /></span><h2 className="mt-4 text-[22px] font-semibold tracking-[-0.04em]">Tune the plan</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">The goal account is the second side of every add or withdraw transfer.</p></section>
    <form onSubmit={submit} className="mt-5 space-y-5 rounded-[18px] border border-border bg-card p-4 sm:p-5">
      {error ? <p role="alert" className="rounded-[12px] border border-expense/25 bg-expense-soft px-3 py-2.5 text-sm font-medium text-expense">{error}</p> : null}
      <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Goal name</span><input required value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="h-12 w-full rounded-[11px] border border-border bg-background px-3 text-sm font-medium outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>
      <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Target amount</span><input required inputMode="decimal" type="number" min="0.01" step="0.01" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} className="h-12 w-full rounded-[11px] border border-border bg-background px-3 text-sm font-medium outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>
      <fieldset className="min-w-0">
        <legend className="text-xs font-semibold text-muted-foreground">Goal account{selectedAccount ? <span className="ml-2 font-semibold text-muted-foreground">· {selectedAccount.currency}</span> : null}</legend>
        <div className="mt-2 flex min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain px-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {accounts.map((account) => {
            const selected = account.id === accountId;
            const accountColor = getAccountBackgroundColor(account.backgroundColor, account.type);
            const accountForeground = getAccountForeground(accountColor, account.type);
            return <button key={account.id} type="button" disabled={accountLocked} aria-pressed={selected} onClick={() => setAccountId(account.id)} style={{ backgroundColor: selected ? accountColor : undefined, borderColor: `${accountForeground}8c`, color: accountForeground }} className="flex min-h-14 shrink-0 items-center gap-2 rounded-[12px] border bg-card px-3 text-sm font-semibold transition-colors hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-70"><span className="flex size-10 shrink-0 overflow-hidden rounded-[10px]"><AccountAvatar icon={account.icon} name={account.name} type={account.type} backgroundColor={accountColor} size={40} /></span><span className="flex min-w-0 flex-col items-start leading-tight"><span className="max-w-[145px] truncate">{account.name.replace(" Wallet", "").replace(" account", "")}</span><span className="mt-1 text-[11px] font-medium tabular-nums opacity-75">{money(account.currentBalance, account.currency)}</span></span>{selected ? <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background"><Check aria-hidden="true" className="size-3.5 stroke-[3]" /></span> : null}</button>;
          })}
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{accountLocked ? "Withdraw the current allocation before changing the holding account." : "Select the account that represents this goal."}</p>
      </fieldset>
      <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Target date (optional)</span><span className="relative block"><CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" /><input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="h-12 w-full rounded-[11px] border border-border bg-background pl-10 pr-3 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></span></label>
      <button type="submit" disabled={saving || !goal || !accountId} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">{saving ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}{saving ? "Saving goal…" : "Save goal"}</button>
    </form>
  </div></main>;
}
