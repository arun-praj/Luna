"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, LockKeyhole, ShoppingBag, Target, X } from "lucide-react";

import { AccountAvatar } from "@/components/accounts/account-avatar";
import { MoneyEditor } from "@/components/money/money-editor";
import { authenticatedFetch, notifyTransactionsChanged } from "@/lib/auth-client";
import { useAnimatedVisibility } from "@/lib/use-animated-visibility";

type Goal = { id: string; name: string; targetAmount: number; allocatedAmount: number; status: "active" | "completed" | "archived"; accountId: string | null };
type Account = { id: string; name: string; type: string; currency: string; icon: string | null; backgroundColor: string | null; currentBalance: number; isDefault?: boolean };
type Category = { id: string; name: string; type: "expense" | "income" };
type Action = "contribute" | "withdraw" | "spend";

function amountLabel(value: number) { return value.toLocaleString("en-US", { maximumFractionDigits: 2 }); }

export function GoalActionForm({ goal, accounts, categories, onChanged }: { goal: Goal; accounts: Account[]; categories: Category[]; onChanged: () => void }) {
  const [action, setAction] = useState<Action | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [amountOpen, setAmountOpen] = useState(false);
  const setupTransition = useAnimatedVisibility(setupOpen);
  const [amount, setAmount] = useState("0");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const goalAccount = useMemo(() => accounts.find((account) => account.id === goal.accountId), [accounts, goal.accountId]);
  const spendableAccounts = useMemo(() => accounts.filter((account) => account.id !== goal.accountId), [accounts, goal.accountId]);

  function openAction(nextAction: Action) {
    setAction(nextAction);
    setAccountId((current) => spendableAccounts.some((account) => account.id === current) ? current : spendableAccounts.find((account) => account.isDefault)?.id ?? spendableAccounts[0]?.id ?? "");
    setAmount(nextAction === "spend" ? String(goal.allocatedAmount) : "0");
    setCategoryId("");
    setNotes("");
    setError("");
    setSetupOpen(true);
  }

  function closeSetup() {
    setSetupOpen(false);
    window.setTimeout(() => setAction(null), 320);
  }

  function continueToDialer() {
    setSetupOpen(false);
    setAmountOpen(true);
  }

  async function submit(nextAmount: string) {
    if (!action || saving) return;
    const numericAmount = Number(nextAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return;
    setSaving(true); setError("");
    try {
      const response = await authenticatedFetch(`/api/goals/${goal.id}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, amount: numericAmount, accountId: selectedAccount?.id, categoryId: categoryId || undefined, notes: notes.trim() || undefined }) });
      if (!response.ok) { const result = await response.json().catch(() => null) as { error?: string } | null; setError(result?.error ?? "Could not update this goal."); setSaving(false); return; }
      notifyTransactionsChanged(); setAmountOpen(false); setAction(null); onChanged();
    } catch { setError("Could not update this goal. Check your connection and try again."); }
    finally { setSaving(false); }
  }

  const selectedAccount = spendableAccounts.find((account) => account.id === accountId) ?? spendableAccounts.find((account) => account.isDefault) ?? spendableAccounts[0];
  const maxAmount = action === "contribute" ? undefined : goal.allocatedAmount;
  const actionTitle = action === "contribute" ? "Add funds" : action === "withdraw" ? "Withdraw funds" : "Mark as spent";
  const actionDescription = action === "contribute" ? "Move money into this goal account." : action === "withdraw" ? "Move money back to a spendable account." : "Record the purchase without charging an account again.";
  const isReady = Boolean(goalAccount) && (action === "spend" || Boolean(selectedAccount));

  return <>
    {error ? <p role="alert" className="mt-4 rounded-[13px] border border-expense/25 bg-expense-soft px-3.5 py-3 text-sm font-medium text-expense">{error}</p> : null}
    {goal.status !== "archived" ? <section aria-labelledby="goal-actions-heading" className="mt-4 px-1">
      <div className="rounded-[18px] border border-border bg-card p-3 shadow-[0_10px_24px_rgb(23_32_29_/_0.07)]">
        <div className="flex items-start justify-between gap-3 px-1 pb-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Goal wallet</p><h2 id="goal-actions-heading" className="mt-1 text-[18px] font-semibold tracking-[-0.03em]">Move money in two taps</h2></div>{goalAccount ? <span className="rounded-full bg-income-soft px-2.5 py-1 text-[10px] font-semibold text-income">{goal.status === "completed" ? "Ready to buy" : `${Math.round(goal.targetAmount > 0 ? goal.allocatedAmount / goal.targetAmount * 100 : 0)}% funded`}</span> : null}</div>
        {!goalAccount ? <div className="mb-3 flex items-center gap-3 rounded-[14px] border border-dashed border-expense/30 bg-expense-soft/60 px-3 py-3"><LockKeyhole aria-hidden="true" className="size-5 shrink-0 text-expense" /><span className="min-w-0 text-xs leading-5 text-expense"><strong className="font-semibold">Choose a goal account first.</strong> Edit this goal and select the account that will hold its money.</span></div> : null}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-label="Add funds from a spendable account" onClick={() => openAction("contribute")} disabled={!goalAccount || !spendableAccounts.length} className="group flex min-h-[76px] items-center gap-3 rounded-[14px] border-2 border-primary bg-primary px-3 text-left text-primary-foreground shadow-[0_5px_12px_rgb(23_32_29_/_0.12)] transition-transform hover:-translate-y-0.5 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"><span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-white/15"><ArrowDownLeft aria-hidden="true" className="size-[18px]" /></span><span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">Add funds</span><span className="mt-0.5 block truncate text-[10px] text-primary-foreground/70">From a spendable account</span></span><ArrowRight aria-hidden="true" className="size-4 shrink-0 text-white/70" /></button>
          <button type="button" aria-label="Withdraw funds to a spendable account" onClick={() => openAction("withdraw")} disabled={!goalAccount || goal.allocatedAmount <= 0 || !spendableAccounts.length} className="flex min-h-[76px] items-center gap-3 rounded-[14px] border-2 border-border bg-background px-3 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:border-primary/35 disabled:cursor-not-allowed disabled:opacity-40"><span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-surface-subtle text-primary"><ArrowUpRight aria-hidden="true" className="size-[18px]" /></span><span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">Withdraw</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">Return money to an account</span></span><ArrowLeftIcon /></button>
          {goal.status === "completed" ? <button type="button" onClick={() => openAction("spend")} disabled={!goalAccount} className="col-span-2 flex min-h-[58px] items-center gap-3 rounded-[15px] border border-expense/20 bg-expense-soft px-3.5 text-left transition-colors hover:bg-expense/10 disabled:opacity-45"><span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-card text-expense"><ShoppingBag aria-hidden="true" className="size-[18px]" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Mark as spent</span><span className="mt-0.5 block text-[11px] text-muted-foreground">Finish the goal from its account</span></span><Check aria-hidden="true" className="mr-1 size-[18px] text-expense" /></button> : null}
        </div>
      </div>
    </section> : null}

    {setupTransition.mounted && action ? <div role="presentation" className={`fixed inset-0 z-[60] flex items-end bg-foreground/25 backdrop-blur-[2px] ${setupTransition.closing ? "drawer-scrim-exit" : "drawer-scrim-enter"}`} onMouseDown={(event) => { if (event.target === event.currentTarget) closeSetup(); }}><section role="dialog" aria-modal="true" aria-labelledby="goal-action-setup-title" className={`w-full rounded-t-[24px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)] ${setupTransition.closing ? "drawer-exit" : "drawer-enter"}`}><div className="mx-auto w-full max-w-[520px]"><div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-foreground/15" aria-hidden="true" /><header className="flex items-center justify-between gap-3 pb-4"><button type="button" onClick={closeSetup} aria-label="Close goal action setup" className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card text-muted-foreground"><X aria-hidden="true" className="size-5" /></button><div className="min-w-0 text-center"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{goal.name}</p><h2 id="goal-action-setup-title" className="mt-0.5 text-lg font-semibold tracking-[-0.03em]">{actionTitle}</h2></div><button type="button" onClick={continueToDialer} disabled={!isReady} className="rounded-[11px] bg-primary-soft px-3 py-2 text-sm font-semibold text-primary disabled:opacity-40">Enter amount</button></header>
        <div className="rounded-[18px] border border-primary/15 bg-primary-soft/45 p-4"><p className="text-sm font-semibold">{actionDescription}</p><div className="mt-3 flex items-center gap-2"><FlowAccount account={action === "withdraw" ? goalAccount : selectedAccount} label={action === "withdraw" ? "Goal account" : "Spendable"} /><ArrowRight aria-hidden="true" className="size-4 shrink-0 text-primary" /><FlowAccount account={action === "withdraw" ? selectedAccount : goalAccount} label={action === "withdraw" ? "Return to" : "Goal account"} /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{action === "spend" ? "This is already funded, so marking it spent only reduces the goal balance." : "The two balances and the goal progress update together."}</p></div>
        {action !== "spend" ? <div className="mt-4"><p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">{action === "contribute" ? "Choose the account to take from" : "Choose where returned money goes"}</p><div className="grid gap-2 sm:grid-cols-2">{spendableAccounts.map((account) => <button key={account.id} type="button" onClick={() => setAccountId(account.id)} className={`flex items-center gap-2 rounded-[13px] border px-3 py-2.5 text-left transition-colors ${account.id === accountId ? "border-primary bg-primary-soft" : "border-border bg-card"}`}><AccountAvatar icon={account.icon} name={account.name} type={account.type} backgroundColor={account.backgroundColor} size={32} /><span className="min-w-0"><span className="block truncate text-xs font-semibold">{account.name}</span><span className="block text-[10px] text-muted-foreground">{account.currency} {amountLabel(account.currentBalance)}</span></span>{account.id === accountId ? <Check aria-hidden="true" className="ml-auto size-4 shrink-0 text-primary" /> : null}</button>)}</div></div> : <div className="mt-4 flex items-center gap-2 rounded-[12px] bg-surface-subtle px-3 py-2.5 text-xs text-muted-foreground"><Target aria-hidden="true" className="size-4 shrink-0 text-primary" />The goal account is the purchase reference.</div>}
        {action === "spend" ? <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Expense category (optional)</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="h-11 w-full rounded-[11px] border border-border bg-card px-3 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"><option value="">No category</option>{categories.filter((category) => category.type === "expense").map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label> : null}
        <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Note (optional)</span><input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder={action === "spend" ? "What did you buy?" : "Add a note"} className="h-11 w-full rounded-[11px] border border-border bg-card px-3 text-sm font-medium outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>
      </div></section></div> : null}

    <MoneyEditor open={amountOpen} value={amount} title={actionTitle} currency={selectedAccount?.currency ?? goalAccount?.currency ?? "NPR"} confirmPlacement="bottom" confirmLabel={saving ? "Saving…" : actionTitle} confirmDisabled={(value) => saving || !Number.isFinite(Number(value)) || Number(value) <= 0 || (maxAmount !== undefined && Number(value) > maxAmount + 0.000001)} confirmValidation={(value) => maxAmount !== undefined && Number(value) > maxAmount + 0.000001 ? `Enter ${amountLabel(maxAmount)} or less.` : ""} cancelVariant="text" cancelLabel="Cancel" onCancel={() => { setAmountOpen(false); setAction(null); }} onSet={(nextAmount) => { setAmount(nextAmount); void submit(nextAmount); }} />
  </>;
}

function FlowAccount({ account, label }: { account?: Account; label: string }) {
  return <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[12px] bg-card/75 p-2"><span className="shrink-0">{account ? <AccountAvatar icon={account.icon} name={account.name} type={account.type} backgroundColor={account.backgroundColor} size={28} /> : <span className="flex size-7 items-center justify-center rounded-[9px] bg-surface-subtle"><LockKeyhole aria-hidden="true" className="size-3.5 text-muted-foreground" /></span>}</span><span className="min-w-0"><span className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span><span className="block truncate text-[11px] font-semibold">{account?.name ?? "Not selected"}</span></span></div>;
}

function ArrowLeftIcon() { return <ArrowRight aria-hidden="true" className="size-4 rotate-180 text-muted-foreground" />; }
