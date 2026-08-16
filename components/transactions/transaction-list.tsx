"use client";

import { useRouter } from "next/navigation";
import { createElement, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ChevronRight,
  Layers3,
  LoaderCircle,
  ReceiptText,
  Search,
  X,
} from "lucide-react";

import { authenticatedFetch } from "@/lib/auth-client";
import { getCurrentRoute, withReturnTo } from "@/lib/navigation";
import type { AppliedPeriod } from "@/components/home/date-picker";
import { AccountAvatar } from "@/components/accounts/account-avatar";
import {
  getCategoryForeground,
  getCategoryIcon,
} from "@/lib/category-appearance";
import { getAccountBackgroundColor, getAccountForeground } from "@/lib/account-appearance";
import { ListDataSkeleton } from "@/components/ui/data-skeleton";
import { transactionTypeMeta as typeMeta } from "@/components/transactions/transaction-presentation";
import { ActivityAlertRow, useActivityAlerts, type ActivityAlert } from "@/components/home/activity-alerts";

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

function compactAccountName(account: string) {
  return account.replace(" Wallet", "").replace(" account", "");
}

function transactionTime(transaction: Pick<ApiTransaction, "date" | "transactionAt" | "createdAt">) {
  const transactionAt = Date.parse(transaction.transactionAt);
  if (!Number.isNaN(transactionAt)) return transactionAt;
  const createdAt = Date.parse(transaction.createdAt ?? "");
  if (!Number.isNaN(createdAt)) return createdAt;
  return dateValue(transaction.date).getTime();
}

function timelineTime(item: TimelineItem) {
  const timestamp = Date.parse(item.timestamp);
  if (!Number.isNaN(timestamp)) return timestamp;
  return dateValue(item.date).getTime();
}

export function TransactionList({ limit, searchable = false, period, includeAlerts = false }: TransactionListProps) {
  const router = useRouter();
  const activityAlerts = useActivityAlerts(includeAlerts);
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setLoading(true);
      setRefreshVersion((version) => version + 1);
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
    let active = true;
    const params = new URLSearchParams();
    if (searchable && searchQuery) params.set("q", searchQuery);
    if (period?.mode !== "all" && period?.from && period.to) {
      params.set("from", localDateKey(period.from));
      params.set("to", localDateKey(period.to));
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    void authenticatedFetch(`/api/transactions${query}`)
      .then(async (transactionsResponse) => {
        if (!transactionsResponse.ok) return;
        const result = (await transactionsResponse.json()) as {
          transactions?: ApiTransaction[];
        };
        if (active) {
          setTransactions(result.transactions ?? []);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setLoading(false);
          setSearchLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [period, refreshVersion, searchQuery, searchable]);

  const visibleTransactions = [...transactions]
    .sort((left, right) => transactionTime(right) - transactionTime(left) || right.id.localeCompare(left.id))
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
      const alertDate = new Date(alert.createdAt || alert.showAt);
      const date = Number.isNaN(alertDate.getTime()) ? alert.showAt.slice(0, 10) : localDateKey(alertDate);
      if (period?.mode !== "all" && period?.from && period.to) {
        const from = localDateKey(period.from);
        const to = localDateKey(period.to);
        if (date < from || date > to) continue;
      }
      timeline.push({ kind: "alert", id: alert.id, date, timestamp: alert.createdAt || alert.showAt, alert });
    }
    timeline.sort((left, right) => timelineTime(right) - timelineTime(left) || right.id.localeCompare(left.id));
    const grouped = new Map<string, TimelineItem[]>();
    for (const item of timeline) grouped.set(item.date, [...(grouped.get(item.date) ?? []), item]);
    return [...grouped.entries()];
  }, [activityAlerts, period, visibleTransactions]);

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

  if (loading) {
    return <>{searchControls}<ListDataSkeleton rows={3} /></>;
  }

  if (!transactions.length && !activityAlerts.length) {
    return (
      <>
        {searchControls}
        <div className="route-data-reveal mt-5 rounded-[14px] border border-dashed border-border-strong bg-card px-5 py-10 text-center">
        <ReceiptText
          aria-hidden="true"
          className="mx-auto size-7 text-foreground-subtle"
        />
        <p className="mt-3 text-sm font-semibold">No transactions yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {searchQuery ? "Try a different search term." : "Your real activity will appear here after you add a transaction."}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {searchControls}
      <div className="route-data-reveal mt-5 space-y-7">
      {groups.map(([date, items]) => (
        <section aria-labelledby={`transaction-group-${date}`} key={date}>
          <div className="flex items-end justify-between gap-4 px-1">
            <h3
              id={`transaction-group-${date}`}
              className="text-[15px] font-semibold"
            >
              {formatDateLabel(date)}
            </h3>
          </div>
          <div className="mt-3 overflow-hidden rounded-[14px] border border-border bg-card">
            {items.map((timelineItem, index) => {
              if (timelineItem.kind === "alert") {
                return <ActivityAlertRow key={`alert:${timelineItem.id}`} alert={timelineItem.alert} />;
              }
              const transaction = timelineItem.transaction;
              const previousItem = items[index - 1];
              const showTransactionDivider = previousItem?.kind === "transaction";
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
              return (
                <div
                  role="link"
                  tabIndex={0}
                  aria-label={`Open ${transaction.title || transaction.categoryName || meta.label} transaction`}
                  onClick={() => router.push(`/transactions/${transaction.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/transactions/${transaction.id}`);
                    }
                  }}
                  key={`transaction:${transaction.id}`}
                  className={`group flex min-h-[76px] cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 ${showTransactionDivider ? "border-t border-border" : ""}`}
                >
                  <span
                    className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[10px]"
                    style={{
                      backgroundColor: categoryColor,
                      color: getCategoryForeground(categoryColor),
                    }}
                  >
                    {transaction.categoryName || transaction.splits.length ? (
                      createElement(CategoryIcon, {
                        "aria-hidden": true,
                        className: "size-[18px]",
                      })
                    ) : (
                      <Icon aria-hidden="true" className="size-[18px]" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                      <h4 className="transaction-list-title-clamp min-w-0 break-words text-[15px] font-semibold leading-5 sm:truncate">
                        {transaction.title ||
                          transaction.categoryName ||
                          meta.label}
                      </h4>
                      <p
                        className={`max-w-full break-words text-[14px] font-semibold leading-5 tabular-nums sm:shrink-0 sm:whitespace-nowrap sm:text-right ${meta.amountClassName}`}
                      >
                        {formatAmount(transaction)}
                      </p>
                    </div>
                    <div className="mt-1.5 flex min-w-0 flex-col gap-1.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-1.5">
                      {transactionDescription ? (
                        <span className="transaction-list-description-clamp min-w-0 break-words leading-4 sm:flex-1 sm:truncate">
                          {transactionDescription}
                        </span>
                      ) : null}
                      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 sm:contents">
                      {transaction.splits.length ? (
                        <span className="flex w-fit max-w-full shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-primary-soft px-2 py-1 text-[10px] font-semibold text-primary">
                          <Layers3 aria-hidden="true" className="size-3 shrink-0" />
                          {transaction.splits.length} categories
                        </span>
                      ) : transaction.categoryName ? (
                        <span
                          role="link"
                          tabIndex={0}
                          aria-label={`Open ${transaction.categoryName} category`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (transaction.categoryId) router.push(withReturnTo(`/categories/${transaction.categoryId}`, getCurrentRoute()));
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              if (transaction.categoryId) router.push(withReturnTo(`/categories/${transaction.categoryId}`, getCurrentRoute()));
                            }
                          }}
                          className="flex min-w-0 max-w-full shrink-0 items-center gap-1 rounded-none border-0 px-0 py-0 text-[11px] font-medium [background-color:transparent] [border-color:transparent] sm:max-w-32 sm:rounded-full sm:border sm:px-2 sm:py-1 sm:text-[10px] sm:font-semibold sm:[background-color:var(--category-background)] sm:[border-color:var(--category-border)]"
                          style={{
                            "--category-background": `${categoryColor}88`,
                            "--category-border": `${categoryColor}cc`,
                            color: getCategoryForeground(categoryColor),
                          } as CSSProperties}
                        >
                          {createElement(CategoryIcon, {
                            "aria-hidden": true,
                            className: "size-3 shrink-0",
                          })}
                          <span className="truncate">
                            {transaction.categoryName}
                          </span>
                        </span>
                      ) : null}
                      {!transaction.splits.length && transaction.categoryName ? (
                        <span aria-hidden="true" className="text-[10px] text-muted-foreground sm:hidden">·</span>
                      ) : null}
                      {(() => {
                        const accountColor = getAccountBackgroundColor(transaction.accountColor, transaction.accountType);
                        const accountForeground = getAccountForeground(accountColor, transaction.accountType);
                        return (
                      <span
                        role="link"
                        tabIndex={0}
                        aria-label={`Open ${transaction.accountName} account`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          router.push(`/accounts/${transaction.accountId}`);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            router.push(`/accounts/${transaction.accountId}`);
                          }
                        }}
                        className="flex min-w-0 max-w-full shrink-0 items-center gap-1 rounded-none border-0 px-0 py-0 text-[11px] font-medium text-foreground [background-color:transparent] [border-color:transparent] sm:max-w-[min(11rem,45vw)] sm:rounded-full sm:border sm:px-2 sm:py-1 sm:text-[10px] sm:font-semibold sm:[background-color:var(--account-background)] sm:[border-color:var(--account-border)]"
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
                            <span aria-hidden="true" className="shrink-0 text-[9px] text-muted-foreground">→</span>
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
                      </span>
                        );
                      })()}
                      </span>
                    </div>
                  </div>
                  <ChevronRight
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-foreground-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
      </div>
    </>
  );
}
