"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarClock,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  LoaderCircle,
  Search,
  X,
  UserRound,
  WalletCards,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/auth-client";
import { AccountAvatar } from "@/components/accounts/account-avatar";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { MoneyEditor } from "@/components/money/money-editor";
import { Calendar } from "@/components/ui/calendar";
import { useUnsavedChangesGuard } from "@/components/ui/unsaved-changes-dialog";

type Account = { id: string; name: string; currency: string; type: string; icon?: string | null; backgroundColor?: string | null; currentBalance?: number };
type LoanRecord = {
  id: string;
  name: string;
  counterparty: string | null;
  direction: "borrowed" | "lent";
  currency: string;
  originalPrincipal: number;
  annualRate: number | null;
  interestMethod: "none" | "reducing" | "flat";
  paymentFrequency: "weekly" | "monthly" | "quarterly" | "yearly" | null;
  scheduledPayment: number | null;
  termCount: number | null;
  startDate: string;
  firstDueDate: string | null;
  notes: string | null;
};

type Step = 0 | 1 | 2 | 3;

const stepLabels = ["Details", "Amount", "Plan", "Review"];
const inputClass = "mt-1 min-h-12 w-full rounded-[12px] border border-border bg-card px-3.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const selectedChoiceClass = "border-primary bg-primary-soft text-primary";
const CURRENCY_CODES = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("currency") : ["NPR", "USD", "EUR", "INR"];
const interestMethodLabels = { none: "No interest", reducing: "Reducing balance", flat: "Flat rate" } as const;
const frequencyLabels = { weekly: "Every week", monthly: "Every month", quarterly: "Every quarter", yearly: "Every year" } as const;

function currencySymbol(code: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((part) => part.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}

function currencyName(code: string) {
  try {
    return new Intl.DisplayNames(undefined, { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function formatAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount) : "0";
}

function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function LoanEditor({ loanId }: { loanId?: string }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [direction, setDirection] = useState<"borrowed" | "lent">("borrowed");
  const [currency, setCurrency] = useState("NPR");
  const [principal, setPrincipal] = useState("");
  const [setupMode, setSetupMode] = useState<"existing" | "new">("existing");
  const [cashAccountId, setCashAccountId] = useState("");
  const [planner, setPlanner] = useState(false);
  const [interestMethod, setInterestMethod] = useState<"none" | "reducing" | "flat">("none");
  const [annualRate, setAnnualRate] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "quarterly" | "yearly">("monthly");
  const [termCount, setTermCount] = useState("");
  const [scheduledPayment, setScheduledPayment] = useState("");
  const [startDate, setStartDate] = useState(() => localDateValue());
  const [firstDueDate, setFirstDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<Step>(0);
  const [amountOpen, setAmountOpen] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const [repaymentPicker, setRepaymentPicker] = useState<"interestMethod" | "frequency" | null>(null);
  const [helpTopic, setHelpTopic] = useState<"moneyAccount" | "payments" | "regularPayment" | null>(null);
  const [datePicker, setDatePicker] = useState<"startDate" | "firstDueDate" | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [initialDraft, setInitialDraft] = useState<string | null>(null);
  const draftSnapshot = JSON.stringify({ name, counterparty, direction, currency, principal, setupMode, cashAccountId, planner, interestMethod, annualRate, frequency, termCount, scheduledPayment, startDate, firstDueDate, notes });
  const { requestDiscard, discardDialog } = useUnsavedChangesGuard(initialDraft !== null && draftSnapshot !== initialDraft);

  useEffect(() => {
    if (initialDraft !== null || (loanId && !name && !error)) return;
    const frame = window.requestAnimationFrame(() => setInitialDraft(draftSnapshot));
    return () => window.cancelAnimationFrame(frame);
  }, [draftSnapshot, error, initialDraft, loanId, name]);

  useEffect(() => {
    void authenticatedFetch("/api/accounts").then(async (response) => {
      const result = await response.json() as { accounts: Account[] };
      setAccounts(result.accounts.filter((account) => account.type !== "loan"));
    });

    if (loanId) {
      void authenticatedFetch(`/api/loans/${loanId}`).then(async (response) => {
        const { loan } = await response.json() as { loan: LoanRecord };
        setName(loan.name);
        setCounterparty(loan.counterparty ?? "");
        setDirection(loan.direction);
        setCurrency(loan.currency);
        setPrincipal(String(loan.originalPrincipal));
        setInterestMethod(loan.interestMethod);
        setAnnualRate(loan.annualRate == null ? "" : String(loan.annualRate));
        setFrequency(loan.paymentFrequency ?? "monthly");
        setScheduledPayment(loan.scheduledPayment == null ? "" : String(loan.scheduledPayment));
        setTermCount(loan.termCount == null ? "" : String(loan.termCount));
        setStartDate(loan.startDate);
        setFirstDueDate(loan.firstDueDate ?? "");
        setNotes(loan.notes ?? "");
        setPlanner(loan.interestMethod !== "none" || Boolean(loan.firstDueDate) || Boolean(loan.paymentFrequency));
        window.setTimeout(() => {
          setInitialDraft(JSON.stringify({ name: loan.name, counterparty: loan.counterparty ?? "", direction: loan.direction, currency: loan.currency, principal: String(loan.originalPrincipal), setupMode: "existing", cashAccountId: "", planner: loan.interestMethod !== "none" || Boolean(loan.firstDueDate) || Boolean(loan.paymentFrequency), interestMethod: loan.interestMethod, annualRate: loan.annualRate == null ? "" : String(loan.annualRate), frequency: loan.paymentFrequency ?? "monthly", termCount: loan.termCount == null ? "" : String(loan.termCount), scheduledPayment: loan.scheduledPayment == null ? "" : String(loan.scheduledPayment), startDate: loan.startDate, firstDueDate: loan.firstDueDate ?? "", notes: loan.notes ?? "" }));
        });
      });
    }
  }, [loanId]);

  async function save() {
    setSaving(true);
    setError("");
    const body = loanId
      ? {
          name,
          counterparty: counterparty || null,
          interestMethod: planner ? interestMethod : "none",
          annualRate: planner && interestMethod !== "none" && annualRate ? Number(annualRate) : null,
          paymentFrequency: planner ? frequency : null,
          scheduledPayment: planner && scheduledPayment ? Number(scheduledPayment) : null,
          termCount: planner && termCount ? Number(termCount) : null,
          firstDueDate: planner && firstDueDate ? firstDueDate : null,
          notes: notes || null,
        }
      : {
          name,
          counterparty: counterparty || null,
          direction,
          currency,
          principal: Number(principal),
          setupMode,
          cashAccountId: setupMode === "new" ? cashAccountId : null,
          interestMethod: planner ? interestMethod : "none",
          annualRate: planner && interestMethod !== "none" && annualRate ? Number(annualRate) : null,
          paymentFrequency: planner ? frequency : null,
          scheduledPayment: planner && scheduledPayment ? Number(scheduledPayment) : null,
          termCount: planner && termCount ? Number(termCount) : null,
          startDate,
          firstDueDate: planner && firstDueDate ? firstDueDate : null,
          notes: notes || null,
        };
    const response = await authenticatedFetch(loanId ? `/api/loans/${loanId}` : "/api/loans", {
      method: loanId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => null) as { loan?: LoanRecord; error?: string } | null;
    if (response.ok && result?.loan) router.push(`/loans/${result.loan.id}`);
    else setError(result?.error ?? "Could not save loan");
    setSaving(false);
  }

  function stepIsDisabled() {
    if (step === 0) return !name.trim();
    if (step === 1) {
      if (Number(principal) <= 0) return true;
      if (!loanId && setupMode === "new" && !cashAccountId) return true;
      return !loanId && setupMode === "existing" && !/^[A-Z]{3}$/.test(currency);
    }
    if (step === 2) {
      if (!startDate) return true;
      if (!planner) return false;
      if (interestMethod !== "none" && (!annualRate || Number(annualRate) < 0)) return true;
      return Boolean(firstDueDate && (!termCount || Number(termCount) <= 0));
    }
    return false;
  }

  function nextStep() {
    if (stepIsDisabled()) return;
    setError("");
    setStep((current) => Math.min(3, current + 1) as Step);
  }

  function previousStep() {
    setError("");
    setStep((current) => Math.max(0, current - 1) as Step);
  }

  function selectAccount(accountId: string) {
    setCashAccountId(accountId);
    const account = accounts.find((item) => item.id === accountId);
    if (account) setCurrency(account.currency);
    setAccountPickerOpen(false);
  }

  function openDatePicker(field: "startDate" | "firstDueDate") {
    const value = field === "startDate" ? startDate : firstDueDate;
    setCalendarMonth(value ? new Date(`${value}T12:00:00`) : new Date());
    setDatePicker(field);
  }

  const selectedCashAccount = accounts.find((account) => account.id === cashAccountId);

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-28 sm:px-5">
        <StickyPageHeader className="-mx-4 flex items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <Link href={loanId ? `/loans/${loanId}` : "/loans"} aria-label="Back" onClick={(event) => { event.preventDefault(); requestDiscard(() => router.push(loanId ? `/loans/${loanId}` : "/loans")); }} className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card">
            <ArrowLeft aria-hidden="true" className="size-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Loans</p>
            <h1 className="truncate text-[26px] font-semibold tracking-[-0.04em]">{loanId ? "Edit loan" : "Add loan"}</h1>
          </div>
        </StickyPageHeader>

        <div className="mt-6 flex gap-1.5" aria-label="Loan setup progress">
          {stepLabels.map((label, index) => <div key={label} className="min-w-0 flex-1"><span className={`block h-1.5 rounded-full ${index <= step ? "bg-primary" : "bg-border"}`} /><p className={`mt-2 truncate text-[11px] font-semibold ${index === step ? "text-primary" : "text-muted-foreground"}`}>{label}</p></div>)}
        </div>

        {error ? <p role="alert" className="mt-4 rounded-[12px] bg-expense-soft p-3 text-sm text-expense">{error}</p> : null}

        <section className="mt-5 rounded-[16px] border border-border bg-card p-4 sm:p-5">
          {step === 0 ? <>
            <StepIntro icon={<UserRound aria-hidden="true" className="size-5" />} eyebrow="Step 1 of 4" title="Loan details" />
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold">Loan name<input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="What is this loan for?" autoFocus /></label>
              <label className="block text-sm font-semibold">Lender or borrower <span className="font-normal text-muted-foreground">(optional)</span><input className={inputClass} value={counterparty} onChange={(event) => setCounterparty(event.target.value)} placeholder="Enter a name" /></label>
              <fieldset><legend className="text-sm font-semibold">Direction</legend><div className="mt-1 grid grid-cols-2 gap-2">{(["borrowed", "lent"] as const).map((value) => <button key={value} type="button" aria-pressed={direction === value} onClick={() => setDirection(value)} className={`min-h-12 rounded-[12px] border text-sm font-semibold ${direction === value ? selectedChoiceClass : "border-border bg-background"}`}>{value === "borrowed" ? "I owe" : "Owed to me"}</button>)}</div></fieldset>
            </div>
          </> : null}

          {step === 1 ? <>
            <StepIntro icon={<WalletCards aria-hidden="true" className="size-5" />} eyebrow="Step 2 of 4" title="Loan amount" />
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-sm font-semibold">Current principal</p>
                <div className="mt-1 flex gap-2">
                  {!loanId && setupMode === "existing" ? <CurrencyPickerButton currency={currency} open={currencyPickerOpen} onClick={() => setCurrencyPickerOpen(true)} /> : null}
                  {loanId ? <div className={`${inputClass} flex min-w-0 flex-1 items-center justify-start text-left`}><span className="text-xl font-semibold tabular-nums">{formatAmount(principal)}</span></div> : <button type="button" onClick={() => setAmountOpen(true)} className="flex min-h-14 min-w-0 flex-1 items-center justify-start rounded-[12px] border border-border bg-background px-3.5 text-left focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"><span className={`truncate text-xl font-semibold tabular-nums ${principal ? "text-foreground" : "text-muted-foreground"}`}>{principal ? formatAmount(principal) : "Enter principal"}</span></button>}
                </div>
              </div>
              {!loanId ? <><fieldset><legend className="text-sm font-semibold">Loan status</legend><div className="mt-1 grid grid-cols-2 gap-2">{(["existing", "new"] as const).map((value) => <button key={value} type="button" aria-pressed={setupMode === value} onClick={() => setSetupMode(value)} className={`min-h-12 rounded-[12px] border text-sm font-semibold ${setupMode === value ? selectedChoiceClass : "border-border bg-background"}`}>{value === "existing" ? "Already exists" : "New today"}</button>)}</div></fieldset>{setupMode === "new" ? <div><p className="flex items-center gap-1.5 text-sm font-semibold">Money account<HelpButton label="Why is a money account required?" onClick={() => setHelpTopic("moneyAccount")} /></p>{accounts.length ? <button type="button" aria-haspopup="dialog" aria-expanded={accountPickerOpen} aria-label={selectedCashAccount ? `Money account: ${selectedCashAccount.name}, ${selectedCashAccount.currency}` : "Choose money account"} onClick={() => setAccountPickerOpen(true)} className="mt-1 flex min-h-14 w-full items-center gap-3 rounded-[12px] border border-border bg-background px-3.5 text-left focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15">{selectedCashAccount ? <span className="flex size-9 shrink-0 overflow-hidden rounded-[10px]"><AccountAvatar icon={selectedCashAccount.icon} name={selectedCashAccount.name} type={selectedCashAccount.type} backgroundColor={selectedCashAccount.backgroundColor} size={36} /></span> : <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary"><WalletCards aria-hidden="true" className="size-4" /></span>}<span className="min-w-0 flex-1">{selectedCashAccount ? <><span className="block truncate text-sm font-semibold">{selectedCashAccount.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{selectedCashAccount.currency}</span></> : <span className="text-sm font-semibold text-muted-foreground">Choose account</span>}</span><ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></button> : <p className="mt-1 rounded-[12px] bg-surface-subtle p-3 text-sm text-muted-foreground">No eligible money accounts found.</p>}</div> : null}</> : <p className="rounded-[12px] bg-surface-subtle px-3.5 py-3 text-xs text-muted-foreground">The original principal and currency are fixed after a loan is created.</p>}
            </div>
          </> : null}

          {step === 2 ? <>
            <StepIntro icon={<CalendarClock aria-hidden="true" className="size-5" />} eyebrow="Step 3 of 4" title="Repayment plan" />
            <div className="mt-5 space-y-4">
              {!loanId ? <DateButton label="Start date" value={startDate} required onClick={() => openDatePicker("startDate")} /> : null}
              <button type="button" aria-pressed={planner} onClick={() => setPlanner((value) => !value)} className="flex min-h-12 w-full items-center justify-between rounded-[13px] border border-border bg-background px-4 text-left text-sm font-semibold"><span>{planner ? "Repayment plan enabled" : "Add a repayment plan"}</span><ChevronDown aria-hidden="true" className={`size-4 transition-transform ${planner ? "rotate-180" : ""}`} /></button>
              {planner ? <div className="grid gap-4 rounded-[13px] bg-surface-subtle p-3 sm:grid-cols-2"><PickerButton label="Interest method" value={interestMethodLabels[interestMethod]} onClick={() => setRepaymentPicker("interestMethod")} /><label className="text-sm font-semibold">Annual rate % {interestMethod === "none" ? <span className="font-normal text-muted-foreground">(optional)</span> : null}<input inputMode="decimal" className={inputClass} value={annualRate} onChange={(event) => setAnnualRate(event.target.value)} /></label><PickerButton label="Frequency" value={frequencyLabels[frequency]} onClick={() => setRepaymentPicker("frequency")} /><label className="text-sm font-semibold"><span className="flex items-center gap-1.5">Number of payments {firstDueDate ? null : <span className="font-normal text-muted-foreground">(optional)</span>}<HelpButton label="Explain number of payments" onClick={() => setHelpTopic("payments")} /></span><input inputMode="numeric" className={inputClass} value={termCount} onChange={(event) => setTermCount(event.target.value)} /></label><label className="text-sm font-semibold"><span className="flex items-center gap-1.5">Regular payment <span className="font-normal text-muted-foreground">(optional)</span><HelpButton label="Explain regular payment" onClick={() => setHelpTopic("regularPayment")} /></span><input inputMode="decimal" className={inputClass} value={scheduledPayment} onChange={(event) => setScheduledPayment(event.target.value)} placeholder="Enter an amount" /></label><DateButton label="First due date" value={firstDueDate} onClick={() => openDatePicker("firstDueDate")} /></div> : <p className="text-sm text-muted-foreground">No repayment schedule will be saved.</p>}
            </div>
          </> : null}

          {step === 3 ? <>
            <StepIntro icon={<FileText aria-hidden="true" className="size-5" />} eyebrow="Step 4 of 4" title="Review loan" />
            <div className="mt-5 divide-y divide-border rounded-[13px] border border-border bg-background"><ReviewRow label="Loan" value={name || "Not set"} /><ReviewRow label="Direction" value={direction === "borrowed" ? "I owe" : "Owed to me"} /><ReviewRow label="Principal" value={`${formatAmount(principal)} ${currency}`} /><ReviewRow label="Repayment" value={planner ? `${frequency} schedule` : "No schedule"} /></div>
            <label className="mt-4 block text-sm font-semibold">Notes <span className="font-normal text-muted-foreground">(optional)</span><textarea className={`${inputClass} min-h-24 py-3`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add a note" /></label>
          </> : null}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur"><div className="mx-auto flex w-full max-w-[688px] gap-2">{step > 0 ? <button type="button" onClick={previousStep} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[13px] border border-border bg-card px-4 text-sm font-semibold"><ArrowLeft aria-hidden="true" className="size-4" />Back</button> : null}{step < 3 ? <button type="button" disabled={stepIsDisabled()} onClick={nextStep} className="flex min-h-12 flex-[1.5] items-center justify-center gap-2 rounded-[13px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">Continue <ArrowRight aria-hidden="true" className="size-4" /></button> : <button type="button" disabled={saving} onClick={() => void save()} className="flex min-h-12 flex-[1.5] items-center justify-center gap-2 rounded-[13px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <Check aria-hidden="true" className="size-5" />}{loanId ? "Save loan" : "Create loan"}</button>}</div></div>
      <MoneyEditor open={amountOpen} value={principal || "0"} title="Enter loan principal" currency={currency} confirmPlacement="bottom" confirmLabel="Continue" confirmDisabled={(value) => !Number.isFinite(Number(value)) || Number(value) <= 0} cancelVariant="text" cancelLabel="Cancel" onCancel={() => setAmountOpen(false)} onSet={(value) => { setPrincipal(value); setAmountOpen(false); }} />
      {currencyPickerOpen ? <LoanCurrencyPickerSheet value={currency} search={currencySearch} onSearch={setCurrencySearch} onSelect={(code) => { setCurrency(code); setCurrencyPickerOpen(false); setCurrencySearch(""); }} onClose={() => { setCurrencyPickerOpen(false); setCurrencySearch(""); }} /> : null}
      {repaymentPicker ? <LoanRepaymentPickerSheet picker={repaymentPicker} value={repaymentPicker === "interestMethod" ? interestMethod : frequency} onSelect={(selected) => { if (repaymentPicker === "interestMethod") setInterestMethod(selected as typeof interestMethod); else setFrequency(selected as typeof frequency); setRepaymentPicker(null); }} onClose={() => setRepaymentPicker(null)} /> : null}
      {helpTopic ? <LoanHelpSheet topic={helpTopic} onClose={() => setHelpTopic(null)} /> : null}
      {accountPickerOpen ? <div role="dialog" aria-modal="true" aria-labelledby="loan-account-picker-title" className="fixed inset-0 z-[80] flex items-end bg-foreground/25" onPointerDown={(event) => { if (event.target === event.currentTarget) setAccountPickerOpen(false); }}><section className="max-h-[78dvh] w-full overflow-y-auto rounded-t-[24px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)]" onPointerDown={(event) => event.stopPropagation()}><div className="mx-auto h-1 w-10 rounded-full bg-border-strong/70" /><header className="flex items-center justify-between gap-3 py-3"><div><p className="text-xs font-medium text-muted-foreground">Loan setup</p><h2 id="loan-account-picker-title" className="text-xl font-semibold tracking-[-0.03em]">Choose money account</h2></div><button type="button" onClick={() => setAccountPickerOpen(false)} aria-label="Close account picker" className="flex size-10 items-center justify-center rounded-[10px] border border-border bg-card"><X aria-hidden="true" className="size-4" /></button></header><div className="grid gap-2">{accounts.map((account) => { const selected = cashAccountId === account.id; return <button key={account.id} type="button" aria-pressed={selected} onClick={() => selectAccount(account.id)} className={`flex min-h-14 items-center gap-3 rounded-[13px] border px-3 text-left ${selected ? selectedChoiceClass : "border-border bg-card"}`}><span className="flex size-10 shrink-0 overflow-hidden rounded-[11px]"><AccountAvatar icon={account.icon} name={account.name} type={account.type} backgroundColor={account.backgroundColor} size={40} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{account.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{account.currency}{account.currentBalance == null ? "" : ` ${formatAmount(String(account.currentBalance))}`}</span></span>{selected ? <Check aria-hidden="true" className="size-5 shrink-0 text-primary" /> : null}</button>; })}</div></section></div> : null}
      {datePicker ? <LoanDatePickerSheet field={datePicker} value={datePicker === "startDate" ? startDate : firstDueDate} month={calendarMonth} onMonthChange={setCalendarMonth} onSelect={(selected) => { if (!selected) return; const nextValue = format(selected, "yyyy-MM-dd"); if (datePicker === "startDate") setStartDate(nextValue); else setFirstDueDate(nextValue); }} onClear={() => { if (datePicker === "firstDueDate") setFirstDueDate(""); }} onClose={() => setDatePicker(null)} /> : null}
      {discardDialog}
    </main>
  );
}

function DateButton({ label, value, required = false, onClick }: { label: string; value: string; required?: boolean; onClick: () => void }) {
  return <div><p className="text-sm font-semibold">{label} {required ? null : <span className="font-normal text-muted-foreground">(optional)</span>}</p><button type="button" aria-label={`Choose ${label.toLowerCase()}`} onClick={onClick} className="mt-1 flex min-h-14 w-full items-center gap-3 rounded-[12px] border border-border bg-card px-3.5 text-left transition-colors hover:border-primary/45 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"><span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary"><CalendarDays aria-hidden="true" className="size-4" /></span><span className={`min-w-0 flex-1 text-sm font-semibold ${value ? "text-foreground" : "text-muted-foreground"}`}>{value ? format(new Date(`${value}T12:00:00`), "MMM d, yyyy") : "Choose a date"}</span><ArrowRight aria-hidden="true" className="size-4 shrink-0 text-primary" /></button></div>;
}

function PickerButton({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return <div><p className="text-sm font-semibold">{label}</p><button type="button" aria-haspopup="dialog" aria-label={`Choose ${label.toLowerCase()}`} onClick={onClick} className="mt-1 flex min-h-12 w-full items-center justify-between gap-3 rounded-[12px] border border-border bg-card px-3.5 text-left transition-colors hover:border-primary/45 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"><span className="min-w-0 truncate text-sm font-semibold">{value}</span><ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></button></div>;
}

function HelpButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" aria-label={label} onClick={onClick} className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"><CircleHelp aria-hidden="true" className="size-4" /></button>;
}

function CurrencyPickerButton({ currency, open, onClick }: { currency: string; open: boolean; onClick: () => void }) {
  const selectedCurrency = currency.toUpperCase();
  return <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={`Choose currency, ${selectedCurrency}`} onClick={onClick} className="flex min-h-14 w-[88px] shrink-0 items-center justify-between gap-1.5 rounded-[12px] border border-border bg-background px-3 text-left transition-colors hover:border-primary/45 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"><span className="text-sm font-semibold uppercase tracking-[0.04em] text-primary">{selectedCurrency}</span><ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></button>;
}

function LoanCurrencyPickerSheet({ value, search, onSearch, onSelect, onClose }: { value: string; search: string; onSearch: (value: string) => void; onSelect: (code: string) => void; onClose: () => void }) {
  const selectedCurrency = value.toUpperCase();
  const filteredCurrencies = CURRENCY_CODES.filter((code) => `${code} ${currencyName(code)} ${currencySymbol(code)}`.toLowerCase().includes(search.toLowerCase()));
  return <div role="presentation" className="fixed inset-0 z-[90] flex items-end bg-foreground/25" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="loan-currency-picker-title" className="flex max-h-[88dvh] w-full flex-col rounded-t-[24px] border-t border-border bg-background pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)]" onPointerDown={(event) => event.stopPropagation()}><div aria-hidden="true" className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-foreground/20" /><header className="flex items-center justify-between gap-3 border-b border-border px-4 pb-3 pt-3"><button type="button" onClick={onClose} aria-label="Close currency picker" className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card"><X aria-hidden="true" className="size-5" /></button><div className="min-w-0 text-center"><p className="text-xs font-medium text-muted-foreground">Loan setup</p><h2 id="loan-currency-picker-title" className="text-base font-semibold">Choose currency</h2></div><button type="button" onClick={onClose} className="rounded-[10px] bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">Done</button></header><div className="px-4"><div className="mt-4 flex items-center gap-2 rounded-[10px] border border-border bg-card px-3"><Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><input aria-label="Search currencies" autoFocus value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search currency or code" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground-subtle" /></div></div><div role="listbox" aria-label="World currencies" className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto px-4 pb-4">{filteredCurrencies.length ? filteredCurrencies.map((code) => <button key={code} type="button" role="option" aria-selected={selectedCurrency === code} onClick={() => onSelect(code)} className={`flex min-h-12 w-full items-center gap-3 rounded-[10px] px-2 text-left transition-colors hover:bg-surface-subtle focus-visible:bg-primary-soft focus-visible:outline-none ${selectedCurrency === code ? "bg-primary-soft" : ""}`}><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{currencySymbol(code)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{currencyName(code)}</span><span className="block text-xs text-muted-foreground">{code}</span></span>{selectedCurrency === code ? <Check aria-hidden="true" className="size-4 shrink-0 text-primary" /> : null}</button>) : <p className="px-2 py-6 text-center text-sm text-muted-foreground">No currencies found.</p>}</div></section></div>;
}

function LoanRepaymentPickerSheet({ picker, value, onSelect, onClose }: { picker: "interestMethod" | "frequency"; value: string; onSelect: (value: string) => void; onClose: () => void }) {
  const isInterestMethod = picker === "interestMethod";
  const title = isInterestMethod ? "Interest method" : "Payment frequency";
  const options = isInterestMethod ? Object.entries(interestMethodLabels) : Object.entries(frequencyLabels);
  return <div role="dialog" aria-modal="true" aria-labelledby="loan-repayment-picker-title" className="fixed inset-0 z-[90] flex items-end bg-foreground/25" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="max-h-[78dvh] w-full overflow-y-auto rounded-t-[24px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)]" onPointerDown={(event) => event.stopPropagation()}><div className="mx-auto h-1.5 w-12 rounded-full bg-foreground/20" /><header className="flex items-center justify-between gap-3 border-b border-border py-3"><button type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card"><X aria-hidden="true" className="size-5" /></button><div className="min-w-0 text-center"><p className="text-xs font-medium text-muted-foreground">Repayment plan</p><h2 id="loan-repayment-picker-title" className="text-base font-semibold">{title}</h2></div><button type="button" onClick={onClose} className="rounded-[10px] bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">Done</button></header><div className="mt-3 space-y-2">{options.map(([optionValue, optionLabel]) => <button key={optionValue} type="button" aria-pressed={value === optionValue} onClick={() => onSelect(optionValue)} className={`flex min-h-14 w-full items-center justify-between rounded-[12px] border px-4 text-left text-sm font-semibold transition-colors ${value === optionValue ? "border-primary bg-primary-soft text-primary" : "border-border bg-card hover:border-primary/45"}`}>{optionLabel}{value === optionValue ? <Check aria-hidden="true" className="size-5" /> : <ChevronDown aria-hidden="true" className="size-4 rotate-[-90deg] text-muted-foreground" />}</button>)}</div></section></div>;
}

function LoanHelpSheet({ topic, onClose }: { topic: "moneyAccount" | "payments" | "regularPayment"; onClose: () => void }) {
  const content = topic === "moneyAccount"
    ? { title: "Why choose a money account?", body: "For a loan starting today, Luna records where the money moves. Borrowed money increases the selected account; money you lend decreases it. Luna also creates the matching loan transfer. Loans that already existed do not need a money account because that movement happened before you started tracking it." }
    : topic === "payments"
      ? { title: "Number of payments", body: "The number of installments you expect to make before the loan is paid off. For example, 12 monthly payments means a one-year repayment plan." }
      : { title: "Regular payment", body: "The amount you plan to pay each installment. Leave it blank if your payments vary or you only want to track the repayment dates." };
  return <div role="dialog" aria-modal="true" aria-labelledby="loan-help-title" className="fixed inset-0 z-[90] flex items-end bg-foreground/25" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="w-full rounded-t-[24px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)]" onPointerDown={(event) => event.stopPropagation()}><div className="mx-auto h-1.5 w-12 rounded-full bg-foreground/20" /><header className="flex items-center justify-between gap-3 border-b border-border py-3"><div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-info-soft text-info"><CircleHelp aria-hidden="true" className="size-5" /></span><h2 id="loan-help-title" className="text-base font-semibold">{content.title}</h2></div><button type="button" onClick={onClose} aria-label="Close help" className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card"><X aria-hidden="true" className="size-5" /></button></header><p className="py-5 text-sm leading-6 text-muted-foreground">{content.body}</p><button type="button" onClick={onClose} className="flex min-h-12 w-full items-center justify-center rounded-[13px] bg-primary font-semibold text-primary-foreground">Got it</button></section></div>;
}

function LoanDatePickerSheet({ field, value, month, onMonthChange, onSelect, onClear, onClose }: { field: "startDate" | "firstDueDate"; value: string; month: Date; onMonthChange: (month: Date) => void; onSelect: (date: Date | undefined) => void; onClear: () => void; onClose: () => void }) {
  const title = field === "startDate" ? "Choose start date" : "Choose first due date";
  const canClear = field === "firstDueDate" && Boolean(value);
  return <div role="dialog" aria-modal="true" aria-labelledby="loan-date-picker-title" className="fixed inset-0 z-[80] flex items-end bg-foreground/25" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="flex max-h-[88dvh] w-full flex-col rounded-t-[24px] border-t border-border bg-background shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)]" onPointerDown={(event) => event.stopPropagation()}><div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-foreground/20" /><header className="flex shrink-0 items-center justify-between border-b border-border px-4 pb-3 pt-3"><button type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card"><X aria-hidden="true" className="size-5" /></button><h2 id="loan-date-picker-title" className="text-base font-semibold">{title}</h2><button type="button" onClick={onClose} className="rounded-[10px] bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">Done</button></header><div className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"><div className="w-full max-w-[420px] space-y-3"><Calendar mode="single" month={month} onMonthChange={onMonthChange} selected={value ? new Date(`${value}T12:00:00`) : undefined} modifiers={{ today: new Date() }} onSelect={onSelect} className="w-full rounded-[18px] border border-border bg-card p-4 shadow-[0_18px_50px_rgb(23_32_29_/_0.10)] [--cell-size:2.5rem] min-[420px]:[--cell-size:2.75rem]" />{value ? <div className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">{format(new Date(`${value}T12:00:00`), "EEEE, MMM d, yyyy")}</p>{canClear ? <button type="button" onClick={() => { onClear(); onClose(); }} className="shrink-0 text-xs font-semibold text-primary">Clear</button> : null}</div> : null}</div></div></section></div>;
}

function StepIntro({ icon, eyebrow, title }: { icon: ReactNode; eyebrow: string; title: string }) {
  return <div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-primary-soft text-primary">{icon}</span><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</p><h2 className="mt-1 text-[22px] font-semibold tracking-[-0.04em]">{title}</h2></div></div>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 px-3.5 py-3"><span className="text-xs font-medium text-muted-foreground">{label}</span><span className="text-right text-sm font-semibold">{value}</span></div>;
}
