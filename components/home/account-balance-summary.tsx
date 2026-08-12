"use client";

import { Fragment, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownLeft, ArrowLeftRight, ArrowRight, Check, ChevronRight, Clock3, HandCoins, SkipForward, Tags, Target, WalletCards, X } from "lucide-react";

import { authenticatedFetch, getAccessTokenSubject, notifyTransactionsChanged } from "@/lib/auth-client";
import { addCurrencyAmount, currencyEntries, formatCurrencyAmount } from "@/lib/currency";
import { Skeleton } from "@/components/ui/data-skeleton";
import { MonthlyOverviewCards } from "@/components/home/monthly-summary";
import { AnimatedBalanceAmount } from "@/components/home/animated-balance-amount";
import { AccountAvatar } from "@/components/accounts/account-avatar";
import { MoneyEditor } from "@/components/money/money-editor";

type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  icon: string | null;
  backgroundColor: string | null;
  currentBalance: number;
  includeInTotalBalance?: boolean;
};
type Loan = { id: string; accountId: string; direction: "borrowed" | "lent"; currency: string; outstandingPrincipal: number; status: string; nextDueDate: string | null };
type Goal = { id: string; name: string; targetAmount: number; allocatedAmount: number; monthlyContribution: number; status: "active" | "completed" | "archived"; targetDate: string | null; accountId: string | null };

type HomeInsight = {
  id: string;
  href: string;
  feature: "Budget" | "Goal" | "Loan" | "Recurring";
  kind: "budget" | "goal" | "loan" | "recurring";
  label: string;
  value: string;
  detail: string;
  tone: "info" | "warning" | "primary";
  icon: typeof HandCoins;
  progress?: number;
  recurringTemplateId?: string;
  occurrenceId?: string;
  previousPayment?: string;
  goalName?: string;
  goalId?: string;
  loanId?: string;
  installmentId?: string;
  action?: "budget" | "goal" | "loan" | "recurring";
};

type ApiHomeAlert = Omit<HomeInsight, "icon"> & { icon?: string };
type SwipePointer = { pointerId: number; startX: number; startY: number; lastX: number; lastY: number; lastTime: number; velocityX: number; velocityY: number };
type SwipeOffset = { x: number; y: number; rotate: number };
type SwipeExit = { x: number; y: number; rotate: number };

const ALERTS_CACHE_PREFIX = "luna.home-alerts.cache:";
const ALERT_DISMISS_EXIT_MS = 420;
const homeAlertIcons = { budget: Tags, goal: Target, loan: HandCoins, recurring: ArrowLeftRight } as const;

function mapHomeAlerts(alerts: ApiHomeAlert[]) {
  return alerts.map((alert) => ({ ...alert, icon: homeAlertIcons[alert.kind] ?? HandCoins }));
}

function readCachedHomeAlerts() {
  if (typeof window === "undefined") return [];
  const userId = getAccessTokenSubject();
  if (!userId) return [];
  try {
    return JSON.parse(window.localStorage.getItem(`${ALERTS_CACHE_PREFIX}${userId}`) ?? "[]") as ApiHomeAlert[];
  } catch {
    return [];
  }
}

function writeCachedHomeAlerts(alerts: HomeInsight[]) {
  if (typeof window === "undefined") return;
  const userId = getAccessTokenSubject();
  if (!userId) return;
  try {
    window.localStorage.setItem(`${ALERTS_CACHE_PREFIX}${userId}`, JSON.stringify(alerts));
  } catch {
    // Offline alert caching is best effort.
  }
}

export function AccountBalanceSummary({ onAlertsChange }: { onAlertsChange?: (hasAlerts: boolean) => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState("NPR");
  const [hideTotalBalance, setHideTotalBalance] = useState(false);
  const [balanceRevealed, setBalanceRevealed] = useState(false);
  const [revealSecondsRemaining, setRevealSecondsRemaining] = useState(0);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [serverInsights, setServerInsights] = useState<HomeInsight[]>([]);
  const serverInsightsRef = useRef<HomeInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const revealTimer = useRef<number | null>(null);
  const revealCountdownTimer = useRef<number | null>(null);
  const dismissTimers = useRef<Record<string, number>>({});
  const impressedInsightIds = useRef(new Set<string>());
  const [exitingInsightIds, setExitingInsightIds] = useState<string[]>([]);
  const [exitingInsightDirections, setExitingInsightDirections] = useState<Record<string, SwipeExit>>({});
  const swipePointers = useRef<Record<string, SwipePointer>>({});
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, SwipeOffset>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  function applyServerInsights(next: HomeInsight[]) {
    serverInsightsRef.current = next;
    setServerInsights(next);
  }

  useEffect(() => {
    let active = true;
    const dismissTimerMap = dismissTimers.current;

    void Promise.all([
      authenticatedFetch("/api/accounts"),
      authenticatedFetch("/api/auth/me"),
      authenticatedFetch("/api/loans"),
      authenticatedFetch("/api/home-alerts"),
    ])
      .then(async ([accountsResponse, profileResponse, loansResponse, alertsResponse]) => {
        const result = accountsResponse.ok ? (await accountsResponse.json()) as { accounts?: Account[] } : { accounts: [] };
        const profile = profileResponse.ok
          ? (await profileResponse.json()) as { user?: { currency?: string; hideTotalBalance?: boolean } }
          : null;
        if (active) {
          if (accountsResponse.ok) setAccounts(result.accounts ?? []);
          if (loansResponse.ok) setLoans(((await loansResponse.json()) as { loans?: Loan[] }).loans ?? []);
          if (alertsResponse.ok) {
            const result = (await alertsResponse.json()) as { alerts?: ApiHomeAlert[] };
            const nextAlerts = mapHomeAlerts(result.alerts ?? []);
            applyServerInsights(nextAlerts);
            writeCachedHomeAlerts(nextAlerts);
          } else {
            const cached = readCachedHomeAlerts();
            applyServerInsights(mapHomeAlerts(cached.slice(0, 3)));
          }
          if (profile?.user?.currency) setDisplayCurrency(profile.user.currency);
          setHideTotalBalance(profile?.user?.hideTotalBalance === true);
          setBalanceRevealed(false);
        }
      })
      .catch(() => {
        if (!active) return;
        const cached = readCachedHomeAlerts();
        applyServerInsights(mapHomeAlerts(cached.slice(0, 3)));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    // Recurring overview also creates due occurrences. Keep it off the critical
    // balance path so a slow reminder query never delays the home screen.
    void authenticatedFetch("/api/goals")
      .then(async (goalsResponse) => {
        if (!active) return;
        if (goalsResponse.ok) setGoals(((await goalsResponse.json()) as { goals?: Goal[] }).goals ?? []);
      })
      .catch(() => undefined);

    const refreshAlerts = () => {
      void authenticatedFetch("/api/home-alerts")
        .then(async (response) => {
          if (!active || !response.ok) return;
          const result = (await response.json()) as { alerts?: ApiHomeAlert[] };
          const nextAlerts = mapHomeAlerts(result.alerts ?? []);
          applyServerInsights(nextAlerts);
          writeCachedHomeAlerts(nextAlerts);
        })
        .catch(() => undefined);
    };
    window.addEventListener("cocomelon:transactions-changed", refreshAlerts);

    return () => {
      active = false;
      window.removeEventListener("cocomelon:transactions-changed", refreshAlerts);
      if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
      if (revealCountdownTimer.current !== null) window.clearInterval(revealCountdownTimer.current);
      Object.values(dismissTimerMap).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function revealBalance() {
    if (!hideTotalBalance) return;
    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    if (revealCountdownTimer.current !== null) window.clearInterval(revealCountdownTimer.current);
    const startedAt = Date.now();
    setBalanceRevealed(true);
    setRevealSecondsRemaining(5);
    revealCountdownTimer.current = window.setInterval(() => {
      setRevealSecondsRemaining(Math.max(0, Math.ceil((5000 - (Date.now() - startedAt)) / 1000)));
    }, 100);
    revealTimer.current = window.setTimeout(() => {
      setBalanceRevealed(false);
      setRevealSecondsRemaining(0);
      if (revealCountdownTimer.current !== null) window.clearInterval(revealCountdownTimer.current);
      revealCountdownTimer.current = null;
      revealTimer.current = null;
    }, 5000);
  }

  function toggleBalanceVisibility() {
    if (!hideTotalBalance) return;
    if (balanceRevealed) {
      if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
      if (revealCountdownTimer.current !== null) window.clearInterval(revealCountdownTimer.current);
      revealTimer.current = null;
      revealCountdownTimer.current = null;
      setRevealSecondsRemaining(0);
      setBalanceRevealed(false);
      return;
    }
    revealBalance();
  }

  const balanceByCurrency = useMemo(() => {
    const totals = {} as Record<string, number>;
    const detailedLoanAccounts = new Set(loans.map((loan) => loan.accountId));
    for (const account of accounts) {
      if (account.includeInTotalBalance === false) continue;
      if (detailedLoanAccounts.has(account.id)) continue;
      addCurrencyAmount(totals, account.currency, account.currentBalance);
    }
    return currencyEntries(totals);
  }, [accounts, loans]);
  const primaryCurrency = balanceByCurrency.some(([currency]) => currency === displayCurrency)
    ? displayCurrency
    : balanceByCurrency[0]?.[0] ?? displayCurrency;
  const primaryBalance = balanceByCurrency.find(([currency]) => currency === primaryCurrency)?.[1] ?? 0;
  const otherBalances = balanceByCurrency.filter(([currency]) => currency !== primaryCurrency);
  const visibleInsights = serverInsights;
  const groupedInsights = useMemo(() => {
    const groups = new Map<HomeInsight["kind"], HomeInsight[]>();
    for (const insight of visibleInsights) groups.set(insight.kind, [...(groups.get(insight.kind) ?? []), insight]);
    return [...groups.values()].flat();
  }, [visibleInsights]);

  function dismissInsight(id: string, persist = true, direction: "left" | "right" = "left", exit?: SwipeExit) {
    if (exitingInsightIds.includes(id)) return;
    setExitingInsightIds((current) => [...current, id]);
    setExitingInsightDirections((current) => ({
      ...current,
      [id]: exit ?? { x: direction === "right" ? 520 : -520, y: 0, rotate: direction === "right" ? 14 : -14 },
    }));
    dismissTimers.current[id] = window.setTimeout(() => {
      const nextInsights = serverInsightsRef.current.filter((item) => item.id !== id);
      applyServerInsights(nextInsights);
      writeCachedHomeAlerts(nextInsights);
      if (persist) void authenticatedFetch(`/api/home-alerts/${id}/dismiss`, { method: "POST" });
      setExitingInsightIds((current) => current.filter((value) => value !== id));
      setExitingInsightDirections((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      delete dismissTimers.current[id];
    }, ALERT_DISMISS_EXIT_MS);
  }

  function beginSwipe(id: string, event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const now = event.timeStamp;
    swipePointers.current[id] = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, lastTime: now, velocityX: 0, velocityY: 0 };
  }

  function moveSwipe(id: string, event: ReactPointerEvent<HTMLElement>) {
    const pointer = swipePointers.current[id];
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    const now = event.timeStamp;
    const elapsed = Math.max(1, now - pointer.lastTime);
    const offsetX = event.clientX - pointer.startX;
    const offsetY = event.clientY - pointer.startY;
    pointer.velocityX = ((event.clientX - pointer.lastX) / elapsed) * 1000;
    pointer.velocityY = ((event.clientY - pointer.lastY) / elapsed) * 1000;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.lastTime = now;
    if (Math.hypot(offsetX, offsetY) > 6) {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
    setSwipeOffsets((current) => ({ ...current, [id]: { x: offsetX, y: offsetY, rotate: Math.max(-22, Math.min(22, offsetX / 18 + offsetY / 72)) } }));
  }

  function finishSwipe(id: string, event: ReactPointerEvent<HTMLElement>) {
    const pointer = swipePointers.current[id];
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    const offsetX = event.clientX - pointer.startX;
    const offsetY = event.clientY - pointer.startY;
    const speed = Math.hypot(pointer.velocityX, pointer.velocityY);
    const projectedX = offsetX + pointer.velocityX * 0.18;
    const projectedY = offsetY + pointer.velocityY * 0.18;
    const shouldDismiss = Math.hypot(offsetX, offsetY) > 96 || speed > 700;
    delete swipePointers.current[id];
    setSwipeOffsets((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (shouldDismiss) {
      const direction = projectedX >= 0 ? "right" : "left";
      const distance = Math.max(520, Math.abs(projectedX) + Math.abs(pointer.velocityX) * 0.28);
      dismissInsight(id, true, direction, {
        x: direction === "right" ? distance : -distance,
        y: projectedY + pointer.velocityY * 0.12,
        rotate: Math.max(-34, Math.min(34, offsetX / 18 + offsetY / 72 + pointer.velocityX / 38 - pointer.velocityY / 80)),
      });
    }
  }

  function cancelSwipe(id: string) {
    delete swipePointers.current[id];
    setSwipeOffsets((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function actOnRecurring(insight: HomeInsight, action: "post" | "skip") {
    if (!insight.recurringTemplateId) return;
    setActionErrors((current) => ({ ...current, [insight.id]: "" }));
    const response = await authenticatedFetch(`/api/recurring-templates/${insight.recurringTemplateId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, occurrenceId: insight.occurrenceId, alertId: insight.id }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null;
      setActionErrors((current) => ({ ...current, [insight.id]: result?.error ?? "Could not update this recurring payment." }));
      return;
    }
    dismissInsight(insight.id, false);
  }

  const hasVisibleInsights = visibleInsights.length > 0;

  useEffect(() => {
    onAlertsChange?.(hasVisibleInsights);
  }, [hasVisibleInsights, onAlertsChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const markShown = (id: string) => {
      if (!id || impressedInsightIds.current.has(id)) return;
      impressedInsightIds.current.add(id);
      void authenticatedFetch(`/api/home-alerts/${id}/impression`, { method: "POST" });
    };
    if (!("IntersectionObserver" in window)) {
      visibleInsights.forEach((insight) => markShown(insight.id));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach((entry) => markShown((entry.target as HTMLElement).dataset.homeAlertId ?? ""));
    }, { threshold: 0.35 });
    document.querySelectorAll<HTMLElement>("[data-home-alert-id]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [visibleInsights]);

  return (
    <motion.section
      layout
      aria-labelledby="balance-heading"
      data-tour="total-balance"
      className={hasVisibleInsights ? "mt-8" : "mt-10"}
      transition={{ layout: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } }}
    >
      <div className={hasVisibleInsights ? "flex items-center justify-between gap-3" : ""}>
        <div className="min-w-0">
          <p id="balance-heading" className={hasVisibleInsights ? "text-xs font-medium text-muted-foreground" : "text-sm font-medium text-muted-foreground"}>Total balance</p>
          {isLoading ? (
            <p className="mt-2"><Skeleton className={`${hasVisibleInsights ? "h-8 w-32" : "h-10 w-44"} inline-block align-middle rounded-md`} /></p>
          ) : (
            <p className={`${hasVisibleInsights ? "mt-1 text-[27px]" : "mt-2 text-[36px] sm:text-[40px]"} font-sans font-semibold leading-none tracking-[-0.045em] tabular-nums text-foreground`}>
              <span className="inline-flex items-baseline">
                <span className={`${hasVisibleInsights ? "mr-1 text-[12px]" : "mr-2 text-[17px]"} font-semibold tracking-normal text-muted-foreground`}>
                  {primaryCurrency}
                </span>
                <AnimatedBalanceAmount
                  amount={formatCurrencyAmount(primaryBalance)}
                  hideTotalBalance={hideTotalBalance}
                  balanceRevealed={balanceRevealed}
                  revealSecondsRemaining={revealSecondsRemaining}
                  onToggleVisibility={toggleBalanceVisibility}
                  href="/accounts"
                  className={`hover:text-primary ${primaryBalance < 0 ? "text-expense" : "text-income"}`}
                />
              </span>
            </p>
          )}
        </div>
      </div>
      {!isLoading && otherBalances.length ? <p className="mt-2 text-xs font-semibold tabular-nums text-muted-foreground" aria-label="Other currency balances">{otherBalances.map(([currency, amount], index) => <span key={currency}>{index ? " · " : ""}{currency} {hideTotalBalance && !balanceRevealed ? "****" : formatCurrencyAmount(amount)}</span>)}</p> : null}

      <MonthlyOverviewCards compact />

      <AnimatePresence initial={false}>
        {!isLoading && visibleInsights.length ? (
          <motion.section key="money-reminders" aria-label="Money reminders" initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: "auto", marginTop: 16 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }} className="relative overflow-visible">
          <AnimatePresence initial={false}>
            {groupedInsights.map((insight, index) => {
              const Icon = insight.icon;
              const style = insight.kind === "budget"
                ? { card: "border-warning/30 bg-warning-soft", soft: "bg-warning-soft", text: "text-warning", accent: "bg-warning" }
                : insight.kind === "goal"
                  ? { card: "border-primary/20 bg-primary-soft/50", soft: "bg-primary-soft", text: "text-primary", accent: "bg-primary" }
                  : insight.kind === "recurring"
                    ? { card: "border-info/20 bg-info-soft/45", soft: "bg-info-soft", text: "text-info", accent: "bg-info" }
                    : { card: "border-income/20 bg-income-soft", soft: "bg-income-soft", text: "text-income", accent: "bg-income" };
              const isExiting = exitingInsightIds.includes(insight.id);
              const exitMotion = exitingInsightDirections[insight.id] ?? { x: -520, y: 0, rotate: -14 };
              const swipeOffset = swipeOffsets[insight.id] ?? { x: 0, y: 0, rotate: 0 };
              const isDragging = Boolean(swipeOffsets[insight.id]);
              const stackOffset = Math.min(index, 3);
              const isTopExiting = groupedInsights[0]?.id !== insight.id && exitingInsightIds.includes(groupedInsights[0]?.id ?? "");
              const isPromoted = index === 1 && isTopExiting;
              const stackPositionClass = index === 0
                ? isExiting ? "absolute inset-x-0 top-0 z-30" : "relative z-30"
                : isPromoted ? "relative z-20" : "relative";
              const stackOverlapClass = index > 0 && !isPromoted ? "-mt-4 pointer-events-none" : "";
              if (index > 0 && !isPromoted) {
                return <motion.div key={insight.id} layout aria-hidden="true" className={`relative -mt-4 h-3 overflow-hidden rounded-b-[16px] border ${style.card}`} style={{ zIndex: 30 - stackOffset }} />;
              }
              if (insight.kind === "goal") {
                return (
                  <Fragment key={insight.id}>
                    <motion.article layout onPointerDown={(event) => beginSwipe(insight.id, event)} onPointerMove={(event) => moveSwipe(insight.id, event)} onPointerUp={(event) => finishSwipe(insight.id, event)} onPointerCancel={() => cancelSwipe(insight.id)} data-home-alert-id={insight.id} initial={{ opacity: isPromoted ? 0.92 : 0, y: isPromoted ? 12 : 0, scale: isPromoted ? 0.98 : 1 }} animate={{ opacity: isExiting ? 0 : 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: isExiting ? "tween" : isDragging ? "tween" : "spring", stiffness: isExiting ? undefined : 420, damping: isExiting ? undefined : 32, mass: isExiting ? undefined : 0.85, duration: isExiting ? 0.38 : 0.24, ease: isExiting ? [0.22, 1, 0.36, 1] : undefined, layout: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } }} style={{ zIndex: 30 - stackOffset, x: isExiting ? exitMotion.x : swipeOffset.x, y: isExiting ? exitMotion.y : swipeOffset.y, rotate: isExiting ? exitMotion.rotate : swipeOffset.rotate }} className={`touch-pan-y overflow-hidden rounded-[16px] border border-primary/20 bg-card shadow-[0_8px_24px_rgb(23_32_29_/_0.04)] ${stackPositionClass} ${stackOverlapClass}`}>
                      <div className="p-3">
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-primary-soft text-primary"><Icon aria-hidden="true" className="size-[19px]" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <Link href={insight.href} className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
                              <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Goal</span>
                              <span className="mt-0.5 block text-[15px] font-semibold leading-5 text-foreground">{insight.label}</span>
                              {insight.goalName ? <span className="mt-0.5 block truncate text-xs font-medium text-muted-foreground">{insight.goalName}</span> : null}
                            </Link>
                            <span className="shrink-0 text-right"><span className="block text-[15px] font-semibold tabular-nums text-primary">{insight.progress ?? 0}%</span><span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">{insight.detail.split(" · ").at(-1)}</span></span>
                          </div>
                        </div>
                        <button type="button" onClick={() => dismissInsight(insight.id)} aria-label="Dismiss goal alert" className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><X aria-hidden="true" className="size-4" /></button>
                      </div>
                      <div className="mt-3 flex min-w-0 items-center gap-2 rounded-[12px] bg-primary-soft/55 px-3 py-2.5 text-xs font-semibold text-foreground"><Target aria-hidden="true" className="size-4 shrink-0 text-primary" /><span className="truncate">{insight.value} saved for this goal</span></div>
                      {insight.progress !== undefined ? <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary-soft"><span className="block h-full rounded-full bg-primary" style={{ width: `${insight.progress}%` }} /></div> : null}
                      <GoalAlertActions insight={insight} goal={goals.find((goal) => goal.id === insight.goalId)} accounts={accounts} onComplete={() => dismissInsight(insight.id, false)} />
                      </div>
                    </motion.article>
                  </Fragment>
                );
              }
              if (insight.kind === "recurring") {
                return (
                  <Fragment key={insight.id}>
                    <motion.article layout onPointerDown={(event) => beginSwipe(insight.id, event)} onPointerMove={(event) => moveSwipe(insight.id, event)} onPointerUp={(event) => finishSwipe(insight.id, event)} onPointerCancel={() => cancelSwipe(insight.id)} data-home-alert-id={insight.id} initial={{ opacity: isPromoted ? 0.92 : 0, y: isPromoted ? 12 : 0, scale: isPromoted ? 0.98 : 1 }} animate={{ opacity: isExiting ? 0 : 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: isExiting ? "tween" : isDragging ? "tween" : "spring", stiffness: isExiting ? undefined : 420, damping: isExiting ? undefined : 32, mass: isExiting ? undefined : 0.85, duration: isExiting ? 0.38 : 0.24, ease: isExiting ? [0.22, 1, 0.36, 1] : undefined, layout: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } }} style={{ zIndex: 30 - stackOffset, x: isExiting ? exitMotion.x : swipeOffset.x, y: isExiting ? exitMotion.y : swipeOffset.y, rotate: isExiting ? exitMotion.rotate : swipeOffset.rotate }} className={`touch-pan-y overflow-hidden rounded-[16px] border border-border/80 bg-card shadow-[0_8px_24px_rgb(23_32_29_/_0.04)] ${stackPositionClass} ${stackOverlapClass}`}>
                      <div className="p-3">
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-info text-primary-foreground"><ArrowLeftRight aria-hidden="true" className="size-[19px]" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <Link href={insight.href} className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
                              <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-info">Recurring</span>
                              <span className="mt-0.5 block text-[15px] font-semibold leading-5 text-foreground">{insight.label}</span>
                            </Link>
                            <span className="shrink-0 text-right"><span className="block text-[15px] font-semibold tabular-nums text-income">{insight.value}</span><span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">{insight.previousPayment ?? "Previous payment"}</span></span>
                          </div>
                        </div>
                        <button type="button" onClick={() => dismissInsight(insight.id)} aria-label="Dismiss recurring alert" className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><X aria-hidden="true" className="size-4" /></button>
                      </div>
                      <div className="mt-3 flex min-w-0 items-center gap-2 rounded-[12px] bg-surface-subtle px-3 py-2.5 text-xs font-semibold text-foreground"><Clock3 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{insight.detail}</span></div>
                      <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => void actOnRecurring(insight, "skip")} className="flex min-h-11 items-center justify-center gap-1.5 rounded-[11px] border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><SkipForward aria-hidden="true" className="size-3.5" />Skip this cycle</button><button type="button" onClick={() => void actOnRecurring(insight, "post")} className="flex min-h-11 items-center justify-center gap-1.5 rounded-[11px] bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><Check aria-hidden="true" className="size-3.5" />Done</button></div>
                      {actionErrors[insight.id] ? <p role="alert" className="mt-2 text-xs font-medium text-expense">{actionErrors[insight.id]}</p> : null}
                      </div>
                    </motion.article>
                  </Fragment>
                );
              }
              return (
                <Fragment key={insight.id}>
                  <motion.article layout onPointerDown={(event) => beginSwipe(insight.id, event)} onPointerMove={(event) => moveSwipe(insight.id, event)} onPointerUp={(event) => finishSwipe(insight.id, event)} onPointerCancel={() => cancelSwipe(insight.id)} data-home-alert-id={insight.id} initial={{ opacity: isPromoted ? 0.92 : 0, y: isPromoted ? 12 : 0, scale: isPromoted ? 0.98 : 1 }} animate={{ opacity: isExiting ? 0 : 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: isExiting ? "tween" : isDragging ? "tween" : "spring", stiffness: isExiting ? undefined : 420, damping: isExiting ? undefined : 32, mass: isExiting ? undefined : 0.85, duration: isExiting ? 0.38 : 0.24, ease: isExiting ? [0.22, 1, 0.36, 1] : undefined, layout: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } }} style={{ zIndex: 30 - stackOffset, x: isExiting ? exitMotion.x : swipeOffset.x, y: isExiting ? exitMotion.y : swipeOffset.y, rotate: isExiting ? exitMotion.rotate : swipeOffset.rotate }} className={`touch-pan-y overflow-hidden rounded-[14px] border transition-colors hover:brightness-[0.985] ${style.card} ${stackPositionClass} ${stackOverlapClass}`}>
                    <Link href={insight.href} className="block min-w-0 p-3 pr-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
                      <span className="flex min-w-0 items-start gap-3">
                        <span className={`flex size-9 shrink-0 items-center justify-center rounded-[9px] ${style.soft} ${style.text}`}><Icon aria-hidden="true" className="size-[17px]" /></span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[10px] font-semibold uppercase tracking-[0.12em] ${style.text}`}>{insight.feature}</span>
                          <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">{insight.label}</span>
                          <span className="mt-1 block truncate text-sm font-semibold tabular-nums text-foreground">{insight.value}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{insight.detail}</span>
                        </span>
                        <ChevronRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-foreground-subtle" />
                      </span>
                      {insight.progress !== undefined ? <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-background/70"><span className={`block h-full rounded-full ${style.accent}`} style={{ width: `${insight.progress}%` }} /></span> : null}
                    </Link>
                    <div className="px-3 pb-3">
                      <Link href={insight.href} className={`inline-flex min-h-9 items-center gap-1.5 rounded-[10px] px-3 text-xs font-semibold ${style.soft} ${style.text} transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35`}>
                        {insight.kind === "loan" ? "Record payment" : "Review budget"}<ArrowRight aria-hidden="true" className="size-3.5" />
                      </Link>
                    </div>
                    <button type="button" onClick={() => dismissInsight(insight.id)} aria-label={`Dismiss ${insight.feature.toLowerCase()} alert`} className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><X aria-hidden="true" className="size-4" /></button>
                  </motion.article>
                </Fragment>
              );
            })}
          </AnimatePresence>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {!hasVisibleInsights ? <nav aria-label="Balance details" className="mt-3 flex w-full flex-nowrap gap-x-3 overflow-x-auto overscroll-x-contain pb-1 whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><Link href="/accounts" className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md pr-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><WalletCards aria-hidden="true" className="size-3 text-primary" />Accounts<ChevronRight aria-hidden="true" className="size-3" /></Link></nav> : null}
    </motion.section>
  );
}

function GoalAlertActions({ insight, goal, accounts, onComplete }: { insight: HomeInsight; goal?: Goal; accounts: Account[]; onComplete: () => void }) {
  const [amountOpen, setAmountOpen] = useState(false);
  const [amount, setAmount] = useState(goal?.monthlyContribution ? String(goal.monthlyContribution) : "0");
  const [accountId, setAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const sourceAccounts = accounts.filter((account) => account.id !== goal?.accountId);
  const selectedAccount = sourceAccounts.find((account) => account.id === accountId) ?? sourceAccounts.find((account) => account.includeInTotalBalance !== false) ?? sourceAccounts[0];
  const goalAccount = accounts.find((account) => account.id === goal?.accountId);
  const goalName = goal?.name ?? insight.goalName ?? "this goal";

  function openDrawer() {
    setAccountId((current) => current || sourceAccounts[0]?.id || "");
    setAmount(goal?.monthlyContribution ? String(goal.monthlyContribution) : "0");
    setNotes("");
    setError("");
    setAmountOpen(true);
  }

  async function allocate(nextAmount: string) {
    const numericAmount = Number(nextAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || saving) return;
    setAmount(nextAmount);
    if (!goal?.id || !selectedAccount) return;
    setSaving(true);
    setError("");
    const response = await authenticatedFetch(`/api/goals/${goal.id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "contribute", amount: numericAmount, accountId: selectedAccount.id, notes: notes.trim() || undefined, alertId: insight.id }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null;
      setError(result?.error ?? "Could not allocate to this goal.");
      setSaving(false);
      return;
    }
    notifyTransactionsChanged();
    setSaving(false);
    setAmountOpen(false);
    onComplete();
  }

  async function skipGoalCycle() {
    if (saving) return;
    setSaving(true);
    setError("");
    const response = await authenticatedFetch(`/api/home-alerts/${insight.id}/resolve`, { method: "POST" });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null;
      setError(result?.error ?? "Could not skip this goal cycle.");
      setSaving(false);
      return;
    }
    setSaving(false);
    onComplete();
  }

  const topContent = <div className="space-y-3"><div className="rounded-[18px] border border-primary/15 bg-primary-soft/45 p-4"><p className="text-sm font-semibold">Move money into {goalName}.</p><div className="mt-3 flex items-center gap-2"><AlertFlowAccount account={selectedAccount} label="Spendable" fallbackName="Choose an account" /><ArrowRight aria-hidden="true" className="size-4 shrink-0 text-primary" /><AlertFlowAccount account={goalAccount} label="Goal account" fallbackName={goalName} /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">The two balances and the goal progress update together.</p></div><fieldset className="min-w-0"><legend className="mb-2 px-1 text-xs font-semibold text-muted-foreground">Choose the account to take from</legend><div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{sourceAccounts.map((account) => <button key={account.id} type="button" aria-pressed={account.id === selectedAccount?.id} onClick={() => setAccountId(account.id)} className={`flex min-h-14 shrink-0 items-center gap-2 rounded-[12px] border px-2.5 pr-3 text-left transition-colors ${account.id === selectedAccount?.id ? "border-primary bg-primary-soft text-primary" : "border-border bg-card"}`}><span className="flex size-9 shrink-0 overflow-hidden rounded-[9px]"><AccountAvatar icon={account.icon} name={account.name} type={account.type} backgroundColor={account.backgroundColor} size={36} /></span><span className="flex min-w-0 flex-col items-start leading-tight"><span className="max-w-[145px] truncate text-xs font-semibold">{account.name}</span><span className="mt-1 text-[10px] font-medium tabular-nums text-muted-foreground">{account.currency} {account.currentBalance.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span></span>{account.id === selectedAccount?.id ? <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background"><Check aria-hidden="true" className="size-3.5 stroke-[3]" /></span> : null}</button>)}</div></fieldset><label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Note (optional)</span><input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder="Add a note" className="h-11 w-full rounded-[11px] border border-border bg-card px-3 text-sm font-medium outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" /></label></div>;

  return <>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button type="button" disabled={saving} onClick={() => { void skipGoalCycle(); }} className="flex min-h-11 items-center justify-center gap-1.5 rounded-[11px] border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-wait disabled:opacity-60"><SkipForward aria-hidden="true" className="size-3.5" />Skip this cycle</button>
      <button type="button" onClick={openDrawer} className="flex min-h-11 items-center justify-center gap-1.5 rounded-[11px] bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><ArrowDownLeft aria-hidden="true" className="size-3.5" />Allocate</button>
    </div>
    <MoneyEditor open={amountOpen} value={amount} title="Add funds" currency={selectedAccount?.currency ?? "NPR"} topContent={topContent} confirmPlacement="bottom" confirmLabel={saving ? "Adding…" : "Add funds"} confirmDisabled={(value) => saving || !selectedAccount || !Number.isFinite(Number(value)) || Number(value) <= 0} liveValidation={() => error} cancelVariant="text" cancelLabel="Cancel" onCancel={() => setAmountOpen(false)} onSet={(value) => { void allocate(value); }} />
  </>;
}

function AlertFlowAccount({ account, label, fallbackName }: { account?: Account; label: string; fallbackName: string }) {
  return <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[12px] bg-card/75 p-2"><span className="shrink-0">{account ? <AccountAvatar icon={account.icon} name={account.name} type={account.type} backgroundColor={account.backgroundColor} size={28} /> : <span className="flex size-7 items-center justify-center rounded-[9px] bg-primary-soft text-primary"><Target aria-hidden="true" className="size-3.5" /></span>}</span><span className="min-w-0"><span className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span><span className="block truncate text-[11px] font-semibold">{account?.name ?? fallbackName}</span></span></div>;
}
