"use client";

import { useRouter } from "next/navigation";
import { createElement, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
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

export type ApiTransaction = {
  id: string;
  type: "expense" | "income" | "savings" | "transfer" | "adjust_balance" | "goal_spend";
  amount: number;
  title: string;
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
  notes: string | null;
  tags: string[];
  date: string;
  transactionAt: string;
};

type TransactionListProps = {
  limit?: number;
  searchable?: boolean;
  period?: AppliedPeriod;
};

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
  if (date === localDateKey(today)) return "Today";
  if (date === localDateKey(yesterday)) return "Yesterday";
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

export function TransactionList({ limit, searchable = false, period }: TransactionListProps) {
  const router = useRouter();
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

  const visibleTransactions = limit
    ? transactions.slice(0, limit)
    : transactions;
  const groups = useMemo(() => {
    const grouped = new Map<string, ApiTransaction[]>();
    for (const transaction of visibleTransactions) {
      const current = grouped.get(transaction.date) ?? [];
      current.push(transaction);
      grouped.set(transaction.date, current);
    }
    return [...grouped.entries()];
  }, [visibleTransactions]);

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

  if (!transactions.length) {
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
            <div className="flex items-baseline gap-2">
              <h3
                id={`transaction-group-${date}`}
                className="text-[15px] font-semibold"
              >
                {formatDateLabel(date)}
              </h3>
              <p className="text-xs text-muted-foreground">
                {new Intl.DateTimeFormat("en-US", {
                  month: "long",
                  day: "numeric",
                }).format(dateValue(date))}
              </p>
            </div>
          </div>
          <div className="mt-3 overflow-hidden rounded-[14px] border border-border bg-card">
            {items.map((transaction, index) => {
              const meta = typeMeta[transaction.type];
              const Icon = meta.icon;
              const CategoryIcon = getCategoryIcon(
                transaction.categoryIcon,
                transaction.categoryName ?? undefined,
              );
              const categoryColor = transaction.categoryColor ?? "#dcece7";
              const isGoalWithdrawal = transaction.type === "savings" && Boolean(transaction.goalId) && transaction.amount < 0;
              const secondary = transaction.destinationAccountName
                ? isGoalWithdrawal
                  ? `${compactAccountName(transaction.destinationAccountName)} → ${compactAccountName(transaction.accountName)}`
                  : `${compactAccountName(transaction.accountName)} → ${compactAccountName(transaction.destinationAccountName)}`
                : compactAccountName(transaction.accountName);
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
                  key={transaction.id}
                  className={`group flex min-h-[76px] cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 ${index > 0 ? "border-t border-border" : ""}`}
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-[10px]"
                    style={{
                      backgroundColor: categoryColor,
                      color: getCategoryForeground(categoryColor),
                    }}
                  >
                    {transaction.categoryName ? (
                      createElement(CategoryIcon, {
                        "aria-hidden": true,
                        className: "size-[18px]",
                      })
                    ) : (
                      <Icon aria-hidden="true" className="size-[18px]" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <h4 className="truncate text-[15px] font-semibold">
                        {transaction.title ||
                          transaction.categoryName ||
                          meta.label}
                      </h4>
                      <p
                        className={`shrink-0 text-[14px] font-semibold tabular-nums ${meta.amountClassName}`}
                      >
                        {formatAmount(transaction)}
                      </p>
                    </div>
                    <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      {transaction.notes ? (
                        <span className="min-w-0 flex-1 truncate">
                          {transaction.notes}
                        </span>
                      ) : (
                        <span className="min-w-0 flex-1" />
                      )}
                      {transaction.categoryName ? (
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
                          className="flex max-w-32 shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold"
                          style={{
                            backgroundColor: `${categoryColor}88`,
                            borderColor: `${categoryColor}cc`,
                            color: getCategoryForeground(categoryColor),
                          }}
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
                        className="flex max-w-32 shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold text-foreground"
                        style={{
                          backgroundColor: `${accountColor}88`,
                          borderColor: `${accountColor}cc`,
                          color: accountForeground,
                        }}
                      >
                        <span className="flex size-4 shrink-0 overflow-hidden rounded-full">
                          <AccountAvatar
                            icon={transaction.accountIcon}
                            name={transaction.accountName}
                            type={transaction.accountType}
                            backgroundColor={accountColor}
                            size={16}
                          />
                        </span>
                        <span className="truncate">{secondary}</span>
                      </span>
                        );
                      })()}
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-foreground-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                      />
                    </div>
                  </div>
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
