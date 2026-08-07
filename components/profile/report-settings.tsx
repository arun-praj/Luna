"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

export function ReportSettingsCard() {
  return (
    <section aria-labelledby="reports-heading" className="mt-6 overflow-hidden rounded-[14px] border border-border bg-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary"><FileText aria-hidden="true" className="size-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <p id="reports-heading" className="text-[15px] font-semibold">Money reports</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">AI insights, spending categories, savings, and a simple forecast.</p>
        </div>
        <Link href="/reports" className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-[9px] px-2 text-xs font-semibold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">Open <FileText aria-hidden="true" className="size-3.5" /></Link>
      </div>
    </section>
  );
}
