"use client";

import Link from "next/link";
import { ArrowLeftRight, ChevronRight, HandCoins, Tags, Target } from "lucide-react";
import { useEffect, useState } from "react";

import { authenticatedFetch, getAccessTokenSubject } from "@/lib/auth-client";

export type ActivityAlert = {
  id: string;
  createdAt: string;
  showAt: string;
  href: string;
  feature: "Budget" | "Goal" | "Loan" | "Recurring";
  kind: "budget" | "goal" | "loan" | "recurring";
  label: string;
  value: string;
  detail: string;
  progress?: number;
  goalName?: string;
};

const ACTIVITY_ALERTS_CACHE_PREFIX = "luna.activity-alerts.cache:";

function readCachedActivityAlerts() {
  if (typeof window === "undefined") return [];
  const userId = getAccessTokenSubject();
  if (!userId) return [];
  try {
    return JSON.parse(window.localStorage.getItem(`${ACTIVITY_ALERTS_CACHE_PREFIX}${userId}`) ?? "[]") as ActivityAlert[];
  } catch {
    return [];
  }
}

function writeCachedActivityAlerts(alerts: ActivityAlert[]) {
  if (typeof window === "undefined") return;
  const userId = getAccessTokenSubject();
  if (!userId) return;
  try {
    window.localStorage.setItem(`${ACTIVITY_ALERTS_CACHE_PREFIX}${userId}`, JSON.stringify(alerts));
  } catch {
    // Activity alert caching is best effort while offline.
  }
}

const alertAppearance = {
  budget: {
    icon: Tags,
    iconClass: "bg-warning-soft text-warning",
    valueClass: "text-warning",
    surfaceClass: "bg-warning-soft/35",
    progressClass: "bg-warning",
  },
  goal: {
    icon: Target,
    iconClass: "bg-primary-soft text-primary",
    valueClass: "text-primary",
    surfaceClass: "bg-primary-soft/35",
    progressClass: "bg-primary",
  },
  loan: {
    icon: HandCoins,
    iconClass: "bg-income-soft text-income",
    valueClass: "text-income",
    surfaceClass: "bg-income-soft/25",
    progressClass: "bg-income",
  },
  recurring: {
    icon: ArrowLeftRight,
    iconClass: "bg-info-soft text-info",
    valueClass: "text-info",
    surfaceClass: "bg-info-soft/25",
    progressClass: "bg-info",
  },
} as const;

function budgetScope(detail: string) {
  return detail.split(" · ")[0] || "Spending budget";
}

export function useActivityAlerts(enabled: boolean) {
  const [alerts, setAlerts] = useState<ActivityAlert[]>(readCachedActivityAlerts);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const refresh = () => {
      void authenticatedFetch("/api/home-alerts?view=activity")
        .then(async (response) => {
          if (!response.ok) return;
          const result = await response.json() as { alerts?: ActivityAlert[] };
          if (!active) return;
          const next = result.alerts ?? [];
          setAlerts(next);
          writeCachedActivityAlerts(next);
        })
        .catch(() => undefined);
    };
    refresh();
    window.addEventListener("cocomelon:transactions-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("cocomelon:transactions-changed", refresh);
    };
  }, [enabled]);

  return enabled ? alerts : [];
}

function detailParts(detail: string) {
  const [subject, ...context] = detail.split(" · ");
  return { subject, context: context.join(" · ") };
}

export function ActivityAlertRow({ alert }: { alert: ActivityAlert }) {
  const appearance = alertAppearance[alert.kind];
  const Icon = appearance.icon;
  const percentage = Math.max(0, Math.round(alert.progress ?? 0));
  const details = detailParts(alert.detail);
  const showProgress = alert.kind === "budget" || alert.kind === "goal";
  return (
    <Link
      href={alert.href}
      aria-label={`Open ${alert.feature.toLowerCase()} alert: ${alert.label}`}
      className={`group relative mx-2 my-2 flex ${showProgress ? "min-h-[136px]" : "min-h-[98px]"} items-start gap-3 overflow-hidden rounded-[16px] border border-border/70 px-3.5 py-4 shadow-[0_6px_20px_rgb(23_32_29_/_0.05)] transition-all hover:-translate-y-px hover:shadow-[0_9px_24px_rgb(23_32_29_/_0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 ${appearance.surfaceClass}`}
    >
      <span className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[10px] ${appearance.iconClass}`}>
        <Icon aria-hidden="true" className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <span className="transaction-list-title-clamp min-w-0 break-words text-[15px] font-semibold leading-5 text-foreground sm:flex-1 sm:truncate">
            {alert.label}
          </span>
          <span className={`max-w-full break-words text-[14px] font-semibold leading-5 tabular-nums sm:shrink-0 sm:whitespace-nowrap sm:text-right ${appearance.valueClass}`}>
            {showProgress ? `${percentage}%` : alert.value}
          </span>
        </span>
        {alert.kind === "goal" ? (
          <>
            <span className="mt-1.5 flex min-w-0 items-baseline justify-between gap-3 text-xs">
              <span className="truncate font-medium text-muted-foreground">{alert.goalName ?? details.subject}</span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground" aria-label={`Saved and target ${alert.value}`} title="Saved / target">{alert.value}</span>
            </span>
            {details.context ? <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{details.context}</span> : null}
          </>
        ) : (
          <span className="mt-1.5 flex min-w-0 flex-col gap-1.5 text-xs text-muted-foreground sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <span className="transaction-list-description-clamp min-w-0 break-words leading-4 sm:flex-1 sm:truncate">{alert.kind === "budget" ? budgetScope(alert.detail) : alert.detail}</span>
            {alert.kind === "budget" ? <span className="max-w-full break-words font-semibold leading-4 tabular-nums text-foreground sm:shrink-0 sm:whitespace-nowrap sm:text-right" aria-label={`Spent and limit ${alert.value}`} title="Spent / limit">{alert.value}</span> : null}
          </span>
        )}
        {showProgress ? (
          <span
            className="mt-3 block"
            role="progressbar"
            aria-label={`${alert.kind === "budget" ? "Budget" : "Goal"} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, percentage)}
          >
            <span className="block h-2 overflow-hidden rounded-full bg-background/70">
              <span className={`block h-full rounded-full ${appearance.progressClass}`} style={{ width: `${Math.min(100, percentage)}%` }} />
            </span>
            <span className="mt-1 flex justify-between gap-3 text-[10px] font-medium text-muted-foreground">
              <span>{alert.kind === "budget" ? "Spent" : "Saved"}</span>
              <span>{alert.kind === "budget" ? "Limit" : "Target"}</span>
            </span>
          </span>
        ) : null}
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-foreground-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
