"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, HandCoins, Plus } from "lucide-react";
import { authenticatedFetch } from "@/lib/auth-client";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { PageHeader } from "@/components/layout/page-header";
import { GuideIcon } from "@/components/guides/feature-guide";
import { ListDataSkeleton } from "@/components/ui/data-skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatCurrencyAmount } from "@/lib/currency";

type LoanDirection = "borrowed" | "lent";
type Loan = {
  id: string;
  accountId: string;
  name: string;
  counterparty: string | null;
  direction: LoanDirection;
  currency: string;
  outstandingPrincipal: number;
  originalPrincipal: number;
  nextDueDate: string | null;
  status: "active" | "paid_off" | "archived";
};
type Account = {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
  currency: string;
};

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [legacy, setLegacy] = useState<Account[]>([]);
  const [tab, setTab] = useState<LoanDirection>("borrowed");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [conversionAccount, setConversionAccount] = useState<Account | null>(null);

  async function load() {
    setLoading(true);
    const [loanResponse, accountResponse] = await Promise.all([
      authenticatedFetch("/api/loans"),
      authenticatedFetch("/api/accounts?includeLoanAccounts=true"),
    ]);
    if (!loanResponse.ok || !accountResponse.ok) {
      setError("Could not load loans");
      setLoading(false);
      return;
    }
    const loanData = (await loanResponse.json()) as { loans: Loan[] };
    const accountData = (await accountResponse.json()) as {
      accounts: Account[];
    };
    setLoans(loanData.loans);
    const detailedAccountIds = new Set(
      loanData.loans.map((loan) => loan.accountId),
    );
    setLegacy(
      accountData.accounts.filter(
        (account) =>
          account.type === "loan" && !detailedAccountIds.has(account.id),
      ),
    );
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const visible = loans.filter(
    (loan) => loan.direction === tab && loan.status === "active",
  );
  const paidOff = loans.filter(
    (loan) => loan.direction === tab && loan.status === "paid_off",
  );
  const outstandingCounts = useMemo(
    () => ({
      borrowed: loans.filter(
        (loan) =>
          loan.direction === "borrowed" &&
          loan.status === "active" &&
          loan.outstandingPrincipal > 0,
      ).length,
      lent: loans.filter(
        (loan) =>
          loan.direction === "lent" &&
          loan.status === "active" &&
          loan.outstandingPrincipal > 0,
      ).length,
    }),
    [loans],
  );
  const totals = useMemo(
    () =>
      visible.reduce<Record<string, number>>(
        (result, loan) => ({
          ...result,
          [loan.currency]:
            (result[loan.currency] ?? 0) + loan.outstandingPrincipal,
        }),
        {},
      ),
    [visible],
  );

  async function convert(account: Account, direction: LoanDirection) {
    const response = await authenticatedFetch("/api/loans/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: account.id, direction }),
    });
    if (response.ok) {
      setConversionAccount(null);
      await load();
    }
    else setError("Could not convert this account");
  }

  return (
    <main className="page-route-enter min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-12">
        <StickyPageHeader className="-mx-4 px-4 pb-3">
          <PageHeader
            leading={<Link href="/profile" aria-label="Back to profile" className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card"><ArrowLeft aria-hidden="true" className="size-5" /></Link>}
            title={<div className="min-w-0"><p className="text-xs text-muted-foreground">Plan repayments</p><h1 className="text-[27px] font-semibold">Loans</h1></div>}
            secondary={<GuideIcon href="/loans/guide" label="Loans" />}
            actions={<Link href="/loans/new" className="flex size-11 items-center justify-center rounded-[11px] bg-primary text-primary-foreground" aria-label="Add loan"><Plus aria-hidden="true" className="size-5" /></Link>}
          />
        </StickyPageHeader>
        {error ? (
          <p className="mt-4 rounded-[12px] bg-expense-soft p-3 text-sm text-expense">
            {error}
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-[13px] bg-surface-subtle p-1">
          {(["borrowed", "lent"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`relative flex min-h-10 items-center justify-center rounded-[10px] px-9 text-sm font-semibold ${tab === value ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
            >
              <span>{value === "borrowed" ? "I owe" : "Owed to me"}</span>
              <span
                aria-label={`${outstandingCounts[value]} outstanding ${outstandingCounts[value] === 1 ? "loan" : "loans"}`}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold leading-none tabular-nums"
              >
                {outstandingCounts[value]}
              </span>
            </button>
          ))}
        </div>
        <section className="mt-5 rounded-[16px] border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Outstanding</p>
          {Object.entries(totals).length ? (
            Object.entries(totals).map(([currency, amount]) => (
              <p
                key={currency}
                className="mt-1 text-[30px] font-semibold tabular-nums"
              >
                <span className="mr-2 text-sm text-muted-foreground">
                  {currency}
                </span>
                {formatCurrencyAmount(amount)}
              </p>
            ))
          ) : (
            <p className="mt-1 text-[30px] font-semibold">0</p>
          )}
        </section>
        {loading ? (
          <div className="mt-5">
            <ListDataSkeleton rows={4} />
          </div>
        ) : (
          <LoanSections visible={visible} paidOff={paidOff} tab={tab} />
        )}
        {legacy.length ? (
          <section className="mt-7">
            <h2 className="text-lg font-semibold">Upgrade loan accounts</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose the direction before Luna adds repayment planning.
            </p>
            <div className="mt-3 space-y-2">
              {legacy.map((account) => (
                <button
                  key={account.id}
                  onClick={() => setConversionAccount(account)}
                  className="flex min-h-12 w-full items-center justify-between rounded-[13px] border border-warning/30 bg-warning-soft px-4 text-left text-sm font-semibold"
                >
                  {account.name}
                  <span className="text-xs text-muted-foreground">
                    {formatCurrencyAmount(Math.abs(account.currentBalance))}{" "}
                    {account.currency}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        <ConfirmDialog
          open={conversionAccount !== null}
          title="Convert this loan account?"
          description={conversionAccount ? `Choose how “${conversionAccount.name}” should be tracked in Loans.` : "Choose how this account should be tracked in Loans."}
          cancelLabel="Cancel"
          secondaryLabel="Owed to me"
          confirmLabel="I owe"
          onCancel={() => setConversionAccount(null)}
          onSecondary={() => conversionAccount ? convert(conversionAccount, "lent") : undefined}
          onConfirm={() => conversionAccount ? convert(conversionAccount, "borrowed") : undefined}
        />
      </div>
    </main>
  );
}

function LoanSections({
  visible,
  paidOff,
  tab,
}: {
  visible: Loan[];
  paidOff: Loan[];
  tab: LoanDirection;
}) {
  return (
    <>
      {visible.length ? (
        <section className="mt-5 space-y-2">
          {visible.map((loan) => (
            <LoanCard key={loan.id} loan={loan} tab={tab} />
          ))}
        </section>
      ) : paidOff.length ? null : (
        <section className="mt-5 rounded-[16px] border border-dashed border-border p-8 text-center">
          <HandCoins className="mx-auto size-8 text-primary" />
          <p className="mt-3 font-semibold">
            No {tab === "borrowed" ? "loans you owe" : "money lent"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add one to track principal, interest, and due dates.
          </p>
        </section>
      )}
      {paidOff.length ? (
        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Paid off</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Completed repayment plans
              </p>
            </div>
            <span className="text-sm font-semibold text-muted-foreground">
              {paidOff.length}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {paidOff.map((loan) => (
              <LoanCard key={loan.id} loan={loan} tab={tab} dimmed />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function LoanCard({
  loan,
  tab,
  dimmed = false,
}: {
  loan: Loan;
  tab: LoanDirection;
  dimmed?: boolean;
}) {
  const progress = loan.originalPrincipal
    ? Math.max(
        0,
        Math.min(
          100,
          ((loan.originalPrincipal - loan.outstandingPrincipal) /
            loan.originalPrincipal) *
            100,
        ),
      )
    : 0;
  return (
    <Link
      href={`/loans/${loan.id}`}
      className={`block rounded-[14px] border border-border bg-card p-4 transition-colors hover:bg-surface-subtle ${dimmed ? "opacity-65" : ""}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex size-10 items-center justify-center rounded-[10px] ${dimmed ? "bg-surface-subtle text-foreground-subtle" : "bg-info-soft text-info"}`}
        >
          <HandCoins className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {loan.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {loan.counterparty ||
              (tab === "borrowed" ? "Lender not added" : "Borrower not added")}
          </span>
        </span>
        <span className="text-right">
          <span className="block text-sm font-semibold tabular-nums">
            {formatCurrencyAmount(loan.outstandingPrincipal)} {loan.currency}
          </span>
          <span className="text-xs text-muted-foreground">
            {loan.nextDueDate
              ? `Due ${loan.nextDueDate}`
              : loan.status.replace("_", " ")}
          </span>
        </span>
        <ChevronRight className="size-4 text-foreground-subtle" />
      </div>
      <div
        className={`mt-3 h-2 overflow-hidden rounded-full ${dimmed ? "bg-surface-subtle" : "bg-info-soft"}`}
      >
        <div
          className={`h-full rounded-full ${dimmed ? "bg-foreground-subtle" : "bg-info"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </Link>
  );
}
