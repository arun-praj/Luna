"use client";

import Link from "next/link";
import { createElement, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ChevronRight,
  HandCoins,
  Layers3,
  LoaderCircle,
  ReceiptText,
  Search,
  X,
} from "lucide-react";

import { getAccessTokenSubject, getTransactionRefreshGeneration, revalidateAuthenticatedFetch } from "@/lib/auth-client";
import { hasFreshDataChanged, useHomeSnapshot, writeHomeSnapshot } from "@/lib/home-snapshot-cache";
import { getCurrentRoute, withReturnTo } from "@/lib/navigation";
import type { AppliedPeriod } from "@/components/home/date-picker";
import type { TransactionFilterState } from "@/components/transactions/transaction-filter-bar";
import { AccountAvatar } from "@/components/accounts/account-avatar";
import {
  getCategoryForeground,
  getCategoryIcon,
} from "@/lib/category-appearance";
import { getAccountBackgroundColor, getAccountForeground } from "@/lib/account-appearance";
import { ListDataSkeleton } from "@/components/ui/data-skeleton";
import { transactionTypeMeta as typeMeta } from "@/components/transactions/transaction-presentation";
import { ActivityAlertRow, useActivityAlerts, type ActivityAlert } from "@/components/home/activity-alerts";
import { calendarDateFromTimestamp, compareTimelineItems } from "@/lib/timeline-order";
import { isLoanTransaction, loanActivityLabel } from "@/components/transactions/transaction-detail/presentation-rules";
import { formatCurrencyAmount } from "@/lib/currency";
import { addMoney } from "@/lib/money";

export type ApiTransaction = {
  id: string;
  type: "expense" | "income" | "savings" | "transfer" | "adjust_balance" | "goal_spend";
  amount: number;
  title: string;
  merchantName: string | null;
  accountId: string;
  accountName: string;
  accountCurrency: string;
  accountIcon: string | null;
  accountColor: string | null;
  accountType?: string | null;
  savingsInstrumentId: string | null;
  goalId: string | null;
  loanId: string | null;
  loanComponent: "disbursement" | "principal" | "interest" | "fee" | null;
  transferToAccountId: string | null;
  destinationAccountName: string | null;
  destinationAccountIcon: string | null;
  destinationAccountColor: string | null;
  destinationAccountType?: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryType: "expense" | "income" | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  splits: Array<{
    categoryId: string;
    amount: number;
    note?: string | null;
    categoryName: string;
    categoryIcon: string | null;
    categoryColor: string | null;
  }>;
  notes: string | null;
  receiptImageUrl: string | null;
  tags: string[];
  date: string;
  transactionAt: string;
  createdAt?: string | null;
};

type TransactionListProps = {
  limit?: number;
  searchable?: boolean;
  period?: AppliedPeriod;
  includeAlerts?: boolean;
  filters?: Partial<TransactionFilterState>;
};

type TimelineItem =
  | { kind: "transaction"; id: string; date: string; timestamp: string; transaction: ApiTransaction }
  | { kind: "alert"; id: string; date: string; timestamp: string; alert: ActivityAlert };

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateValue(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatDateLabel(date: string) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date === localDateKey(today)) return "Today";
  if (date === localDateKey(yesterday)) return "Yesterday";
  if (date === localDateKey(tomorrow)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(dateValue(date));
}

function formatAmount(transaction: ApiTransaction) {
  if (transaction.type === "savings" && transaction.goalId) {
    return `${transaction.accountCurrency} ${Math.abs(transaction.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
  const prefix =
    transaction.type === "income" || transaction.type === "savings"
      ? "+"
      : transaction.type === "expense"
        ? "−"
        : transaction.type === "adjust_balance"
          ? transaction.amount >= 0 ? "+" : "−"
        : transaction.type === "goal_spend"
          ? "−"
          : "";
  return `${prefix}${transaction.accountCurrency} ${Math.abs(transaction.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function netAmount(transaction: ApiTransaction) {
  if (transaction.type === "transfer") return 0;
  if (transaction.type === "income" || transaction.type === "adjust_balance") return transaction.amount;
  return -Math.abs(transaction.amount);
}

function dailyNet(items: TimelineItem[]) {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== "transaction") continue;
    const currency = item.transaction.accountCurrency || "NPR";
    totals.set(currency, addMoney(totals.get(currency) ?? 0, netAmount(item.transaction)));
  }
  return [...totals.entries()];
}

function formatDailyNet(items: TimelineItem[]) {
  const totals = dailyNet(items);
  if (totals.length !== 1) return totals.length > 1 ? "Mixed" : "0";
  const [currency, amount] = totals[0];
  if (amount === 0) return "0";
  const sign = amount > 0 ? "+" : "−";
  return `${sign}${currency} ${formatCurrencyAmount(Math.abs(amount))}`;
}

function dailyNetClassName(items: TimelineItem[]) {
  const totals = dailyNet(items);
  if (totals.length !== 1 || totals[0][1] === 0) return "text-foreground";
  return totals[0][1] > 0 ? "text-income" : "text-expense";
}

function compactAccountName(account: string) {
  return account.replace(" Wallet", "").replace(" account", "");
}

export function buildTransactionRequestPath({
  searchable,
  searchQuery,
  period,
  filters,
}: {
  searchable: boolean;
  searchQuery: string;
  period?: AppliedPeriod;
  filters?: Partial<TransactionFilterState>;
}) {
  const params = new URLSearchParams();
  if (searchable && searchQuery) params.set("q", searchQuery);
  if (period?.mode !== "all" && period?.from && period.to) {
    params.set("from", localDateKey(period.from));
    params.set("to", localDateKey(period.to));
  }
  if (filters?.categoryId) params.set("categoryId", filters.categoryId);
  if (filters?.tag) params.set("tag", filters.tag);
  if (filters?.merchant) params.set("merchant", filters.merchant);
  const query = params.toString();
  return `/api/transactions${query ? `?${query}` : ""}`;
}

export function TransactionList({ limit, searchable = false, period, includeAlerts = false, filters }: TransactionListProps) {
  const activityAlerts = useActivityAlerts(includeAlerts);
  const [authSubject, setAuthSubject] = useState<string | null>(getAccessTokenSubject);
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [refreshGeneration, setRefreshGeneration] = useState(() => getTransactionRefreshGeneration());
  const [freshTransactionsKey, setFreshTransactionsKey] = useState<string | null>(null);
  const categoryId = filters?.categoryId;
  const tag = filters?.tag;
  const merchant = filters?.merchant;
  const requestPath = buildTransactionRequestPath({ searchable, searchQuery, period, filters: { categoryId, tag, merchant } });
  const queryStart = requestPath.indexOf("?");
  const scope = queryStart >= 0 ? requestPath.slice(queryStart + 1) : "all";
  const userId = authSubject;
  const scopeKey = `${userId ?? ""}:${scope}`;
  const cached = useHomeSnapshot<ApiTransaction[]>("transactions", userId, scope, Array.isArray);
  const [resolvedScopeKey, setResolvedScopeKey] = useState<string | null>(() => cached ? scopeKey : null);
  const lastTransactionsScopeRef = useRef(scopeKey);
  const lastTransactionsRef = useRef<ApiTransaction[] | null>(cached?.data ?? null);
  const [freshChangedVersion, setFreshChangedVersion] = useState(0);
  const [freshChangedScopeKey, setFreshChangedScopeKey] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthChanged = () => {
      const nextSubject = getAccessTokenSubject();
      if (nextSubject === userId) return;
      setAuthSubject(nextSubject);
      setTransactions([]);
      setSearch("");
      setSearchQuery("");
      setSearchLoading(false);
      setRefreshGeneration(getTransactionRefreshGeneration());
      setFreshTransactionsKey(null);
      setFreshChangedScopeKey(null);
      setFreshChangedVersion(0);
      setResolvedScopeKey(null);
    };
    window.addEventListener("cocomelon:auth-changed", handleAuthChanged);
    return () => window.removeEventListener("cocomelon:auth-changed", handleAuthChanged);
  }, [userId]);

  useEffect(() => {
    const refresh = (event: Event) => {
      const generation = event instanceof CustomEvent && typeof event.detail?.generation === "number"
        ? event.detail.generation
        : null;
      setRefreshGeneration((current) => Math.max(current + 1, generation ?? getTransactionRefreshGeneration()));
    };
    window.addEventListener("cocomelon:transactions-changed", refresh);
    return () => window.removeEventListener("cocomelon:transactions-changed", refresh);
  }, []);

  useEffect(() => {
    if (!searchable) return;
    const timeout = window.setTimeout(() => setSearchQuery(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search, searchable]);

  useEffect(() => {
    if (lastTransactionsScopeRef.current !== scopeKey || (lastTransactionsRef.current === null && cached)) {
      lastTransactionsScopeRef.current = scopeKey;
      lastTransactionsRef.current = cached?.data ?? null;
    }
  }, [cached, scopeKey]);

  useEffect(() => {
    let active = true;
    let confirmed = false;
    void revalidateAuthenticatedFetch(requestPath, {}, { generation: refreshGeneration })
      .then(async (transactionsResponse) => {
        if (!transactionsResponse.ok) return;
        const result = (await transactionsResponse.json()) as {
          transactions?: ApiTransaction[];
        };
        if (active) {
          const nextTransactions = result.transactions ?? [];
          const currentUserId = getAccessTokenSubject();
          if (currentUserId && (!userId || userId === currentUserId)) {
            writeHomeSnapshot("transactions", currentUserId, scope, nextTransactions);
            const freshChanged = hasFreshDataChanged(lastTransactionsRef.current, nextTransactions);
            lastTransactionsRef.current = nextTransactions;
            confirmed = true;
            setResolvedScopeKey(scopeKey);
            setTransactions((current) => JSON.stringify(current) === JSON.stringify(nextTransactions) ? current : nextTransactions);
            setFreshTransactionsKey(scopeKey);
            if (freshChanged) {
              setFreshChangedScopeKey(scopeKey);
              setFreshChangedVersion((current) => current + 1);
            }
          }
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          if (!confirmed && !cached) setResolvedScopeKey(scopeKey);
          setSearchLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [cached, refreshGeneration, requestPath, scope, scopeKey, userId]);

  const displayedTransactions = freshTransactionsKey === scopeKey ? transactions : cached?.data ?? [];
  const displayedLoading = freshTransactionsKey !== scopeKey && !cached && resolvedScopeKey !== scopeKey;
  const visibleTransactions = [...displayedTransactions]
    .sort((left, right) => compareTimelineItems(
      { id: left.id, date: left.date, timestamp: left.transactionAt, fallbackTimestamp: left.createdAt },
      { id: right.id, date: right.date, timestamp: right.transactionAt, fallbackTimestamp: right.createdAt },
    ))
    .slice(0, limit);
  const groups = useMemo(() => {
    const timeline: TimelineItem[] = visibleTransactions.map((transaction) => ({
      kind: "transaction",
      id: transaction.id,
      date: transaction.date,
      timestamp: transaction.transactionAt,
      transaction,
    }));
    for (const alert of activityAlerts) {
      const date = calendarDateFromTimestamp(alert.showAt) ?? calendarDateFromTimestamp(alert.createdAt) ?? alert.showAt.slice(0, 10);
      if (period?.mode !== "all" && period?.from && period.to) {
        const from = localDateKey(period.from);
        const to = localDateKey(period.to);
        if (date < from || date > to) continue;
      }
      timeline.push({ kind: "alert", id: alert.id, date, timestamp: alert.createdAt, alert });
    }
    timeline.sort((left, right) => compareTimelineItems(left, right));
    const grouped = new Map<string, TimelineItem[]>();
    for (const item of timeline) grouped.set(item.date, [...(grouped.get(item.date) ?? []), item]);
    return [...grouped.entries()];
  }, [activityAlerts, period, visibleTransactions]);
  const timelineSignature = JSON.stringify(groups);

  const searchControls = searchable ? (
    <div className="mt-5">
      {isSearchOpen ? (
        <div className="flex min-h-11 items-center gap-2 rounded-[11px] border border-primary/45 bg-card px-3 shadow-[0_0_0_3px_rgb(53_107_104_/_0.08)]">
          <Search aria-hidden="true" className="size-4 shrink-0 text-primary" />
          <input
            autoFocus
            value={search}
            onChange={(event) => { setSearch(event.target.value); setSearchLoading(true); }}
            placeholder="Search transactions"
            aria-label="Search transactions"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            aria-label={searchLoading ? "Searching transactions" : "Close transaction search"}
            disabled={searchLoading}
            onClick={() => { setSearch(""); setIsSearchOpen(false); }}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:opacity-80"
          >
            {searchLoading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <X aria-hidden="true" className="size-4" />}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-border bg-card px-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/45 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          <Search aria-hidden="true" className="size-4" />
          Search transactions
        </button>
      )}
    </div>
  ) : null;

  if (displayedLoading) {
    return <>{searchControls}<ListDataSkeleton rows={3} /></>;
  }

  if (!displayedTransactions.length && !activityAlerts.length) {
    const hasActiveFilters = Boolean(filters?.categoryId || filters?.tag || filters?.merchant);
    return (
      <>
        {searchControls}
        <div className={`${freshChangedScopeKey === scopeKey && freshChangedVersion ? "route-data-reveal" : ""} mt-5 rounded-[14px] border border-dashed border-border-strong bg-card px-5 py-10 text-center`}>
        <ReceiptText
          aria-hidden="true"
          className="mx-auto size-7 text-foreground-subtle"
        />
        <p className="mt-3 text-sm font-semibold">{hasActiveFilters ? "No matching transactions" : "No transactions yet"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {searchQuery ? "Try a different search term." : hasActiveFilters ? "Try clearing a filter or choosing another option." : "Your real activity will appear here after you add a transaction."}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {searchControls}
      <div key={`${timelineSignature}:${freshChangedScopeKey === scopeKey ? freshChangedVersion : 0}`} className={`${freshChangedScopeKey === scopeKey && freshChangedVersion ? "route-data-reveal" : ""} mt-5 space-y-7`}>
      {groups.map(([date, items]) => (
        <section aria-labelledby={`transaction-group-${date}`} key={date}>
          <div className="flex items-end justify-between gap-4 px-1">
            <h3 id={`transaction-group-${date}`} className="text-[15px] font-semibold">{formatDateLabel(date)}</h3>
            <p className={`text-[13px] font-semibold tabular-nums ${dailyNetClassName(items)}`}>{formatDailyNet(items)}</p>
          </div>
          <div className="mt-3 overflow-hidden rounded-[14px] border border-border bg-card">
            {items.map((timelineItem, index) => {
              if (timelineItem.kind === "alert") {
                return <ActivityAlertRow key={`alert:${timelineItem.id}`} alert={timelineItem.alert} />;
              }
              const transaction = timelineItem.transaction;
              const previousItem = items[index - 1];
              const loanTransaction = isLoanTransaction(transaction);
              const previousIsLoanTransaction = previousItem?.kind === "transaction" && isLoanTransaction(previousItem.transaction);
              const showTransactionDivider = previousItem?.kind === "transaction" && !loanTransaction && !previousIsLoanTransaction;
              const meta = typeMeta[transaction.type];
              const Icon = meta.icon;
              const primarySplit = transaction.splits[0];
              const CategoryIcon = getCategoryIcon(
                transaction.categoryIcon ?? primarySplit?.categoryIcon,
                transaction.categoryName ?? primarySplit?.categoryName,
              );
              const categoryColor = transaction.categoryColor ?? primarySplit?.categoryColor ?? "#dcece7";
              const isGoalWithdrawal = transaction.type === "savings" && Boolean(transaction.goalId) && transaction.amount < 0;
              const hasDestinationAccount = Boolean(transaction.destinationAccountName);
              const destinationAccountName = transaction.destinationAccountName ?? "Unknown account";
              const secondary = hasDestinationAccount
                ? isGoalWithdrawal
                  ? `${compactAccountName(destinationAccountName)} → ${compactAccountName(transaction.accountName)}`
                  : `${compactAccountName(transaction.accountName)} → ${compactAccountName(destinationAccountName)}`
                : compactAccountName(transaction.accountName);
              const sourceAccount = isGoalWithdrawal && hasDestinationAccount
                ? {
                    name: destinationAccountName,
                    icon: transaction.destinationAccountIcon,
                    type: transaction.destinationAccountType,
                    color: transaction.destinationAccountColor,
                  }
                : {
                    name: transaction.accountName,
                    icon: transaction.accountIcon,
                    type: transaction.accountType,
                    color: transaction.accountColor,
                  };
              const destinationAccount = isGoalWithdrawal
                ? {
                    name: transaction.accountName,
                    icon: transaction.accountIcon,
                    type: transaction.accountType,
                    color: transaction.accountColor,
                  }
                : {
                    name: destinationAccountName,
                    icon: transaction.destinationAccountIcon,
                    type: transaction.destinationAccountType,
                    color: transaction.destinationAccountColor,
                  };
              const transactionDescription = transaction.merchantName
                ? `${transaction.merchantName}${transaction.notes ? ` · ${transaction.notes}` : ""}`
                : transaction.notes;
              const transactionName = transaction.title || transaction.categoryName || meta.label;
              const loanLabel = loanTransaction && transaction.loanComponent
                ? loanActivityLabel(transaction.loanComponent)
                : null;
              const categoryHref = transaction.categoryId
                ? withReturnTo(`/categories/${transaction.categoryId}`, getCurrentRoute())
                : null;
              const categoryClassName = "flex min-h-8 min-w-0 max-w-full shrink-0 items-center gap-1 rounded-[8px] border px-2 py-0.5 text-[0.6875rem] font-semibold [background-color:var(--category-background)] [border-color:var(--category-border)] sm:max-w-36";
              const categoryStyle = {
                "--category-background": `${categoryColor}88`,
                "--category-border": `${categoryColor}cc`,
                color: getCategoryForeground(categoryColor),
              } as CSSProperties;
              const categoryContent = transaction.categoryName ? (
                <>
                  {createElement(CategoryIcon, {
                    "aria-hidden": true,
                    className: "size-3 shrink-0",
                  })}
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                    {transaction.categoryName}
                  </span>
                </>
              ) : null;
              return (
                <article
                  key={`transaction:${transaction.id}`}
                  className={`group/row relative isolate flex min-w-0 flex-col gap-1 transition-[background-color,border-color,box-shadow,transform] active:scale-[0.995] motion-reduce:transform-none ${loanTransaction ? "mx-2 my-2 rounded-[16px] border border-primary/20 bg-primary-soft/45 px-3 py-3 shadow-[0_8px_24px_rgb(31_112_104_/_0.08)] hover:border-primary/30 hover:bg-primary-soft/60" : `px-4 py-3.5 hover:bg-surface-subtle/70 ${showTransactionDivider ? "border-t border-border" : ""}`}`}
                >
                  <Link
                    href={`/transactions/${transaction.id}`}
                    aria-label={`Open ${transactionName} ${loanTransaction ? "loan activity" : "transaction"}, ${formatAmount(transaction)}`}
                    className={`group flex min-w-0 items-start gap-3 rounded-[10px] p-1 focus-visible:outline-none before:absolute before:inset-0 before:rounded-[12px] focus-visible:before:ring-2 focus-visible:before:ring-inset focus-visible:before:ring-primary/45 ${transactionDescription ? "min-h-11" : "min-h-0"}`}
                  >
                    <span
                      className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[11px] ${loanTransaction ? "bg-primary text-primary-foreground shadow-[0_5px_14px_rgb(31_112_104_/_0.18)]" : ""}`}
                      style={loanTransaction ? undefined : {
                        backgroundColor: categoryColor,
                        color: getCategoryForeground(categoryColor),
                      }}
                    >
                      {loanTransaction ? (
                        <HandCoins aria-hidden="true" className="size-[19px]" />
                      ) : transaction.categoryName || transaction.splits.length ? (
                        createElement(CategoryIcon, {
                          "aria-hidden": true,
                          className: "size-[18px]",
                        })
                      ) : (
                        <Icon aria-hidden="true" className="size-[18px]" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      {loanLabel ? (
                        <span className="mb-1.5 inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-primary">
                          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                          Loan · {loanLabel}
                        </span>
                      ) : null}
                      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                        <h4 className="min-w-0 break-words text-[0.9375rem] font-semibold leading-[1.35] [overflow-wrap:anywhere]">
                          {transactionName}
                        </h4>
                        <p
                          className={`max-w-full break-words text-[0.875rem] leading-[1.35] sm:shrink-0 sm:whitespace-nowrap sm:text-right ${loanTransaction ? "font-medium tracking-normal text-primary" : `font-semibold tabular-nums ${meta.amountClassName}`}`}
                        >
                          {formatAmount(transaction)}
                        </p>
                      </div>
                      {transactionDescription ? (
                        <p className="mt-1.5 min-w-0 break-words text-sm leading-[1.35] text-muted-foreground [overflow-wrap:anywhere]">
                          {transactionDescription}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight
                      aria-hidden="true"
                      className="mt-1 size-4 shrink-0 text-foreground-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary group-hover/row:translate-x-0.5 group-hover/row:text-primary"
                    />
                  </Link>
                  <div className={`flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 pl-[3.25rem] text-xs text-muted-foreground ${transactionDescription ? "" : "-mt-0.5"}`}>
                    {transaction.splits.length ? (
                        <span className="flex min-h-8 w-fit max-w-full shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-primary-soft px-2 py-0.5 text-[0.625rem] font-semibold text-primary">
                        <Layers3 aria-hidden="true" className="size-3 shrink-0" />
                        {transaction.splits.length} categories
                      </span>
                    ) : categoryContent ? (
                      categoryHref ? (
                        <Link
                          href={categoryHref}
                          aria-label={`Open ${transaction.categoryName} category`}
                          className={`relative z-10 ${categoryClassName} hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35`}
                          style={categoryStyle}
                        >
                          {categoryContent}
                        </Link>
                      ) : (
                        <span className={categoryClassName} style={categoryStyle}>
                          {categoryContent}
                        </span>
                      )
                    ) : null}
                    {!transaction.splits.length && transaction.categoryName ? (
                      <span aria-hidden="true" className="text-[0.625rem] text-muted-foreground">·</span>
                    ) : null}
                    {(() => {
                      const accountColor = getAccountBackgroundColor(transaction.accountColor, transaction.accountType);
                      const accountForeground = getAccountForeground(accountColor, transaction.accountType);
                      return (
                        <Link
                          href={`/accounts/${transaction.accountId}`}
                          aria-label={`Open ${transaction.accountName} account`}
                          className="relative z-10 flex min-h-8 min-w-0 max-w-full shrink-0 items-center gap-1 rounded-[8px] border px-2 py-0.5 text-[0.6875rem] font-semibold text-foreground [background-color:var(--account-background)] [border-color:var(--account-border)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 sm:max-w-[min(16rem,55vw)]"
                          style={{
                            "--account-background": `${accountColor}88`,
                            "--account-border": `${accountColor}cc`,
                            color: accountForeground,
                          } as CSSProperties}
                        >
                          {hasDestinationAccount ? (
                            <span className="flex min-w-0 items-center gap-1">
                              <AccountAvatar
                                icon={sourceAccount.icon}
                                name={sourceAccount.name}
                                type={sourceAccount.type}
                                backgroundColor={getAccountBackgroundColor(sourceAccount.color, sourceAccount.type)}
                                size={16}
                              />
                              <span className="min-w-0 truncate">{compactAccountName(sourceAccount.name)}</span>
                              <span aria-hidden="true" className="shrink-0 text-[0.5625rem] text-muted-foreground">→</span>
                              <AccountAvatar
                                icon={destinationAccount.icon}
                                name={destinationAccount.name}
                                type={destinationAccount.type}
                                backgroundColor={getAccountBackgroundColor(destinationAccount.color, destinationAccount.type)}
                                size={16}
                              />
                              <span className="min-w-0 truncate">{compactAccountName(destinationAccount.name)}</span>
                            </span>
                          ) : (
                            <>
                              <AccountAvatar
                                icon={sourceAccount.icon}
                                name={sourceAccount.name}
                                type={sourceAccount.type}
                                backgroundColor={getAccountBackgroundColor(sourceAccount.color, sourceAccount.type)}
                                size={16}
                              />
                              <span className="truncate">{secondary}</span>
                            </>
                          )}
                        </Link>
                      );
                    })()}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      </div>
    </>
  );
}
