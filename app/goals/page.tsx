"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Plus, Target } from "lucide-react";

import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { ListDataSkeleton } from "@/components/ui/data-skeleton";
import { authenticatedFetch } from "@/lib/auth-client";
import { getCurrentRoute, getReturnTo, withReturnTo } from "@/lib/navigation";

export type GoalRecord = { id: string; name: string; targetAmount: number; allocatedAmount: number; status: "active" | "completed" | "archived"; targetDate: string | null; accountId: string | null };
type Account = { id: string; name: string };

function amount(value: number) { return value.toLocaleString("en-US", { maximumFractionDigits: 2 }); }
function progress(goal: GoalRecord) { return goal.targetAmount > 0 ? Math.min(100, Math.max(0, (goal.allocatedAmount / goal.targetAmount) * 100)) : 0; }
function dateLabel(value: string | null) { return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "No target date"; }

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [backHref, setBackHref] = useState("/");
  const [currentRoute, setCurrentRoute] = useState("/");
  const [currency, setCurrency] = useState("NPR");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { const frame = window.requestAnimationFrame(() => { setBackHref(getReturnTo("/")); setCurrentRoute(getCurrentRoute()); }); return () => window.cancelAnimationFrame(frame); }, []);
  useEffect(() => {
    let active = true;
    void Promise.all([authenticatedFetch("/api/goals"), authenticatedFetch("/api/auth/me"), authenticatedFetch("/api/accounts")]).then(async ([goalResponse, userResponse, accountResponse]) => {
      if (!goalResponse.ok) throw new Error(goalResponse.status === 401 ? "Please sign in to view goals." : "Could not load goals.");
      const result = await goalResponse.json() as { goals?: GoalRecord[] };
      const user = userResponse.ok ? await userResponse.json() as { user?: { currency?: string } } : {};
      const accountResult = accountResponse.ok ? await accountResponse.json() as { accounts?: Account[] } : {};
      if (active) { setGoals(result.goals ?? []); setCurrency(user.user?.currency ?? "NPR"); setAccounts(accountResult.accounts ?? []); }
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load goals."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const activeGoals = useMemo(() => goals.filter((goal) => goal.status !== "archived"), [goals]);
  const archivedGoals = useMemo(() => goals.filter((goal) => goal.status === "archived"), [goals]);

  function GoalCard({ goal }: { goal: GoalRecord }) {
    const percentage = progress(goal); const accountName = accounts.find((account) => account.id === goal.accountId)?.name;
    return <Link href={withReturnTo(`/goals/${goal.id}`, currentRoute)} className={`block rounded-[17px] border p-4 transition-colors hover:bg-surface-subtle ${goal.status === "archived" ? "border-border bg-surface-subtle/60 opacity-80" : "border-border bg-card"}`}><div className="flex items-start gap-3"><span className={`flex size-11 shrink-0 items-center justify-center rounded-[12px] ${goal.status === "archived" ? "bg-surface-subtle text-muted-foreground" : goal.status === "completed" ? "bg-income-soft text-income" : "bg-primary-soft text-primary"}`}><Target aria-hidden="true" className="size-[20px]" /></span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block truncate text-[15px] font-semibold">{goal.name}</span><span className="mt-1 block text-xs text-muted-foreground">{goal.status === "archived" ? "Archived · fully spent" : goal.status === "completed" ? "Completed · ready to spend" : `Target ${dateLabel(goal.targetDate)}`}</span></span><ChevronRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" /></span><span className="mt-3 block text-xs font-medium text-muted-foreground">{accountName ? `Held in ${accountName}` : "Goal account not assigned"}</span><span className="mt-3 flex items-baseline justify-between gap-3"><span className="text-sm font-semibold tabular-nums">{currency} {amount(goal.allocatedAmount)}</span><span className="text-xs font-medium text-muted-foreground">of {amount(goal.targetAmount)} · {Math.round(percentage)}%</span></span><span className="mt-2 block h-2 overflow-hidden rounded-full bg-surface-subtle"><span className={`block h-full rounded-full transition-all ${goal.status === "archived" ? "bg-muted-foreground" : goal.status === "completed" ? "bg-income" : "bg-primary"}`} style={{ width: `${percentage}%` }} /></span></span></div></Link>;
  }

  return <main className="page-route-enter min-h-dvh bg-background"><div className="mx-auto w-full max-w-[720px] px-4 pb-12 sm:px-5"><StickyPageHeader className="-mx-4 flex items-center justify-between gap-3 px-4 pb-3 sm:-mx-5 sm:px-5"><div className="flex min-w-0 items-center gap-3"><Link href={backHref} aria-label="Back" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground"><ArrowLeft aria-hidden="true" className="size-5" /></Link><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Plan for what matters</p><h1 className="truncate text-[26px] font-semibold tracking-[-0.04em]">Goals</h1></div></div><Link href={withReturnTo("/goals/new", currentRoute)} aria-label="Create goal" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary"><Plus aria-hidden="true" className="size-[19px]" /></Link></StickyPageHeader><section className="mt-8">{error ? <p role="alert" className="rounded-[14px] border border-expense/25 bg-expense-soft px-4 py-3 text-sm font-medium text-expense">{error}</p> : loading ? <ListDataSkeleton rows={3} /> : goals.length === 0 ? <div className="rounded-[18px] border border-dashed border-border bg-card px-5 py-10 text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-[16px] bg-primary-soft text-primary"><Target aria-hidden="true" className="size-7" /></span><h2 className="mt-4 text-base font-semibold">Give your next purchase a plan</h2><p className="mx-auto mt-2 max-w-[390px] text-sm leading-6 text-muted-foreground">Create a goal, then fund it gradually from any spendable account.</p><Link href={withReturnTo("/goals/new", currentRoute)} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-primary/25 bg-primary-soft px-3.5 text-sm font-semibold text-primary"><Plus aria-hidden="true" className="size-4" />Create a goal</Link></div> : <><div className="flex items-end justify-between gap-3 px-1"><div><p className="text-xs font-medium text-muted-foreground">Your savings targets</p><h2 className="mt-1 text-[20px] font-semibold tracking-[-0.03em]">In progress</h2></div><p className="text-xs font-semibold text-primary">{activeGoals.length} active</p></div><div className="mt-3 space-y-3">{activeGoals.length ? activeGoals.map((goal) => <GoalCard key={goal.id} goal={goal} />) : <p className="rounded-[14px] border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">No active goals right now.</p>}</div>{archivedGoals.length ? <div className="mt-8"><div className="flex items-end justify-between gap-3 px-1"><div><p className="text-xs font-medium text-muted-foreground">Your completed purchases</p><h2 className="mt-1 text-[20px] font-semibold tracking-[-0.03em]">Archived</h2></div><p className="text-xs font-semibold text-muted-foreground">{archivedGoals.length}</p></div><div className="mt-3 space-y-3">{archivedGoals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}</div></div> : null}</>}</section></div></main>;
}
