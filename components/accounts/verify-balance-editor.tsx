"use client";

import { useState } from "react";
import { MoneyEditor } from "@/components/money/money-editor";
import { AccountAvatar } from "@/components/accounts/account-avatar";
import { authenticatedFetch } from "@/lib/auth-client";
import { sumMoney } from "@/lib/money";

export type VerifiableAccount = {
  id: string;
  name: string;
  currency: string;
  currentBalance: number;
};
export type VerifiableAccountChoice = VerifiableAccount & { type: string; icon: string | null; backgroundColor: string | null };

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}

export function VerifyBalanceEditor({ account, accounts, open, onAccountChange, onClose, onSaved, onReviewTransactions }: { account: VerifiableAccount | null; accounts?: VerifiableAccountChoice[]; open: boolean; onAccountChange?: (account: VerifiableAccountChoice) => void; onClose: () => void; onSaved: (account: VerifiableAccount) => void; onReviewTransactions?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (!account) return null;
  const currentAccount = account;

  async function save(nextBalance: string) {
    if (saving) return;
    setSaving(true); setError("");
    const response = await authenticatedFetch(`/api/accounts/${currentAccount.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ openingBalance: Number(nextBalance) }) }).catch(() => null);
    if (response?.ok) {
      const result = await response.json() as { account: VerifiableAccount };
      onSaved(result.account);
    } else {
      const result = await response?.json().catch(() => null) as { error?: string } | null;
      setError(response?.status === 401 ? "Your session expired. Please sign in again before updating the balance." : result?.error ?? "Could not update account balance.");
    }
    setSaving(false);
  }

  const accountSlider = accounts?.length ? <div><p className="mb-2 text-[11px] font-semibold text-muted-foreground">Choose account</p><div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{accounts.map((item) => { const selected = item.id === account.id; return <button key={item.id} type="button" aria-pressed={selected} onClick={() => onAccountChange?.(item)} className={`flex min-h-12 shrink-0 items-center gap-2 rounded-[12px] border px-2.5 pr-3 text-left transition-colors ${selected ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}><AccountAvatar icon={item.icon} name={item.name} type={item.type} backgroundColor={item.backgroundColor} size={34} /><span><span className="block max-w-[130px] truncate text-xs font-semibold">{item.name}</span><span className="mt-0.5 block text-[10px] tabular-nums text-muted-foreground">{formatAmount(item.currentBalance)} {item.currency}</span></span></button>; })}</div></div> : null;
  return <MoneyEditor open={open} instanceKey={account.id} value={String(account.currentBalance)} title={saving ? "Saving balance…" : "Verify & edit balance"} previousLabel="Luna balance" currency={account.currency} confirmLabel="Confirm" confirmDisabled={(draft) => Number(draft) === account.currentBalance} headerContent={accountSlider} topContent={(draft) => {
    const statementBalance = Number(draft || "0");
    const difference = sumMoney([statementBalance, -account.currentBalance]);
    const hasChanged = statementBalance !== account.currentBalance;
    return <><div className="rounded-[12px] border border-border bg-card px-4 py-3 text-left"><p className="text-sm font-semibold text-foreground">Enter the balance shown by your bank or wallet</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Luna will compare it with the current balance before making an adjustment.</p><div className="mt-3 flex items-end justify-between gap-3 border-t border-border pt-2.5"><div className="min-w-0"><p className="text-[11px] font-medium text-muted-foreground">Balance adjustment</p><p className={`mt-0.5 text-sm font-semibold tabular-nums ${difference < 0 ? "text-expense" : difference > 0 ? "text-income" : "text-foreground"}`}>{difference > 0 ? "+" : difference < 0 ? "−" : ""}{formatAmount(Math.abs(difference))} {account.currency}</p></div>{hasChanged && onReviewTransactions ? <button type="button" onClick={onReviewTransactions} className="shrink-0 rounded-[8px] px-1.5 py-1 text-[11px] font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">Review transactions instead</button> : null}</div></div>{error ? <p role="alert" className="mt-2 rounded-[10px] bg-expense-soft px-3 py-2 text-xs font-medium text-expense">{error}</p> : null}</>;
  }} onCancel={() => { setError(""); onClose(); }} onSet={(nextBalance) => void save(nextBalance)} />;
}
