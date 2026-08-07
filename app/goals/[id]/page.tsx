"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Edit3, ReceiptText, Target } from "lucide-react";

import { GoalActionForm } from "@/components/goals/goal-action-form";
import { AccountAvatar } from "@/components/accounts/account-avatar";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { PageDataSkeleton } from "@/components/ui/data-skeleton";
import { authenticatedFetch } from "@/lib/auth-client";
import { getReturnTo } from "@/lib/navigation";

type Goal = { id: string; name: string; targetAmount: number; allocatedAmount: number; status: "active" | "completed" | "archived"; targetDate: string | null; accountId: string | null };
type Account = { id: string; name: string; type: string; currency: string; icon: string | null; backgroundColor: string | null; currentBalance: number; isDefault?: boolean };
type Category = { id: string; name: string; type: "expense" | "income" };
type GoalTransaction = { id: string; type: "savings" | "goal_spend"; amount: number; title: string; notes: string | null; date: string; accountCurrency: string; accountName: string; categoryName: string | null };

function amount(value: number) { return value.toLocaleString("en-US", { maximumFractionDigits: 2 }); }
function dateLabel(value: string | null) { return value ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "No target date"; }

export default function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [goalId, setGoalId] = useState("");
  const [goal, setGoal] = useState<Goal | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<GoalTransaction[]>([]);
  const [currency, setCurrency] = useState("NPR");
  const [backHref] = useState(() => typeof window === "undefined" ? "/goals" : getReturnTo("/goals"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { void params.then(({ id }) => setGoalId(id)); }, [params]);
  useEffect(() => {
    if (!goalId || goalId === "new") return;
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [goalResponse, accountResponse, categoryResponse, transactionResponse, userResponse] = await Promise.all([authenticatedFetch(`/api/goals/${goalId}`), authenticatedFetch("/api/accounts"), authenticatedFetch("/api/categories"), authenticatedFetch(`/api/transactions?goalId=${goalId}`), authenticatedFetch("/api/auth/me")]);
        if (!goalResponse.ok) throw new Error(goalResponse.status === 404 ? "Goal not found." : "Could not load this goal.");
        const goalResult = await goalResponse.json() as { goal: Goal };
        const accountResult = accountResponse.ok ? await accountResponse.json() as { accounts?: Account[] } : {};
        const categoryResult = categoryResponse.ok ? await categoryResponse.json() as { categories?: Category[] } : {};
        const transactionResult = transactionResponse.ok ? await transactionResponse.json() as { transactions?: GoalTransaction[] } : {};
        const userResult = userResponse.ok ? await userResponse.json() as { user?: { currency?: string } } : {};
        if (active) { setGoal(goalResult.goal); setAccounts(accountResult.accounts ?? []); setCategories(categoryResult.categories ?? []); setTransactions(transactionResult.transactions ?? []); setCurrency(userResult.user?.currency ?? accountResult.accounts?.[0]?.currency ?? "NPR"); }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Could not load this goal."); } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [goalId]);

  const percentage = useMemo(() => goal && goal.targetAmount > 0 ? Math.min(100, Math.max(0, goal.allocatedAmount / goal.targetAmount * 100)) : 0, [goal]);
  async function reload() {
    if (!goalId) return;
    const [goalResponse, transactionResponse] = await Promise.all([authenticatedFetch(`/api/goals/${goalId}`), authenticatedFetch(`/api/transactions?goalId=${goalId}`)]);
    if (goalResponse.ok) setGoal((await goalResponse.json() as { goal: Goal }).goal);
    if (transactionResponse.ok) setTransactions((await transactionResponse.json() as { transactions?: GoalTransaction[] }).transactions ?? []);
  }

  if (loading) return <PageDataSkeleton label="Loading goal" />;
  if (error || !goal) return <main className="page-route-enter min-h-dvh bg-background"><div className="mx-auto w-full max-w-[720px] px-4 py-8 sm:px-5"><Link href={backHref} aria-label="Back" className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card"><ArrowLeft className="size-5" /></Link><p role="alert" className="mt-8 rounded-[14px] border border-expense/25 bg-expense-soft px-4 py-3 text-sm font-medium text-expense">{error || "Goal not found."}</p></div></main>;

  const goalAccount = accounts.find((account) => account.id === goal.accountId);
  const goalCurrency = goalAccount?.currency ?? currency;
  const heroColor = goal.status === "archived" ? "#eef0ee" : goal.status === "completed" ? "#e5f3eb" : "#e3eee9";
  const progressLabel = goal.status === "archived" ? "Archived goal" : goal.status === "completed" ? "Fully funded" : "Goal progress";
  const progressColor = goal.status === "archived" ? "bg-muted-foreground" : goal.status === "completed" ? "bg-income" : "bg-primary";

  return (
    <main className="page-route-enter min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-12 sm:px-5">
        <div className="-mx-4 sm:-mx-5" style={{ backgroundColor: heroColor }}>
          <StickyPageHeader className="!w-full bg-transparent px-4 pb-3 sm:px-5">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  href={backHref}
                  aria-label="Back to goals"
                  className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                >
                  <ArrowLeft aria-hidden="true" className="size-5" />
                </Link>
                <div className="min-w-0">
                  <h1 className="truncate text-[24px] font-semibold tracking-[-0.04em]">
                    {goal.name}
                  </h1>
                  <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                    Savings goal
                  </p>
                </div>
              </div>
              <Link
                href={`/goals/${goal.id}/edit`}
                aria-label="Edit goal"
                className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                <Edit3 aria-hidden="true" className="size-[18px]" />
              </Link>
            </div>
          </StickyPageHeader>
          <section
            aria-label="Goal progress"
            className="border-y border-black/10 px-4 py-8 text-center text-foreground sm:px-5"
          >
            <div className="mx-auto flex size-12 items-center justify-center rounded-[14px] bg-white/60 text-primary">
              <Target aria-hidden="true" className="size-6" />
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {progressLabel}
            </p>
            <p className="mt-1 text-[46px] font-bold leading-none tracking-[-0.06em] tabular-nums">
              {amount(goal.allocatedAmount)}
            </p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.1em] text-primary">
              {goalCurrency}{" "}
              <span className="font-medium normal-case tracking-normal text-muted-foreground">
                of {amount(goal.targetAmount)}
              </span>
            </p>
            <div className="mx-auto mt-5 max-w-[420px] text-left">
              <div className="h-2.5 overflow-hidden rounded-full bg-black/10">
                <span
                  className={`block h-full rounded-full ${progressColor}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <p className="mt-2 text-right text-xs font-semibold text-muted-foreground">
                {Math.round(percentage)}%
              </p>
            </div>
            {goal.targetDate ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarDays aria-hidden="true" className="size-3.5" />
                Target {dateLabel(goal.targetDate)}
              </p>
            ) : null}
          </section>
        </div>

        <section aria-label="Goal account" className="mt-8">
          <div className="flex items-center gap-3 rounded-[14px] border border-border bg-card px-3 py-3">
            {goalAccount ? (
              <AccountAvatar
                icon={goalAccount.icon}
                name={goalAccount.name}
                type={goalAccount.type}
                backgroundColor={goalAccount.backgroundColor}
                size={42}
              />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-expense-soft text-expense">
                <Target aria-hidden="true" className="size-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Goal account
              </p>
              <p className="truncate text-[15px] font-semibold">
                {goalAccount?.name ?? "Not assigned yet"}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {goalAccount
                  ? `${goalAccount.currency} ${amount(goalAccount.currentBalance)} held here`
                  : "Choose the account that will hold this goal’s money."}
              </p>
            </div>
            <Link
              href={`/goals/${goal.id}/edit`}
              className="shrink-0 rounded-[10px] border border-primary/20 bg-primary-soft px-3 py-2 text-xs font-semibold text-primary"
            >
              {goalAccount ? "Change" : "Choose"}
            </Link>
          </div>
        </section>

        <GoalActionForm
          goal={goal}
          accounts={accounts}
          categories={categories}
          onChanged={() => void reload()}
        />

        <section aria-labelledby="goal-history-heading" className="mt-8">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Every movement stays traceable
              </p>
              <h2
                id="goal-history-heading"
                className="mt-1 text-[20px] font-semibold tracking-[-0.03em]"
              >
                Transactions
              </h2>
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
              {transactions.length} {transactions.length === 1 ? "entry" : "entries"}
            </p>
          </div>
          {transactions.length === 0 ? (
            <div className="mt-3 rounded-[14px] border border-dashed border-border-strong bg-card p-8 text-center">
              <ReceiptText aria-hidden="true" className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">No transactions yet</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Add funds to start tracking this goal.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-[14px] border border-border bg-card">
              {transactions.map((transaction, index) => {
                const isSpend = transaction.type === "goal_spend";
                const isWithdraw = transaction.type === "savings" && transaction.amount < 0;
                return (
                  <Link
                    key={transaction.id}
                    href={`/transactions/${transaction.id}`}
                    className={`flex items-center gap-3 px-4 py-3.5 hover:bg-surface-subtle ${index ? "border-t border-border" : ""}`}
                  >
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-[11px] ${isSpend ? "bg-expense-soft text-expense" : isWithdraw ? "bg-surface-subtle text-foreground" : "bg-income-soft text-income"}`}
                    >
                      <Target aria-hidden="true" className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {transaction.title}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {transaction.notes || `${transaction.accountName} · ${transaction.date}`}
                        {transaction.categoryName ? ` · ${transaction.categoryName}` : ""}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-right text-sm font-semibold tabular-nums ${isSpend || isWithdraw ? "text-expense" : "text-income"}`}
                    >
                      {isWithdraw || isSpend ? "−" : "+"}
                      {amount(Math.abs(transaction.amount))} {transaction.accountCurrency}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
