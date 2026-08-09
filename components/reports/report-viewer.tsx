"use client";

import Link from "next/link";
import { ArrowLeft, FileDown, Lightbulb, LoaderCircle, Mail, RefreshCw, ShieldCheck, Sparkles, Target, TrendingUp, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { GuideIcon } from "@/components/guides/feature-guide";
import { authenticatedFetch, safeReturnPath } from "@/lib/auth-client";

type Period = "weekly" | "monthly" | "yearly";
type ReportData = {
  period: { type: Period; start: string; end: string; label: string };
  generatedAt: string;
  currency: string;
  transactionCount: number;
  totals: { spending: number; earning: number; savings: number; net: number };
  categorySpending: Array<{ name: string; icon: string | null; color: string | null; amount: number; share: number }>;
  topExpense: { title: string; category: string; amount: number; date: string } | null;
  forecast: { label: string; spending: number; earning: number; savings: number; basis: string };
  insights: Array<{ icon: string; title: string; body: string }>;
  suggestions: string[];
  ai: { enabled: boolean; source: "nvidia" | "local" };
};

const periods: Array<{ value: Period; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const insightIcons = { sparkles: Sparkles, trend: TrendingUp, wallet: WalletCards, shield: ShieldCheck, target: Target, lightbulb: Lightbulb } as const;

function warmupKey(period: Period) {
  return `luna.report-auto-refresh:${period}:${new Date().toISOString().slice(0, 10)}`;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function formatMoney(value: number, currency: string) {
  return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(year, month - 1, day));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReportViewer({ returnTo }: { returnTo?: string }) {
  const [period, setPeriod] = useState<Period>("monthly");
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const returnHref = safeReturnPath(returnTo, "/");

  useEffect(() => {
    let active = true;

    async function pollForReport() {
      for (let attempt = 0; attempt < 20 && active; attempt += 1) {
        await wait(2000);
        const response = await authenticatedFetch(`/api/reports?period=${period}`);
        const result = (await response.json().catch(() => null)) as ReportData | { error?: string } | { status?: string } | null;
        if (response.ok) {
          if (active) {
            setReport(result as ReportData);
            setIsPreparing(false);
          }
          return;
        }
        if (response.status !== 202) {
          if (active) setError(result && "error" in result ? result.error ?? "Could not load report" : "Could not load report");
          return;
        }
      }
      if (active) {
        setIsPreparing(false);
        setError("Your report is still being prepared. Try opening Reports again shortly.");
      }
    }

    async function warmReportInBackground({ pollWhenSkipped = false }: { pollWhenSkipped?: boolean } = {}) {
      let shouldStart = true;
      const key = warmupKey(period);
      try {
        if (window.localStorage.getItem(key)) shouldStart = false;
        else window.localStorage.setItem(key, "started");
      } catch {
        // Browser storage can be unavailable; the server still enforces the daily limit.
      }

      if (shouldStart) {
        if (active) setIsRefreshing(true);
        let response: Response;
        try {
          response = await authenticatedFetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period, refresh: true }) });
        } catch (reason) {
          try { window.localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
          if (active) setIsRefreshing(false);
          throw reason;
        }
        const result = (await response.json().catch(() => null)) as { report?: ReportData; error?: string } | null;
        if (!response.ok) {
          if (response.status !== 429) {
            try { window.localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
          }
          if (active) {
            setIsPreparing(false);
            setError(result?.error ?? "Could not prepare report");
            setIsRefreshing(false);
          }
          return;
        }
        if (active && result?.report) {
          setReport(result.report);
          setIsPreparing(false);
          setIsRefreshing(false);
          setMessage("Report refreshed automatically");
        }
        return;
      }

      if (pollWhenSkipped) await pollForReport();
    }

    async function loadCachedReport() {
      setIsPreparing(false);
      const response = await authenticatedFetch(`/api/reports?period=${period}`);
      const result = (await response.json().catch(() => null)) as ReportData | { error?: string } | { status?: string } | null;
      if (response.status === 202) {
        if (active) {
          setReport(null);
          setIsLoading(false);
          setIsPreparing(true);
        }
        void warmReportInBackground({ pollWhenSkipped: true }).catch((reason) => {
          if (active) {
            setIsPreparing(false);
            setIsRefreshing(false);
            if (!(reason instanceof Error && reason.name === "AbortError")) {
              setError(reason instanceof Error ? reason.message : "Could not prepare report");
            }
          }
        });
        return;
      }
      if (!response.ok) throw new Error(result && "error" in result ? result.error : "Could not load report");
      if (active) {
        setReport(result as ReportData);
        setIsLoading(false);
        void warmReportInBackground().catch((reason) => {
          if (active) {
            setIsRefreshing(false);
            if (!(reason instanceof Error && reason.name === "AbortError")) {
              setError(reason instanceof Error ? reason.message : "Could not refresh report");
            }
          }
        });
      }
    }

    void loadCachedReport()
      .catch((reason) => { if (active) setError(reason instanceof Error && reason.name !== "AbortError" ? reason.message : "Could not load report. Please try again."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [period]);

  function selectPeriod(nextPeriod: Period) {
    if (nextPeriod === period) return;
    setError("");
    setIsLoading(true);
    setPeriod(nextPeriod);
  }

  async function refreshReport() {
    setIsRefreshing(true);
    setError("");
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period, refresh: true }) });
      const result = (await response.json().catch(() => null)) as { report?: ReportData; error?: string } | null;
      if (!response.ok || !result?.report) throw new Error(result?.error ?? "Could not refresh report");
      setReport(result.report);
      setIsPreparing(false);
      setMessage("Report refreshed");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not refresh report. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function downloadReport() {
    setIsDownloading(true);
    setMessage("");
    try {
      if (!report) {
        setMessage("Load the report before creating the PDF");
        return;
      }
      const response = await authenticatedFetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period, format: "pdf", report }) });
      if (response.ok) {
        downloadBlob(await response.blob(), `luna-${period}-report.pdf`);
        setMessage("PDF downloaded");
      } else {
        setMessage("Could not create the PDF");
      }
    } catch {
      setMessage("Could not create the PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  async function sendReport() {
    setIsSending(true);
    setMessage("");
    try {
      if (!report) {
        setMessage("Load the report before sending the email");
        return;
      }
      const response = await authenticatedFetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period, sendEmail: true, report }) });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(response.ok ? "Report emailed to your verified address" : result?.error ?? "Could not send report");
    } catch {
      setMessage("Could not send the report. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="page-route-enter min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-10 sm:px-5">
        <StickyPageHeader className="-mx-4 px-4 pb-3 sm:-mx-5 sm:px-5">
          <div className="flex items-center gap-3">
            <Link href={returnHref} aria-label={returnHref === "/profile" ? "Back to profile" : "Back to home"} className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><ArrowLeft aria-hidden="true" className="size-5" /></Link>
            <div className="min-w-0"><h1 className="truncate text-[25px] font-semibold tracking-[-0.04em]">Money reports</h1><p className="mt-0.5 text-xs font-medium text-muted-foreground">Clear patterns, without a chart.</p></div>
            <GuideIcon href={`/reports/guide?returnTo=${encodeURIComponent(returnHref)}`} label="Reports" />
            <div className="relative ml-auto flex items-center gap-2" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActionsOpen(false); }}>
              <button type="button" onClick={() => setActionsOpen((open) => !open)} disabled={!report || isLoading || isPreparing || isDownloading || isSending} aria-label="Download or email report" title="Download or email report" aria-expanded={actionsOpen} className="flex size-11 shrink-0 items-center justify-center rounded-[11px] bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-45"><FileDown aria-hidden="true" className="size-[18px]" /></button>
              {actionsOpen ? <div role="menu" className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[210px] overflow-hidden rounded-[12px] border border-border bg-card p-1.5 shadow-xl"><button type="button" role="menuitem" onClick={() => { setActionsOpen(false); void downloadReport(); }} className="flex min-h-11 w-full items-center gap-2.5 rounded-[9px] px-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:bg-primary-soft"><FileDown aria-hidden="true" className="size-4 text-primary" />Download PDF</button><button type="button" role="menuitem" onClick={() => { setActionsOpen(false); void sendReport(); }} className="flex min-h-11 w-full items-center gap-2.5 rounded-[9px] px-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:bg-primary-soft"><Mail aria-hidden="true" className="size-4 text-primary" />Email this report</button></div> : null}
              <button type="button" onClick={() => void refreshReport()} disabled={isRefreshing || isLoading || isPreparing} aria-label={isRefreshing ? "Refreshing report" : "Refresh report"} title={isRefreshing ? "Refreshing report" : "Refresh report"} className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60"><RefreshCw aria-hidden="true" className={`size-[18px] ${isRefreshing || isPreparing ? "animate-spin" : ""}`} /></button>
            </div>
          </div>
        </StickyPageHeader>

        <section className="mt-8" aria-labelledby="report-heading">
          {message ? <p role="status" className="mb-3 rounded-[10px] bg-primary-soft px-3 py-2 text-xs font-medium text-primary">{message}</p> : null}
          {error ? <p role="alert" className="mb-3 rounded-[12px] border border-expense/25 bg-expense-soft px-4 py-3 text-sm font-semibold text-expense">{error}</p> : null}
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Your money, understood</p><h2 id="report-heading" className="mt-2 text-[30px] font-semibold tracking-[-0.045em]">A calmer financial check-in</h2></div><div className="flex items-center gap-2 rounded-[12px] border border-border bg-card p-1" role="tablist" aria-label="Report period">{periods.map((option) => <button key={option.value} type="button" role="tab" aria-selected={period === option.value} onClick={() => selectPeriod(option.value)} className={`rounded-[9px] px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${period === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-subtle"}`}>{option.label}</button>)}</div></div>

          {isLoading ? <div className="mt-8 flex min-h-56 items-center justify-center rounded-[16px] border border-border bg-card text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-5 animate-spin" /><span className="ml-2 text-sm">Loading saved report…</span></div> : isPreparing ? <div role="status" className="mt-8 flex min-h-56 flex-col items-center justify-center rounded-[16px] border border-border bg-card px-5 text-center text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" /><p className="mt-3 text-sm font-semibold text-foreground">Preparing your first report</p><p className="mt-1 max-w-sm text-xs leading-5">This runs in the background. You can leave this page and come back when it is ready.</p></div> : report ? <>
            <div className="mt-6 grid grid-cols-1 gap-3 min-[520px]:grid-cols-3">
              {[{ label: "Total spending", value: report.totals.spending, tone: "expense" }, { label: "Total earning", value: report.totals.earning, tone: "income" }, { label: "Total savings", value: report.totals.savings, tone: "primary" }].map((metric) => <div key={metric.label} className="rounded-[14px] border border-border bg-card px-4 py-4"><p className="text-xs font-medium text-muted-foreground">{metric.label}</p><p className={`mt-2 text-[19px] font-semibold tracking-[-0.025em] ${metric.tone === "expense" ? "text-expense" : metric.tone === "income" ? "text-income" : "text-primary"}`}>{formatMoney(metric.value, report.currency)}</p></div>)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{report.period.label}</span><span aria-hidden="true">·</span><span>{report.transactionCount} transaction{report.transactionCount === 1 ? "" : "s"}</span><span aria-hidden="true">·</span><span>{report.ai.source === "nvidia" ? "NVIDIA AI insights" : "Local insights"}</span></div>

            <section className="mt-8 rounded-[16px] border border-border bg-card p-4 sm:p-5" aria-labelledby="ai-insights-heading"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-[11px] bg-primary-soft text-primary"><Sparkles aria-hidden="true" className="size-[18px]" /></span><div><h3 id="ai-insights-heading" className="text-[17px] font-semibold">AI insights</h3><p className="text-xs text-muted-foreground">{report.ai.enabled ? "Generated from your aggregated report data." : "Generated locally because NVIDIA AI was unavailable."}</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{report.insights.map((insight) => { const Icon = insightIcons[insight.icon as keyof typeof insightIcons] ?? Sparkles; return <article key={`${insight.title}-${insight.body}`} className="rounded-[12px] bg-surface-subtle/60 p-3"><Icon aria-hidden="true" className="size-4 text-primary" /><h4 className="mt-2 text-sm font-semibold">{insight.title}</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">{insight.body}</p></article>; })}</div></section>

            <section className="mt-4 rounded-[16px] border border-border bg-card p-4 sm:p-5" aria-labelledby="category-spending-heading"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-[11px] bg-expense-soft text-expense"><WalletCards aria-hidden="true" className="size-[18px]" /></span><div><h3 id="category-spending-heading" className="text-[17px] font-semibold">Category spending</h3><p className="text-xs text-muted-foreground">A ranked list, so the important number stays clear.</p></div></div><div className="mt-4 divide-y divide-border">{report.categorySpending.length ? report.categorySpending.map((category) => <div key={category.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="size-2.5 shrink-0 rounded-full bg-expense" style={category.color ? { backgroundColor: category.color } : undefined} /><span className="min-w-0 flex-1 text-sm font-medium">{category.name}</span><span className="text-xs text-muted-foreground">{category.share}%</span><span className="text-sm font-semibold text-expense">{formatMoney(category.amount, report.currency)}</span></div>) : <p className="py-3 text-sm text-muted-foreground">No expense categories recorded for this period.</p>}</div></section>

            <div className="mt-4 grid gap-4 sm:grid-cols-2"><section className="rounded-[16px] border border-border bg-card p-4 sm:p-5" aria-labelledby="top-expense-heading"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-[11px] bg-expense-soft text-expense"><Target aria-hidden="true" className="size-[18px]" /></span><h3 id="top-expense-heading" className="text-[17px] font-semibold">Most costly expense</h3></div>{report.topExpense ? <div className="mt-5"><p className="text-base font-semibold">{report.topExpense.title}</p><p className="mt-1 text-xs text-muted-foreground">{report.topExpense.category} · {formatDate(report.topExpense.date)}</p><p className="mt-3 text-[20px] font-semibold text-expense">{formatMoney(report.topExpense.amount, report.currency)}</p></div> : <p className="mt-5 text-sm text-muted-foreground">No expenses recorded yet.</p>}</section><section className="rounded-[16px] border border-border bg-card p-4 sm:p-5" aria-labelledby="forecast-heading"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-[11px] bg-primary-soft text-primary"><TrendingUp aria-hidden="true" className="size-[18px]" /></span><h3 id="forecast-heading" className="text-[17px] font-semibold">Future forecast</h3></div><p className="mt-5 text-sm font-semibold">{report.forecast.label}</p><dl className="mt-3 space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Expected spending</dt><dd className="font-semibold text-expense">{formatMoney(report.forecast.spending, report.currency)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Expected earning</dt><dd className="font-semibold text-income">{formatMoney(report.forecast.earning, report.currency)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Expected savings</dt><dd className="font-semibold text-primary">{formatMoney(report.forecast.savings, report.currency)}</dd></div></dl><p className="mt-3 text-[11px] leading-5 text-muted-foreground">{report.forecast.basis}</p></section></div>

            <section className="mt-4 rounded-[16px] border border-border bg-card p-4 sm:p-5" aria-labelledby="suggestions-heading"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-[11px] bg-income-soft text-income"><Lightbulb aria-hidden="true" className="size-[18px]" /></span><div><h3 id="suggestions-heading" className="text-[17px] font-semibold">Suggestions</h3><p className="text-xs text-muted-foreground">Small next steps based on this period.</p></div></div><ul className="mt-4 space-y-3">{report.suggestions.map((suggestion) => <li key={suggestion} className="flex gap-2.5 text-sm leading-5"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-income" /><span>{suggestion}</span></li>)}</ul></section>

          </> : null}
        </section>
      </div>
    </main>
  );
}
