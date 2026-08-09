"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Edit3,
} from "lucide-react";

import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { AccountAvatar } from "@/components/accounts/account-avatar";
import { DatePicker, type AppliedPeriod } from "@/components/home/date-picker";
import { authenticatedFetch } from "@/lib/auth-client";
import { sumMoney } from "@/lib/money";
import { VerifyBalanceEditor } from "@/components/accounts/verify-balance-editor";
import { getCurrentRoute, getReturnTo, withReturnTo } from "@/lib/navigation";
import { getCategoryForeground, getCategoryIcon } from "@/lib/category-appearance";
import { getAccountBackgroundColor } from "@/lib/account-appearance";
import { transactionTypeMeta as transactionMeta } from "@/components/transactions/transaction-presentation";
import {
  ListDataSkeleton,
  PageDataSkeleton,
} from "@/components/ui/data-skeleton";

type Account = {
  id: string;
  name: string;
  type:
  | "checking"
  | "cash"
  | "credit_card"
  | "general"
  | "savings"
  | "investment"
  | "loan"
  | "other";
  currency: string;
  currentBalance: number;
  icon: string | null;
  backgroundColor: string | null;
  isDefault: boolean;
};

type AccountTransaction = {
  id: string;
  type: "expense" | "income" | "savings" | "transfer" | "adjust_balance" | "goal_spend";
  amount: number;
  title: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  notes: string | null;
  date: string;
  transferToAccountId: string | null;
  goalId: string | null;
};

type Category = { id: string; name: string; type: "expense" | "income" };
const typeLabels: Record<Account["type"], string> = {
  checking: "Bank account",
  cash: "Cash account",
  credit_card: "Credit card",
  general: "Wallet",
  savings: "Savings account",
  investment: "Investment account",
  loan: "Loan account",
  other: "Other account",
};

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function currentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthValue = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${monthValue}-01`,
    to: `${year}-${monthValue}-${String(lastDay).padStart(2, "0")}`,
    label: new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(now),
  };
}

function defaultAccountPeriod(): AppliedPeriod {
  const current = currentMonthRange();
  return {
    mode: "month",
    label: current.label,
    from: new Date(`${current.from}T00:00:00`),
    to: new Date(`${current.to}T00:00:00`),
  };
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

export default function AccountActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [backHref, setBackHref] = useState("/accounts");
  const [currentRoute, setCurrentRoute] = useState("/");
  const [accountId, setAccountId] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [period, setPeriod] = useState<AppliedPeriod>(defaultAccountPeriod);
  const [loadedPeriod, setLoadedPeriod] = useState<AppliedPeriod | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [balanceEditorOpen, setBalanceEditorOpen] = useState(false);
  const [transactionRefreshKey, setTransactionRefreshKey] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setBackHref(getReturnTo("/accounts"));
      setCurrentRoute(getCurrentRoute());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    void params.then(({ id }) => {
      if (active) setAccountId(id);
    });
    return () => {
      active = false;
    };
  }, [params]);

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    void authenticatedFetch(`/api/accounts/${accountId}`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? "Please sign in to view this account."
              : "Account not found.",
          );
        const result = (await response.json()) as { account: Account };
        if (active) setAccount(result.account);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load account.",
          );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    const query = new URLSearchParams({ accountId });
    if (period.from && period.to) {
      query.set("from", period.from.toISOString().slice(0, 10));
      query.set("to", period.to.toISOString().slice(0, 10));
    }
    void Promise.all([
      authenticatedFetch(`/api/transactions?${query.toString()}`),
      authenticatedFetch("/api/categories"),
    ])
      .then(async ([transactionResponse, categoryResponse]) => {
        if (!transactionResponse.ok)
          throw new Error(
            transactionResponse.status === 401
              ? "Please sign in to view transactions."
              : "Could not load transactions.",
          );
        const transactionResult = (await transactionResponse.json()) as {
          transactions: AccountTransaction[];
        };
        const categoryResult = categoryResponse.ok
          ? ((await categoryResponse.json()) as { categories: Category[] })
          : { categories: [] };
        if (active) {
          setTransactions(transactionResult.transactions);
          setCategories(categoryResult.categories);
          setLoadedPeriod(period);
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load transactions.",
          );
      });
    return () => {
      active = false;
    };
  }, [accountId, period, transactionRefreshKey]);

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const income = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => sumMoney([total, transaction.amount]), 0);
  const expenses = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => sumMoney([total, transaction.amount]), 0);
  const isLoadingTransactions = loadedPeriod !== period;
  if (isLoading) return <PageDataSkeleton label="Loading account" />;
  if (!account)
    return (
      <main className="min-h-dvh bg-background px-4 py-8">
        <div
          role="alert"
          className="mx-auto max-w-[720px] rounded-[14px] border border-expense/25 bg-expense-soft p-4 text-sm text-expense"
        >
          {error || "Account not found."}
        </div>
      </main>
    );

  const accountAccent = getAccountBackgroundColor(account.backgroundColor, account.type);

  return (
    <main className="page-route-enter min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-28 sm:px-5">
        <div className="-mx-4 sm:-mx-5" style={{ backgroundColor: accountAccent }}>
          <StickyPageHeader className="!w-full px-4 pb-3 sm:px-5">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  href={backHref}
                  aria-label="Back"
                  className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                >
                  <ArrowLeft aria-hidden="true" className="size-5" />
                </Link>
                <div className="min-w-0">
                  <h1 className="truncate text-[24px] font-semibold tracking-[-0.04em]">
                    {account.name}
                  </h1>
                  <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                    {typeLabels[account.type]}
                    {account.isDefault ? " · Default" : ""}
                  </p>
                </div>
              </div>
              <Link
                href={withReturnTo(`/accounts/${account.id}/edit`, currentRoute)}
                aria-label="Edit account"
                className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                <Edit3 aria-hidden="true" className="size-[18px]" />
              </Link>
            </div>
          </StickyPageHeader>
          <section
            aria-label="Current account balance"
            className="border-y border-black/10 px-4 py-8 text-center text-foreground sm:px-5"
          >
            <div className="mx-auto flex size-12 items-center justify-center overflow-hidden rounded-[14px] border border-black/10 bg-white/55">
              <AccountAvatar icon={account.icon} name={account.name} type={account.type} backgroundColor={account.backgroundColor} size={48} />
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Current balance
            </p>
            <button
              type="button"
              aria-label="Verify and edit current balance"
              onClick={() => setBalanceEditorOpen(true)}
              className="mt-1 block w-full rounded-[10px] text-[46px] font-bold leading-none tracking-[-0.06em] tabular-nums text-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              {formatAmount(account.currentBalance)}
            </button>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.1em] text-primary">
              {account.currency}
            </p>
            <button
              type="button"
              onClick={() => setBalanceEditorOpen(true)}
              className="mt-2 inline-flex min-h-7 items-center justify-center rounded-[8px] px-2 text-xs font-semibold text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:bg-primary-soft hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              Verify &amp; edit balance
            </button>
          </section>
        </div>
        <section
          aria-label="Account period summary"
          className="mt-5 grid grid-cols-2 divide-x divide-border rounded-[14px] border border-border bg-card"
        >
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Income {period.mode === "month" ? "this month" : "shown"}
            </p>
            <p className="mt-1 text-[16px] font-semibold tabular-nums text-income">
              +{formatAmount(income)} {account.currency}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Expense {period.mode === "month" ? "this month" : "shown"}
            </p>
            <p className="mt-1 text-[16px] font-semibold tabular-nums text-expense">
              −{formatAmount(expenses)} {account.currency}
            </p>
          </div>
        </section>
        <section
          aria-labelledby="account-transactions-heading"
          className="mt-8"
        >
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {period.label}
              </p>
              <h2
                id="account-transactions-heading"
                className="mt-1 text-[20px] font-semibold tracking-[-0.03em]"
              >
                Transactions
              </h2>
            </div>
            <DatePicker
              initialMode="month"
              initialLabel={period.label}
              onApply={setPeriod}
            />
          </div>
          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-[14px] border border-expense/25 bg-expense-soft p-4 text-sm text-expense"
            >
              {error}
            </div>
          ) : isLoadingTransactions ? (
            <ListDataSkeleton rows={3} />
          ) : transactions.length === 0 ? (
            <div className="mt-4 rounded-[14px] border border-dashed border-border-strong bg-card p-8 text-center">
              <p className="text-sm font-semibold">
                No transactions {period.mode === "month" ? "this month" : "yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Transactions recorded for this account will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-[14px] border border-border bg-card">
              {transactions.map((transaction, index) => {
                const meta = transactionMeta[transaction.type];
                const detail = transaction.categoryId
                  ? categoryNames.get(transaction.categoryId)
                  : null;
                const categoryName = transaction.categoryName ?? detail;
                const hasCategoryAppearance = Boolean(
                  transaction.categoryIcon || categoryName,
                );
                const categoryColor = transaction.categoryColor ?? "#dcece7";
                const Icon = hasCategoryAppearance
                  ? getCategoryIcon(transaction.categoryIcon, categoryName ?? undefined)
                  : meta.icon;
                return (
                  <div
                    key={transaction.id}
                    className={`flex items-center gap-3 px-4 py-3.5 ${index > 0 ? "border-t border-border" : ""}`}
                  >
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-[11px] ${hasCategoryAppearance ? "" : meta.iconClassName}`}
                      style={hasCategoryAppearance ? {
                        backgroundColor: categoryColor,
                        color: getCategoryForeground(categoryColor),
                      } : undefined}
                    >
                      <Icon aria-hidden="true" className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-[14px] font-semibold">
                          {transaction.title || categoryName || meta.label}
                        </p>
                        <p
                          className={`shrink-0 text-[14px] font-semibold tabular-nums ${meta.amountClassName}`}
                        >
                          {transaction.type === "adjust_balance"
                            ? transaction.amount >= 0 ? "+" : "−"
                            : transaction.type === "savings" && transaction.goalId
                              ? transaction.amount < 0 ? "+" : "−"
                              : transaction.type === "goal_spend"
                                ? ""
                                : meta.prefix}
                          {formatAmount(Math.abs(transaction.amount))} {account.currency}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">
                          {transaction.notes || meta.label}
                        </span>
                        <span className="shrink-0">
                          {formatDate(transaction.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <VerifyBalanceEditor
        open={balanceEditorOpen}
        account={account}
        onClose={() => setBalanceEditorOpen(false)}
        onSaved={(nextAccount) => { setAccount((current) => current ? { ...current, ...nextAccount } : current); setBalanceEditorOpen(false); setLoadedPeriod(null); setTransactionRefreshKey((current) => current + 1); }}
        onReviewTransactions={() => { setBalanceEditorOpen(false); window.requestAnimationFrame(() => { document.getElementById("account-transactions-heading")?.scrollIntoView({ behavior: "smooth", block: "start" }); }); }}
      />
    </main>
  );
}
