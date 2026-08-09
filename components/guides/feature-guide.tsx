import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Check, CircleHelp } from "lucide-react";

import { StickyPageHeader } from "@/components/layout/sticky-page-header";

export type FeatureGuideConfig = {
  path: string;
  label: string;
  title: string;
  eyebrow: string;
  icon: LucideIcon;
  summary: string;
  why: string;
  steps: Array<{ title: string; description: string }>;
  example: {
    title: string;
    subtitle: string;
    amount?: string;
    rows: Array<{ label: string; value: string; tone?: "income" | "expense" | "primary" }>;
  };
};

const toneClasses = {
  income: "text-income",
  expense: "text-expense",
  primary: "text-primary",
} as const;

function safeBackPath(value: string | undefined, fallback: string) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/api/")
    ? value
    : fallback;
}

export function FeatureGuide({ config, returnTo }: { config: FeatureGuideConfig; returnTo?: string }) {
  const Icon = config.icon;
  const backHref = safeBackPath(returnTo, config.path);

  return (
    <main className="page-route-enter min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-12 sm:px-5">
        <StickyPageHeader className="-mx-4 flex items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <Link href={backHref} aria-label={`Back to ${config.label.toLowerCase()}`} className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
            <ArrowLeft aria-hidden="true" className="size-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{config.label}</p>
            <h1 className="truncate text-[26px] font-semibold tracking-[-0.04em]">{config.title}</h1>
          </div>
        </StickyPageHeader>

        <section className="mt-7 rounded-[18px] border border-primary/15 bg-primary-soft/55 p-5 sm:p-6">
          <span className="flex size-11 items-center justify-center rounded-[12px] bg-card text-primary shadow-sm">
            <Icon aria-hidden="true" className="size-6" />
          </span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{config.eyebrow}</p>
          <h2 className="mt-1 text-[26px] font-semibold tracking-[-0.045em]">{config.summary}</h2>
          <p className="mt-3 max-w-[58ch] text-sm leading-6 text-muted-foreground">{config.why}</p>
        </section>

        <section aria-labelledby={`${config.path.slice(1)}-steps-heading`} className="mt-8">
          <p className="px-1 text-xs font-medium text-muted-foreground">How to use it</p>
          <h2 id={`${config.path.slice(1)}-steps-heading`} className="mt-1 px-1 text-[21px] font-semibold tracking-[-0.03em]">Three useful steps</h2>
          <div className="mt-4 divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-card">
            {config.steps.map((step, index) => (
              <div key={step.title} className="flex items-start gap-3 px-4 py-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{index + 1}</span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{step.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby={`${config.path.slice(1)}-example-heading`} className="mt-8">
          <p className="px-1 text-xs font-medium text-muted-foreground">Example</p>
          <h2 id={`${config.path.slice(1)}-example-heading`} className="mt-1 px-1 text-[21px] font-semibold tracking-[-0.03em]">{config.example.title}</h2>
          <div className="mt-4 overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="flex items-center gap-3 bg-primary-soft/55 px-4 py-4">
              <span className="flex size-10 items-center justify-center rounded-[11px] bg-card text-primary shadow-sm"><Check aria-hidden="true" className="size-[18px]" /></span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{config.example.subtitle}</p><p className="mt-0.5 text-xs text-muted-foreground">Fictional example</p></div>
              {config.example.amount ? <p className="text-right text-sm font-semibold tabular-nums">{config.example.amount}</p> : null}
            </div>
            <div className="divide-y divide-border px-4">
              {config.example.rows.map((row) => <div key={row.label} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-muted-foreground">{row.label}</span><span className={`font-semibold tabular-nums ${row.tone ? toneClasses[row.tone] : ""}`}>{row.value}</span></div>)}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function GuideIcon({ href, label }: { href: string; label: string }) {
  return <Link href={href} aria-label={`${label} guide`} className="flex size-7 shrink-0 items-center justify-center text-primary transition-colors hover:text-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><CircleHelp aria-hidden="true" className="size-[18px]" /></Link>;
}
