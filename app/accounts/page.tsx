"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  Plus,
  X,
} from "lucide-react";
import { AccountAvatar } from "@/components/accounts/account-avatar";
import { getAccountBackgroundColor } from "@/lib/account-appearance";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { authenticatedFetch } from "@/lib/auth-client";
import { getCurrentRoute, getReturnTo, withReturnTo } from "@/lib/navigation";
import { ListDataSkeleton, Skeleton } from "@/components/ui/data-skeleton";
import { useAnimatedVisibility } from "@/lib/use-animated-visibility";

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

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

export default function AccountsPage() {
  const [backHref, setBackHref] = useState("/");
  const [currentRoute, setCurrentRoute] = useState("/");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reorderOpen, setReorderOpen] = useState(false);
  const reorderTransition = useAnimatedVisibility(reorderOpen);
  const [draftOrder, setDraftOrder] = useState<Account[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setBackHref(getReturnTo("/"));
      setCurrentRoute(getCurrentRoute());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    void authenticatedFetch(`/api/accounts?month=${currentMonthKey()}`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? "Please sign in to view accounts."
              : "Could not load accounts.",
          );
        const result = (await response.json()) as { accounts: Account[] };
        if (active) setAccounts(result.accounts);
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
    };
  }, []);

  const includedBalance = accounts
    .filter((account) => account.includeInTotalBalance)
    .reduce((total, account) => total + account.currentBalance, 0);
  const excludedBalance = accounts
    .filter((account) => !account.includeInTotalBalance)
    .reduce((total, account) => total + account.currentBalance, 0);

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
            <h1 className="text-[28px] font-semibold tracking-[-0.04em]">
              Accounts
            </h1>
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
          className="mt-8 grid grid-cols-2 divide-x divide-border rounded-[14px] border border-border bg-card"
        >
          <div className="min-w-0 px-4 py-4">
            <p className="text-xs font-semibold text-muted-foreground">
              Total balance
            </p>
            <p className="mt-2 truncate text-[22px] font-semibold tracking-[-0.035em] tabular-nums text-foreground">
              {isLoading ? (
                <Skeleton className="inline-block h-7 w-28 align-middle" />
              ) : (
                <>
                  <span className="mr-1 text-xs tracking-normal text-muted-foreground">
                    {accounts[0]?.currency ?? "NPR"}
                  </span>
                  {formatAmount(includedBalance)}
                </>
              )}
            </p>
          </div>
          <div className="min-w-0 px-4 py-4">
            <p className="text-xs font-semibold text-muted-foreground">
              Excluded from total
            </p>
            <p className="mt-2 truncate text-[22px] font-semibold tracking-[-0.035em] tabular-nums text-foreground">
              {isLoading ? (
                <Skeleton className="inline-block h-7 w-28 align-middle" />
              ) : (
                <>
                  <span className="mr-1 text-xs tracking-normal text-muted-foreground">
                    {accounts[0]?.currency ?? "NPR"}
                  </span>
                  {formatAmount(excludedBalance)}
                </>
              )}
            </p>
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
              {accounts.map((account, index) => {
                const backgroundColor = getAccountBackgroundColor(account.backgroundColor, account.type);
                return (
                  <Link
                    href={withReturnTo(`/accounts/${account.id}`, currentRoute)}
                    key={account.id}
                    style={{ backgroundColor }}
                    className={`group block w-full overflow-hidden rounded-[14px] border text-left transition-[filter,transform] hover:brightness-[0.985] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${cardClasses[index % cardClasses.length]}`}
                  >
                    <span className="flex min-h-[72px] items-center gap-3 px-4 py-3">
                      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-white/80 bg-white/45 shadow-[0_1px_2px_rgba(23,32,29,0.06)]">
                        <AccountAvatar icon={account.icon} name={account.name} type={account.type} backgroundColor={backgroundColor} size={44} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">
                          {account.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {typeLabels[account.type]}
                          {account.isDefault ? " · Default" : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[17px] font-semibold tracking-[-0.025em] tabular-nums">
                          {formatAmount(account.currentBalance)}
                        </span>
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {account.currency}
                        </span>
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-foreground-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                      />
                    </span>
                    <span className="grid grid-cols-2 divide-x divide-current/10 border-t border-current/10 bg-white/45">
                      <span className="px-4 py-2.5">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Income this month
                        </span>
                        <span className="mt-0.5 block text-[13px] font-semibold tabular-nums text-income">
                          +{formatAmount(account.monthlyIncome)}{" "}
                          {account.currency}
                        </span>
                      </span>
                      <span className="px-4 py-2.5">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Expense this month
                        </span>
                        <span className="mt-0.5 block text-[13px] font-semibold tabular-nums text-expense">
                          −{formatAmount(account.monthlyExpense)}{" "}
                          {account.currency}
                        </span>
                      </span>
                    </span>
                  </Link>
                );
              })}
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
