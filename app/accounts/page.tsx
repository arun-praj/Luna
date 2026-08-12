"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  GripVertical,
  ListFilter,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { AccountAvatar } from "@/components/accounts/account-avatar";
import { AnimatedBalanceAmount } from "@/components/home/animated-balance-amount";
import { getAccountBackgroundColor, getAccountForeground } from "@/lib/account-appearance";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { authenticatedFetch } from "@/lib/auth-client";
import { addCurrencyAmount, currencyEntries, formatCurrencyAmount } from "@/lib/currency";
import { getCurrentRoute, getReturnTo, withReturnTo } from "@/lib/navigation";
import { ListDataSkeleton, Skeleton } from "@/components/ui/data-skeleton";
import { useAnimatedVisibility } from "@/lib/use-animated-visibility";
import { GuideIcon } from "@/components/guides/feature-guide";

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
  isDefault: boolean;
  includeInTotalBalance: boolean;
  icon: string | null;
  backgroundColor: string | null;
  monthlyIncome: number;
  monthlyExpense: number;
  displayOrder: number;
};
const cardClasses = [
  "border-[#c7dbd2] bg-[#e3eee9]",
  "border-[#cadde9] bg-[#e3eff6]",
  "border-[#d8cee7] bg-[#ece6f3]",
  "border-[#e3d2b6] bg-[#f3e8d4]",
];
const typeLabels = {
  checking: "Bank account",
  cash: "Cash account",
  credit_card: "Credit card",
  general: "Wallet",
  savings: "Savings",
  investment: "Investment",
  loan: "Loan",
  other: "Other",
};

function formatAmount(amount: number) { return formatCurrencyAmount(amount); }
function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function fetchAccountPageData(path: string) {
  try {
    return await authenticatedFetch(path);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message.toLowerCase() : "";
    if ((reason instanceof DOMException && reason.name === "AbortError") || message.includes("abort")) {
      return authenticatedFetch(path);
    }
    throw reason;
  }
}

function SortableAccountRow({ account }: { account: Account }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: account.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`flex min-h-14 items-center gap-3 rounded-[14px] border bg-card px-3 ${
        isDragging
          ? "z-10 border-primary bg-primary-soft shadow-[0_12px_30px_rgb(23_32_29_/_0.16)]"
          : "border-border"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${account.name}`}
        className="flex size-10 touch-none cursor-grab items-center justify-center rounded-[10px] text-muted-foreground active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
      >
        <GripVertical aria-hidden="true" className="size-5" />
      </button>
      <span className="flex size-[34px] shrink-0 overflow-hidden rounded-[9px]">
        <AccountAvatar icon={account.icon} name={account.name} type={account.type} backgroundColor={account.backgroundColor} size={34} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
        {account.name}
      </span>
    </div>
  );
}

function orderedCurrencyEntries(totals: Record<string, number>, preferredCurrency: string) {
  return currencyEntries(totals).sort(([left], [right]) => {
    if (left === preferredCurrency) return -1;
    if (right === preferredCurrency) return 1;
    return left.localeCompare(right);
  });
}

function SummaryAmount({
  entries,
  isLoading,
  preferredCurrency,
  hideTotalBalance = false,
  balanceRevealed = false,
  revealSecondsRemaining = 0,
  onToggleVisibility,
}: {
  entries: Array<[string, number]>;
  isLoading: boolean;
  preferredCurrency: string;
  hideTotalBalance?: boolean;
  balanceRevealed?: boolean;
  revealSecondsRemaining?: number;
  onToggleVisibility?: () => void;
}) {
  if (isLoading) return <Skeleton className="inline-block h-7 w-24 align-middle" />;
  const [primary, ...others] = entries.length ? entries : [[preferredCurrency, 0] as [string, number]];
  const amountColor = primary[1] < 0 ? "text-expense" : primary[1] > 0 ? "text-income" : "text-foreground";
  return (
    <>
      <span className={`block truncate text-[19px] font-semibold tracking-[-0.035em] tabular-nums ${amountColor} sm:text-[22px]`}>
        <span className="inline-flex items-baseline">
          <span className="mr-1 text-[10px] tracking-normal text-muted-foreground sm:text-xs">{primary[0]}</span>
          <AnimatedBalanceAmount
            amount={formatCurrencyAmount(primary[1])}
            hideTotalBalance={hideTotalBalance}
            balanceRevealed={balanceRevealed}
            revealSecondsRemaining={revealSecondsRemaining}
            onToggleVisibility={onToggleVisibility ?? (() => undefined)}
            className={amountColor}
          />
        </span>
      </span>
      {others.length ? (
        <span className="mt-1 block truncate text-[10px] font-semibold tabular-nums">
          {others.map(([currency, amount], index) => (
            <span key={currency} className={amount < 0 ? "text-expense" : amount > 0 ? "text-income" : "text-muted-foreground"}>{index ? " · " : ""}{currency} {hideTotalBalance && !balanceRevealed ? "****" : formatCurrencyAmount(amount)}</span>
          ))}
        </span>
      ) : null}
    </>
  );
}

const ACCOUNT_SWIPE_ACTION_WIDTH = 88;

function SwipeableAccountCard({
  account,
  index,
  currentRoute,
  open,
  onOpenChange,
}: {
  account: Account;
  index: number;
  currentRoute: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pointerStart = useRef<{ x: number; y: number; offset: number } | null>(null);
  const offsetRef = useRef(0);
  const draggedRef = useRef(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const offset = dragOffset ?? (open ? ACCOUNT_SWIPE_ACTION_WIDTH : 0);
  const backgroundColor = getAccountBackgroundColor(account.backgroundColor, account.type);
  const swipeActionColor = getAccountForeground(account.backgroundColor, account.type);

  const setSwipeOffset = (nextOffset: number) => {
    const clamped = Math.max(0, Math.min(ACCOUNT_SWIPE_ACTION_WIDTH, nextOffset));
    offsetRef.current = clamped;
    setDragOffset(clamped);
  };

  function handlePointerDown(event: ReactPointerEvent<HTMLAnchorElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const currentOffset = dragOffset ?? (open ? ACCOUNT_SWIPE_ACTION_WIDTH : 0);
    offsetRef.current = currentOffset;
    pointerStart.current = { x: event.clientX, y: event.clientY, offset: currentOffset };
    draggedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLAnchorElement>) {
    const start = pointerStart.current;
    if (!start) return;
    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = event.clientY - start.y;
    if (!draggedRef.current && Math.abs(horizontalDistance) < 8) return;
    if (!draggedRef.current && Math.abs(verticalDistance) > Math.abs(horizontalDistance)) {
      pointerStart.current = null;
      return;
    }
    draggedRef.current = true;
    setSwipeOffset(start.offset + horizontalDistance);
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLAnchorElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const shouldOpen = offsetRef.current >= ACCOUNT_SWIPE_ACTION_WIDTH / 2;
    setDragOffset(null);
    onOpenChange(shouldOpen);
    if (draggedRef.current) {
      window.setTimeout(() => {
        draggedRef.current = false;
      }, 0);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-[14px]" style={{ backgroundColor: swipeActionColor }}>
      <Link
        href={withReturnTo(`/accounts/${account.id}/edit`, currentRoute)}
        aria-label={`Edit ${account.name}`}
        style={{ backgroundColor: swipeActionColor }}
        className="absolute inset-y-0 left-0 flex w-[88px] flex-col items-center justify-center gap-1 text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2"
      >
        <Pencil aria-hidden="true" className="size-[18px]" />
        <span className="text-xs font-semibold">Edit</span>
      </Link>
      <Link
        href={withReturnTo(`/accounts/${account.id}`, currentRoute)}
        style={{ backgroundColor, transform: `translate3d(${offset}px, 0, 0)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClick={(event) => {
          if (draggedRef.current || open || dragOffset !== null) {
            event.preventDefault();
            onOpenChange(false);
          }
        }}
        className={`group relative block w-full touch-pan-y overflow-hidden rounded-[14px] border text-left will-change-transform transition-[filter,transform] duration-200 hover:brightness-[0.985] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${cardClasses[index % cardClasses.length]}`}
      >
        <span className="flex min-h-[72px] items-center gap-3 px-4 py-3">
          <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-white/80 bg-white/45 shadow-[0_1px_2px_rgba(23,32,29,0.06)]">
            <AccountAvatar icon={account.icon} name={account.name} type={account.type} backgroundColor={backgroundColor} size={44} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{account.name}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {typeLabels[account.type]}{account.isDefault ? " · Default" : ""}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-[17px] font-semibold tracking-[-0.025em] tabular-nums">{formatAmount(account.currentBalance)}</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{account.currency}</span>
          </span>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-foreground-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </span>
        <span className="grid grid-cols-2 divide-x divide-current/10 border-t border-current/10 bg-white/45">
          <span className="px-4 py-2.5">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Income this month</span>
            <span className="mt-0.5 block text-[13px] font-semibold tabular-nums text-income">+{formatAmount(account.monthlyIncome)} {account.currency}</span>
          </span>
          <span className="px-4 py-2.5">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Expense this month</span>
            <span className="mt-0.5 block text-[13px] font-semibold tabular-nums text-expense">−{formatAmount(account.monthlyExpense)} {account.currency}</span>
          </span>
        </span>
      </Link>
    </div>
  );
}

export default function AccountsPage() {
  const [backHref, setBackHref] = useState("/");
  const [currentRoute, setCurrentRoute] = useState("/");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("NPR");
  const [hideTotalBalance, setHideTotalBalance] = useState(false);
  const [balanceRevealed, setBalanceRevealed] = useState(false);
  const [balanceRevealSecondsRemaining, setBalanceRevealSecondsRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reorderOpen, setReorderOpen] = useState(false);
  const reorderTransition = useAnimatedVisibility(reorderOpen);
  const [draftOrder, setDraftOrder] = useState<Account[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [openSwipeAccountId, setOpenSwipeAccountId] = useState<string | null>(null);
  const balanceRevealTimer = useRef<number | null>(null);
  const balanceRevealCountdownTimer = useRef<number | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setBackHref(getReturnTo("/"));
      setCurrentRoute(getCurrentRoute());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      fetchAccountPageData(`/api/accounts?month=${currentMonthKey()}`),
      fetchAccountPageData("/api/auth/me"),
    ])
      .then(async ([accountResult, profileResult]) => {
        if (accountResult.status === "rejected" || !accountResult.value.ok)
          throw new Error(
            accountResult.status === "fulfilled" && accountResult.value.status === 401
              ? "Please sign in to view accounts."
              : "Could not load accounts.",
          );
        const accountData = await accountResult.value.json() as { accounts: Account[] };
        const profileData = profileResult.status === "fulfilled" && profileResult.value.ok
          ? await profileResult.value.json() as { user?: { currency?: string; hideTotalBalance?: boolean } }
          : null;
        if (active) {
          setAccounts(accountData.accounts);
          setDisplayCurrency(profileData?.user?.currency ?? accountData.accounts[0]?.currency ?? "NPR");
          setHideTotalBalance(profileData?.user?.hideTotalBalance === true);
          setBalanceRevealed(false);
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load accounts.",
          );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
      if (balanceRevealTimer.current !== null) window.clearTimeout(balanceRevealTimer.current);
      if (balanceRevealCountdownTimer.current !== null) window.clearInterval(balanceRevealCountdownTimer.current);
    };
  }, []);

  function revealTotalBalance() {
    if (!hideTotalBalance) return;
    if (balanceRevealTimer.current !== null) window.clearTimeout(balanceRevealTimer.current);
    if (balanceRevealCountdownTimer.current !== null) window.clearInterval(balanceRevealCountdownTimer.current);
    const startedAt = Date.now();
    setBalanceRevealed(true);
    setBalanceRevealSecondsRemaining(5);
    balanceRevealCountdownTimer.current = window.setInterval(() => {
      setBalanceRevealSecondsRemaining(Math.max(0, Math.ceil((5000 - (Date.now() - startedAt)) / 1000)));
    }, 100);
    balanceRevealTimer.current = window.setTimeout(() => {
      setBalanceRevealed(false);
      setBalanceRevealSecondsRemaining(0);
      if (balanceRevealCountdownTimer.current !== null) window.clearInterval(balanceRevealCountdownTimer.current);
      balanceRevealCountdownTimer.current = null;
      balanceRevealTimer.current = null;
    }, 5000);
  }

  function toggleBalanceVisibility() {
    if (!hideTotalBalance) return;
    if (balanceRevealed) {
      if (balanceRevealTimer.current !== null) window.clearTimeout(balanceRevealTimer.current);
      if (balanceRevealCountdownTimer.current !== null) window.clearInterval(balanceRevealCountdownTimer.current);
      balanceRevealTimer.current = null;
      balanceRevealCountdownTimer.current = null;
      setBalanceRevealSecondsRemaining(0);
      setBalanceRevealed(false);
      return;
    }
    revealTotalBalance();
  }

  const { excludedEntries, totalEntries } = useMemo(() => {
    const includedTotals: Record<string, number> = {};
    const excludedTotals: Record<string, number> = {};
    for (const account of accounts) {
      const target = account.includeInTotalBalance ? includedTotals : excludedTotals;
      addCurrencyAmount(target, account.currency, account.currentBalance);
    }
    return {
      totalEntries: orderedCurrencyEntries(includedTotals, displayCurrency),
      excludedEntries: orderedCurrencyEntries(excludedTotals, displayCurrency),
    };
  }, [accounts, displayCurrency]);

  function openReorder() {
    setDraftOrder([...accounts]);
    setReorderOpen(true);
  }
  async function saveOrder() {
    setIsSavingOrder(true);
    const response = await authenticatedFetch("/api/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountIds: draftOrder.map((account) => account.id),
      }),
    });
    if (response.ok) {
      setAccounts(draftOrder);
      setReorderOpen(false);
    }
    setIsSavingOrder(false);
  }

  const reorderSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setDraftOrder((current) => {
      const oldIndex = current.findIndex((account) => account.id === active.id);
      const newIndex = current.findIndex((account) => account.id === over.id);
      return oldIndex === -1 || newIndex === -1
        ? current
        : arrayMove(current, oldIndex, newIndex);
    });
  }

  return (
    <main className="page-route-enter min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-10 sm:px-5">
        <StickyPageHeader className="-mx-4 flex items-center justify-between gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={backHref}
              aria-label="Back"
              className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="text-[28px] font-semibold tracking-[-0.04em]">
                Accounts
              </h1>
              <GuideIcon href={withReturnTo("/accounts/guide", currentRoute)} label="Accounts" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Sort and organize accounts"
              onClick={openReorder}
              className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <ListFilter aria-hidden="true" className="size-[19px]" />
            </button>
            <Link
              href={withReturnTo("/accounts/new", currentRoute)}
              aria-label="Add new account"
              className="flex size-11 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary transition-colors hover:border-primary/40 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <Plus aria-hidden="true" className="size-5" />
            </Link>
          </div>
        </StickyPageHeader>
        <section
          aria-label="Account balance summary"
          className="mt-8 grid grid-cols-2 divide-x divide-border overflow-hidden rounded-[14px] border border-border bg-card"
        >
          <div className="min-w-0 px-4 py-4">
            <p className="text-xs font-semibold text-muted-foreground">
              Total balance
            </p>
            <p className="mt-2">
              <SummaryAmount
                entries={totalEntries}
                isLoading={isLoading}
                preferredCurrency={displayCurrency}
                hideTotalBalance={hideTotalBalance}
                balanceRevealed={balanceRevealed}
                revealSecondsRemaining={balanceRevealSecondsRemaining}
                onToggleVisibility={toggleBalanceVisibility}
              />
            </p>
          </div>
          <div className="min-w-0 px-4 py-4">
            <p className="text-xs font-semibold text-muted-foreground">
              Excluded from total
            </p>
            <p className="mt-2"><SummaryAmount entries={excludedEntries} isLoading={isLoading} preferredCurrency={displayCurrency} /></p>
          </div>
        </section>
        <section aria-labelledby="account-list-heading" className="mt-8">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Your money
              </p>
              <h2
                id="account-list-heading"
                className="mt-1 text-[20px] font-semibold tracking-[-0.03em]"
              >
                All accounts
              </h2>
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              {isLoading ? (
                <Skeleton className="h-4 w-16" />
              ) : (
                `${accounts.length} accounts`
              )}
            </p>
          </div>
          {isLoading ? (
            <ListDataSkeleton rows={4} />
          ) : error ? (
            <div
              role="alert"
              className="mt-4 rounded-[14px] border border-expense/25 bg-expense-soft p-4 text-sm text-expense"
            >
              {error}
            </div>
          ) : accounts.length === 0 ? (
            <div className="mt-4 rounded-[14px] border border-dashed border-border-strong bg-card p-8 text-center">
              <p className="text-sm font-semibold">No accounts yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add an account to start tracking your money.
              </p>
            </div>
          ) : (
            <div className="route-data-reveal mt-3 space-y-3">
              {accounts.map((account, index) => (
                <SwipeableAccountCard
                  key={account.id}
                  account={account}
                  index={index}
                  currentRoute={currentRoute}
                  open={openSwipeAccountId === account.id}
                  onOpenChange={(open) => setOpenSwipeAccountId(open ? account.id : null)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {reorderTransition.mounted ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reorder-accounts-title"
          className={`fixed inset-0 z-50 flex items-end bg-foreground/25 ${reorderTransition.closing ? "drawer-scrim-exit" : "drawer-scrim-enter"}`}
        >
          <div className={`${reorderTransition.closing ? "drawer-exit" : "drawer-enter"} w-full rounded-t-[24px] border-t border-border bg-background pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)]`}>
            <div
              className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-foreground/20"
              aria-hidden="true"
            />
            <header className="flex items-center justify-between border-b border-border px-4 pb-3 pt-3">
              <button
                type="button"
                aria-label="Close account reorder"
                onClick={() => setReorderOpen(false)}
                className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
              <div className="text-center">
                <h2
                  id="reorder-accounts-title"
                  className="text-base font-semibold"
                >
                  Organize accounts
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Drag to set the order
                </p>
              </div>
              <button
                type="button"
                aria-label="Save account order"
                onClick={() => void saveOrder()}
                disabled={isSavingOrder}
                className="flex size-11 items-center justify-center rounded-[11px] bg-primary-soft text-primary disabled:opacity-50"
              >
                <Check aria-hidden="true" className="size-5" />
              </button>
            </header>
            <div className="max-h-[58dvh] overflow-y-auto px-4 py-4">
              <DndContext
                sensors={reorderSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={draftOrder.map((account) => account.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {draftOrder.map((account) => (
                      <SortableAccountRow key={account.id} account={account} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
