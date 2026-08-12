"use client";

import { Check, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Transaction } from "@/lib/transactions";
import { transactionTypes } from "./types";

export type SelectedTransactionType = {
  value: Transaction["kind"];
  label: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
  foregroundClassName: string;
};

export function TransactionTypeForm({
  kind,
  open,
  selectedType,
  hasError,
  onToggle,
  onSelect,
}: {
  kind: Transaction["kind"] | "";
  open: boolean;
  selectedType?: SelectedTransactionType;
  hasError: boolean;
  onToggle: () => void;
  onSelect: (value: Transaction["kind"]) => void;
}) {
  return (
    <div className="relative min-w-0">
      {selectedType ? <selectedType.icon aria-hidden="true" className={`pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 ${selectedType.foregroundClassName}`} /> : null}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={onToggle}
        className={`h-11 w-full rounded-[11px] border bg-card pl-10 pr-9 text-left text-[15px] font-semibold outline-none transition-colors focus:ring-2 focus:ring-primary/20 ${selectedType?.foregroundClassName ?? "text-muted-foreground"} ${hasError ? "border-expense" : open ? "border-primary" : "border-border"}`}
      >
        {selectedType?.label ?? "Choose type"}
      </button>
      <ChevronDown aria-hidden="true" className={`pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      {open ? (
        <div role="listbox" aria-label="Transaction type" className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-[14px] border border-border bg-card p-1.5 shadow-[0_16px_44px_rgb(23_32_29_/_0.16)]">
          {transactionTypes.map((type) => {
            const Icon = type.icon;
            const selected = kind === type.value;
            return (
              <button type="button" role="option" aria-selected={selected} key={type.value} onClick={() => onSelect(type.value)} className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors ${selected ? "bg-primary-soft" : "hover:bg-surface-subtle"}`}>
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-[9px] ${type.iconClassName}`}><Icon aria-hidden="true" className="size-[17px]" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{type.label}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{type.description}</span></span>
                {selected ? <Check aria-hidden="true" className="size-4 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
