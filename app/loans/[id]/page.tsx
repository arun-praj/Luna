"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Edit3,
  HandCoins,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/auth-client";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { PageHeader } from "@/components/layout/page-header";
import { PageDataSkeleton } from "@/components/ui/data-skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatCurrencyAmount } from "@/lib/currency";

type Installment = {
  id: string;
  sequence: number;
  dueDate: string;
  expectedPrincipal: number;
  expectedInterest: number;
  expectedFees: number;
  paidPrincipal: number;
  paidInterest: number;
  paidFees: number;
  status: string;
};
type Payment = {
  id: string;
  principal: number;
  interest: number;
  fees: number;
  date: string;
  kind: string;
};
type Loan = {
  id: string;
  accountId: string;
  name: string;
  counterparty: string | null;
  direction: "borrowed" | "lent";
  currency: string;
  originalPrincipal: number;
  outstandingPrincipal: number;
  interestMethod: string;
  nextDueDate: string | null;
  status: string;
  rates: Array<{ id: string; annualRate: number; effectiveDate: string }>;
  installments: Installment[];
  payments: Payment[];
};
type Account = { id: string; name: string; currency: string; type: string };
export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [accountId, setAccountId] = useState("");
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("");
  const [fees, setFees] = useState("");
  const [editPrincipal, setEditPrincipal] = useState("");
  const [editInterest, setEditInterest] = useState("");
  const [editFees, setEditFees] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    const [loanResponse, accountsResponse] = await Promise.all([
      authenticatedFetch(`/api/loans/${id}`),
      authenticatedFetch("/api/accounts"),
    ]);
    if (loanResponse.ok)
      setLoan(((await loanResponse.json()) as { loan: Loan }).loan);
    if (accountsResponse.ok) {
      const rows = (
        (await accountsResponse.json()) as { accounts: Account[] }
      ).accounts.filter((a) => a.type !== "loan");
      setAccounts(rows);
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextInstallment = loan?.installments.find(
    (item) => item.status === "pending" || item.status === "partial",
  );
  const paidInterest = useMemo(
    () =>
      loan?.payments.reduce(
        (sum, item) => sum + item.interest + item.fees,
        0,
      ) ?? 0,
    [loan],
  );
  const paymentAccounts = loan
    ? accounts.filter((account) => account.currency === loan.currency)
    : [];
  const selectedPaymentAccountId = paymentAccounts.some(
    (account) => account.id === accountId,
  )
    ? accountId
    : (paymentAccounts[0]?.id ?? "");
  async function pay() {
    if (!loan || !selectedPaymentAccountId) return;
    setSaving(true);
    setError("");
    const response = await authenticatedFetch(
      `/api/loans/${loan.id}/payments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedPaymentAccountId,
          principal: Number(principal || 0),
          interest: Number(interest || 0),
          fees: Number(fees || 0),
          date,
          installmentId: nextInstallment?.id ?? null,
          clientGeneratedId: crypto.randomUUID(),
        }),
      },
    );
    const result = (await response.json().catch(() => null)) as {
      loan?: Loan;
      error?: string;
    } | null;
    if (response.ok && result?.loan) {
      setLoan(result.loan);
      setPaymentOpen(false);
      setPrincipal("");
      setInterest("");
      setFees("");
    } else setError(result?.error ?? "Could not record payment");
    setSaving(false);
  }
  function openPaymentEdit(payment: Payment) {
    setEditingPayment(payment);
    setEditPrincipal(String(payment.principal));
    setEditInterest(String(payment.interest));
    setEditFees(String(payment.fees));
    setEditDate(payment.date);
    setError("");
  }
  async function savePayment() {
    if (!loan || !editingPayment) return;
    setSaving(true);
    setError("");
    const response = await authenticatedFetch(
      `/api/loans/${loan.id}/payments/${editingPayment.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          principal: Number(editPrincipal || 0),
          interest: Number(editInterest || 0),
          fees: Number(editFees || 0),
          date: editDate,
        }),
      },
    );
    const result = (await response.json().catch(() => null)) as {
      loan?: Loan;
      error?: string;
    } | null;
    if (response.ok && result?.loan) {
      setLoan(result.loan);
      setEditingPayment(null);
    } else setError(result?.error ?? "Could not update payment");
    setSaving(false);
  }
  async function removeLoan() {
    if (!loan) return;
    setSaving(true);
    setError("");
    const response = await authenticatedFetch(`/api/loans/${loan.id}`, { method: "DELETE" });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (response.ok) {
      setDeleteOpen(false);
      router.push("/loans");
    }
    else {
      setError(result?.error ?? "Could not delete loan");
      setSaving(false);
    }
  }
  if (!loan)
    return (
      <main className="min-h-dvh bg-background">
        <div className="mx-auto max-w-[720px] p-4">
          <PageDataSkeleton />
        </div>
      </main>
    );
  const progress = loan.originalPrincipal
    ? ((loan.originalPrincipal - loan.outstandingPrincipal) /
        loan.originalPrincipal) *
      100
    : 0;
  const inputClass =
    "mt-1 min-h-12 w-full rounded-[12px] border border-border bg-card px-3 text-sm outline-none focus:border-primary";
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-12">
        <StickyPageHeader className="-mx-4 px-4 pb-3">
          <PageHeader
            leading={<Link href="/loans" aria-label="Back to loans" className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card"><ArrowLeft aria-hidden="true" className="size-5" /></Link>}
            title={<div className="min-w-0"><p className="text-xs text-muted-foreground">{loan.direction === "borrowed" ? "I owe" : "Owed to me"}</p><h1 className="break-words text-[25px] font-semibold">{loan.name}</h1></div>}
            actions={<Link href={`/loans/${loan.id}/edit`} aria-label="Edit loan" className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card"><Edit3 aria-hidden="true" className="size-5" /></Link>}
          />
        </StickyPageHeader>
        {error ? (
          <p className="mt-4 rounded-[12px] bg-expense-soft p-3 text-sm text-expense">
            {error}
          </p>
        ) : null}
        <section className="mt-6 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-[14px] bg-info-soft text-info">
            <HandCoins className="size-7" />
          </span>
          <p className="mt-4 text-sm text-muted-foreground">
            Outstanding principal
          </p>
          <p className="mt-1 text-[38px] font-semibold tracking-tight tabular-nums">
            {formatCurrencyAmount(loan.outstandingPrincipal)}{" "}
            <span className="text-base text-muted-foreground">
              {loan.currency}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {loan.counterparty || "No counterparty added"}
          </p>
          <div className="mx-auto mt-5 h-2 max-w-sm overflow-hidden rounded-full bg-info-soft">
            <div
              className="h-full bg-info"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        </section>
        <section className="mt-7 grid grid-cols-2 gap-2">
          <div className="rounded-[14px] border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Next payment</p>
            <p className="mt-1 text-sm font-semibold">
              {nextInstallment
                ? `${formatCurrencyAmount(nextInstallment.expectedPrincipal + nextInstallment.expectedInterest + nextInstallment.expectedFees)} ${loan.currency}`
                : "No schedule"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {nextInstallment?.dueDate ?? loan.status.replace("_", " ")}
            </p>
          </div>
          <div className="rounded-[14px] border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Interest & fees</p>
            <p className="mt-1 text-sm font-semibold">
              {formatCurrencyAmount(paidInterest)} {loan.currency}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Recorded so far
            </p>
          </div>
        </section>
        {loan.status === "active" ? (
          <button
            onClick={() => {
              setPrincipal(
                String(
                  Math.min(
                    nextInstallment?.expectedPrincipal ??
                      loan.outstandingPrincipal,
                    loan.outstandingPrincipal,
                  ),
                ),
              );
              setInterest(String(nextInstallment?.expectedInterest ?? 0));
              setFees(String(nextInstallment?.expectedFees ?? 0));
              setError("");
              setPaymentOpen(true);
            }}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-primary font-semibold text-primary-foreground"
          >
            <Check className="size-5" />
            Record payment
          </button>
        ) : null}
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Payment history</h2>
          <div className="mt-3 divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-card">
            {loan.payments.length ? (
              loan.payments.map((item) => (
                <PaymentRow
                  key={item.id}
                  item={item}
                  currency={loan.currency}
                  onEdit={openPaymentEdit}
                />
              ))
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No payments recorded yet.
              </p>
            )}
          </div>
        </section>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          disabled={saving}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] border border-expense/25 bg-expense-soft font-semibold text-expense transition-colors hover:border-expense/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-expense/35 disabled:opacity-50"
        >
          {saving ? <LoaderCircle className="size-5 animate-spin" /> : <Trash2 className="size-5" />}
          Delete loan
        </button>
        <ConfirmDialog
          open={deleteOpen}
          title="Delete loan?"
          description={`Delete “${loan.name}”? This removes the loan and its linked payment records.`}
          confirmLabel="Delete loan"
          destructive
          busy={saving}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={removeLoan}
        />
        {paymentOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-end bg-foreground/30"
            onPointerDown={() => setPaymentOpen(false)}
          >
            <section
              className="w-full rounded-t-[24px] bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="mx-auto max-w-[688px]">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Record payment</h2>
                  <button
                    type="button"
                    onClick={() => setPaymentOpen(false)}
                    className="rounded-[9px] px-2 py-1 text-sm font-semibold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                  >
                    Cancel
                  </button>
                </div>
                <p className="mt-1 text-center text-sm text-muted-foreground">
                  Allocate the full payment so principal stays accurate.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <label className="text-xs font-semibold">
                    Principal
                    <input
                      inputMode="decimal"
                      className={inputClass}
                      value={principal}
                      onChange={(e) => setPrincipal(e.target.value)}
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Interest
                    <input
                      inputMode="decimal"
                      className={inputClass}
                      value={interest}
                      onChange={(e) => setInterest(e.target.value)}
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Fees
                    <input
                      inputMode="decimal"
                      className={inputClass}
                      value={fees}
                      onChange={(e) => setFees(e.target.value)}
                    />
                  </label>
                </div>
                <div className="mt-3">
                  <p className="text-sm font-semibold">Money account</p>
                  {paymentAccounts.length ? (
                    <select
                      className={inputClass}
                      value={selectedPaymentAccountId}
                      onChange={(e) => {
                        setAccountId(e.target.value);
                        setError("");
                      }}
                    >
                      {paymentAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} · {account.currency}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1 rounded-[12px] border border-expense/25 bg-expense-soft p-3">
                      <p className="text-sm text-expense">
                        No non-loan {loan.currency} account is available for
                        this payment.
                      </p>
                      <Link
                        href={`/accounts/new?currency=${encodeURIComponent(loan.currency)}&returnTo=${encodeURIComponent(`/loans/${loan.id}`)}`}
                        className="mt-2 inline-flex text-sm font-semibold text-primary underline underline-offset-2"
                      >
                        Add a {loan.currency} account
                      </Link>
                    </div>
                  )}
                </div>
                <label className="mt-3 block text-sm font-semibold">
                  Payment date
                  <input
                    type="date"
                    className={inputClass}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                <button
                  onClick={pay}
                  disabled={saving || !selectedPaymentAccountId}
                  className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-primary font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {saving ? (
                    <LoaderCircle className="size-5 animate-spin" />
                  ) : (
                    <Check className="size-5" />
                  )}
                  Confirm{" "}
                  {formatCurrencyAmount(
                    Number(principal || 0) +
                      Number(interest || 0) +
                      Number(fees || 0),
                  )}{" "}
                  {loan.currency}
                </button>
              </div>
            </section>
          </div>
        ) : null}
        {editingPayment ? (
          <div
            className="fixed inset-0 z-[55] flex items-end bg-foreground/30"
            onPointerDown={() => setEditingPayment(null)}
          >
            <section
              className="w-full rounded-t-[24px] bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="mx-auto max-w-[688px]">
                <h2 className="text-center text-lg font-semibold">
                  Edit payment
                </h2>
                <p className="mt-1 text-center text-sm text-muted-foreground">
                  Correct the payment amount and date. The loan balance will be
                  recalculated.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <label className="text-xs font-semibold">
                    Principal
                    <input
                      inputMode="decimal"
                      className={inputClass}
                      value={editPrincipal}
                      onChange={(e) => setEditPrincipal(e.target.value)}
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Interest
                    <input
                      inputMode="decimal"
                      className={inputClass}
                      value={editInterest}
                      onChange={(e) => setEditInterest(e.target.value)}
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Fees
                    <input
                      inputMode="decimal"
                      className={inputClass}
                      value={editFees}
                      onChange={(e) => setEditFees(e.target.value)}
                    />
                  </label>
                </div>
                <label className="mt-3 block text-sm font-semibold">
                  Payment date
                  <input
                    type="date"
                    className={inputClass}
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </label>
                <button
                  onClick={savePayment}
                  disabled={saving}
                  className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-primary font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {saving ? (
                    <LoaderCircle className="size-5 animate-spin" />
                  ) : (
                    <Check className="size-5" />
                  )}
                  Save changes
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function PaymentRow({
  item,
  currency,
  onEdit,
}: {
  item: Payment;
  currency: string;
  onEdit: (payment: Payment) => void;
}) {
  const content = (
    <>
      <CalendarDays className="size-5 text-primary" />
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-semibold">
          {item.kind === "disbursement" ? "Loan started" : "Payment"}
        </p>
        <p className="text-xs text-muted-foreground">
          {item.date} · Principal {formatCurrencyAmount(item.principal)}
        </p>
      </div>
      <p className="text-sm font-semibold tabular-nums">
        {formatCurrencyAmount(item.principal + item.interest + item.fees)}{" "}
        {currency}
      </p>
      {item.kind === "payment" ? (
        <Edit3
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      ) : null}
    </>
  );
  return item.kind === "payment" ? (
    <button
      type="button"
      onClick={() => onEdit(item)}
      aria-label={`Edit payment from ${item.date}`}
      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35"
    >
      {content}
    </button>
  ) : (
    <div className="flex items-center gap-3 p-4">{content}</div>
  );
}
