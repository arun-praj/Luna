"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Landmark, Plus } from "lucide-react";

import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { ListDataSkeleton, Skeleton } from "@/components/ui/data-skeleton";
import { authenticatedFetch } from "@/lib/auth-client";
import { getSavingsColor, getSavingsIconSource } from "@/lib/savings-appearance";
import { getCurrentRoute, getReturnTo, withReturnTo } from "@/lib/navigation";

type SavingsInstrument = { id: string; typeId: string; typeName: string; name: string; description: string; currentBalance: number; interestRate: number | null; icon: string | null; backgroundColor: string | null; maturityDate: string | null };

function formatAmount(amount: number) { return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount); }
function formatDate(value: string | null) { if (!value) return "No maturity date"; return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }

export default function SavingsInstrumentsPage() {
  const [backHref, setBackHref] = useState("/");
  const [currentRoute, setCurrentRoute] = useState("/");
  const [instruments, setInstruments] = useState<SavingsInstrument[]>([]);
  const [currency, setCurrency] = useState("NPR");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setBackHref(getReturnTo("/"));
      setCurrentRoute(getCurrentRoute());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([authenticatedFetch("/api/savings/instruments"), authenticatedFetch("/api/auth/me")]).then(async ([instrumentResponse, userResponse]) => {
      if (!instrumentResponse.ok) throw new Error(instrumentResponse.status === 401 ? "Please sign in to view saving instruments." : "Could not load saving instruments.");
      const result = await instrumentResponse.json() as { instruments: SavingsInstrument[] };
      const user = userResponse.ok ? await userResponse.json() as { user?: { currency?: string } } : {};
      if (active) { setInstruments(result.instruments); setCurrency(user.user?.currency ?? "NPR"); }
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load saving instruments."); }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const totalBalance = useMemo(() => instruments.reduce((total, instrument) => total + instrument.currentBalance, 0), [instruments]);
  const nextMaturity = instruments.filter((instrument) => instrument.maturityDate).sort((a, b) => (a.maturityDate ?? "").localeCompare(b.maturityDate ?? ""))[0];

  return (
    <main className="page-route-enter min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-12 sm:px-5">
        <StickyPageHeader className="-mx-4 flex items-center justify-between gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3"><Link href={backHref} aria-label="Back" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground"><ArrowLeft aria-hidden="true" className="size-5" /></Link><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Manage your money</p><h1 className="truncate text-[26px] font-semibold tracking-[-0.04em]">Saving Instruments</h1></div></div>
          <Link href={withReturnTo("/savings-instruments/new", currentRoute)} aria-label="Add saving instrument" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary"><Plus aria-hidden="true" className="size-[19px]" /></Link>
        </StickyPageHeader>
        <section aria-label="Savings overview" className="mt-8 grid grid-cols-2 divide-x divide-border rounded-[14px] border border-border bg-card"><div className="min-w-0 px-4 py-4"><p className="text-xs font-semibold text-muted-foreground">Total saved</p><p className="mt-2 truncate text-[22px] font-semibold tracking-[-0.035em] tabular-nums">{isLoading ? <Skeleton className="inline-block h-7 w-28 align-middle" /> : <><span className="mr-1 text-xs tracking-normal text-muted-foreground">{currency}</span>{formatAmount(totalBalance)}</>}</p></div><div className="min-w-0 px-4 py-4"><p className="text-xs font-semibold text-muted-foreground">Instruments</p><p className="mt-2 truncate text-[22px] font-semibold tracking-[-0.035em] tabular-nums">{isLoading ? <Skeleton className="inline-block h-7 w-12 align-middle" /> : instruments.length}</p></div></section>
        <section aria-labelledby="savings-list-heading" className="mt-8"><div className="flex items-end justify-between gap-3 px-1"><div><p className="text-xs font-medium text-muted-foreground">Build wealth with intention</p><h2 id="savings-list-heading" className="mt-1 text-[20px] font-semibold tracking-[-0.03em]">Your saving instruments</h2></div>{nextMaturity ? <p className="text-right text-[11px] font-medium text-muted-foreground">Next maturity<br /><span className="font-semibold text-primary">{formatDate(nextMaturity.maturityDate)}</span></p> : null}</div>
          {error ? <p role="alert" className="mt-4 rounded-[14px] border border-expense/25 bg-expense-soft px-4 py-3 text-sm font-medium text-expense">{error}</p> : isLoading ? <div className="mt-4"><ListDataSkeleton rows={2} /></div> : instruments.length === 0 ? <div className="mt-4 rounded-[18px] border border-dashed border-border bg-card px-5 py-8 text-center sm:px-8"><span className="mx-auto flex size-14 items-center justify-center rounded-[16px] bg-primary-soft text-primary"><Landmark aria-hidden="true" className="size-7" /></span><h3 className="mt-4 text-base font-semibold">Give your savings a home</h3><p className="mx-auto mt-2 max-w-[390px] text-sm leading-6 text-muted-foreground">Saving instruments help you track money set aside for goals, such as a fixed deposit, emergency fund, or a future purchase.</p><Link href={withReturnTo("/savings-instruments/new", currentRoute)} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-primary/25 bg-primary-soft px-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"><Plus aria-hidden="true" className="size-4" />Add an instrument</Link></div> : <div className="mt-4 space-y-3">{instruments.map((instrument) => { const color = getSavingsColor(instrument.backgroundColor); return <Link key={instrument.id} href={withReturnTo(`/savings-instruments/${instrument.id}`, currentRoute)} className={`flex items-center gap-3 rounded-[15px] border p-3.5 transition-colors hover:brightness-[0.98] ${color.cardClassName}`}><span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-white/70 bg-white/45"><Image src={getSavingsIconSource(instrument.icon)} alt="" width={48} height={48} className="size-full object-cover" unoptimized /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{instrument.name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{instrument.typeName}{instrument.maturityDate ? ` · Matures ${formatDate(instrument.maturityDate)}` : ""}</span></span><span className="shrink-0 text-right"><span className="block text-sm font-semibold tabular-nums">{currency} {formatAmount(instrument.currentBalance)}</span><ChevronRight aria-hidden="true" className="ml-auto mt-1 size-4 text-muted-foreground" /></span></Link>; })}</div>}
        </section>
      </div>
    </main>
  );
}
