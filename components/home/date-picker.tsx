"use client";

import * as React from "react";
import { format, isSameDay, isSameMonth, sub } from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronRight,
  History,
  Minus,
  Plus,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { Dialog } from "radix-ui";

import { Calendar } from "@/components/ui/calendar";

const CURRENT_DATE = new Date();
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const UNITS = ["days", "weeks", "months", "years"] as const;

type PeriodUnit = (typeof UNITS)[number];
export type FilterMode = "day" | "month" | "custom" | "last" | "all";

export type AppliedPeriod = {
  mode: FilterMode;
  label: string;
  from?: Date;
  to?: Date;
};

function formatRange(range: DateRange) {
  if (!range.from) return "Select period";
  if (!range.to || isSameDay(range.from, range.to)) {
    return format(range.from, "MMM d");
  }
  if (isSameMonth(range.from, range.to)) {
    return `${format(range.from, "MMM d")}–${format(range.to, "d")}`;
  }
  return `${format(range.from, "MMM d")}–${format(range.to, "MMM d")}`;
}

function formatLastPeriod(amount: number, unit: PeriodUnit) {
  const singularUnit = unit.slice(0, -1);
  return `Last ${amount} ${amount === 1 ? singularUnit : unit}`;
}

function CompactDivider() {
  return <div aria-hidden="true" className="h-px bg-border" />;
}

export function DatePicker({
  initialMode = "day",
  initialLabel,
  triggerLabel,
  triggerAriaLabel,
  triggerIcon,
  onApply,
  footer,
}: {
  initialMode?: FilterMode;
  initialLabel?: string;
  triggerLabel?: string;
  triggerAriaLabel?: string;
  triggerIcon?: LucideIcon;
  onApply?: (period: AppliedPeriod) => void;
  footer?: (apply: () => void, canApply: boolean) => React.ReactNode;
} = {}) {
  const [open, setOpen] = React.useState(false);
  const [periodLabel, setPeriodLabel] = React.useState(
    initialLabel ??
      (initialMode === "month"
        ? `${MONTHS[CURRENT_DATE.getMonth()]} ${CURRENT_DATE.getFullYear()}`
        : format(CURRENT_DATE, "MMM d")),
  );
  const [committedMode, setCommittedMode] =
    React.useState<FilterMode>(initialMode);
  const [draftMode, setDraftMode] = React.useState<FilterMode>("day");
  const [selectedMonth, setSelectedMonth] = React.useState(
    CURRENT_DATE.getMonth(),
  );
  const [customRange, setCustomRange] = React.useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [calendarMonth, setCalendarMonth] = React.useState(CURRENT_DATE);
  const [amount, setAmount] = React.useState(4);
  const [unit, setUnit] = React.useState<PeriodUnit>("weeks");
  const TriggerIcon = triggerIcon ?? CalendarDays;

  const setOpenState = (nextOpen: boolean) => {
    if (nextOpen) setDraftMode(committedMode);
    if (!nextOpen) setCalendarOpen(false);
    setOpen(nextOpen);
  };

  const chooseCustomRange = (range: DateRange | undefined) => {
    if (!range) return;
    setCustomRange(range);
    setDraftMode("custom");
    if (range.from) setCalendarMonth(range.from);
  };

  const canApply =
    draftMode !== "day" &&
    (draftMode !== "custom" || Boolean(customRange.from && customRange.to));

  const applyFilter = () => {
    if (!canApply) return;

    let nextLabel = periodLabel;
    let from: Date | undefined;
    let to: Date | undefined;
    if (draftMode === "month") {
      nextLabel = `${MONTHS[selectedMonth]} ${CURRENT_DATE.getFullYear()}`;
      from = new Date(CURRENT_DATE.getFullYear(), selectedMonth, 1);
      to = new Date(CURRENT_DATE.getFullYear(), selectedMonth + 1, 0);
    } else if (draftMode === "custom" && customRange.from && customRange.to) {
      nextLabel = formatRange(customRange);
      from = customRange.from;
      to = customRange.to;
    } else if (draftMode === "last") {
      nextLabel = formatLastPeriod(amount, unit);
      from = sub(CURRENT_DATE, { [unit]: amount });
      to = CURRENT_DATE;
    } else if (draftMode === "all") {
      nextLabel = "All time";
    } else {
      from = CURRENT_DATE;
      to = CURRENT_DATE;
    }

    setPeriodLabel(nextLabel);
    setCommittedMode(draftMode);
    onApply?.({ mode: draftMode, label: nextLabel, from, to });
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpenState}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={triggerAriaLabel ?? `Choose reporting period, currently ${periodLabel}`}
          onClick={() => setOpenState(true)}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-[10px] border border-border bg-card px-3.5 text-sm font-semibold text-foreground shadow-[0_1px_2px_rgb(23_32_29_/_0.03)] transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          <TriggerIcon
            aria-hidden="true"
            className="size-[18px] text-primary"
          />
          <span className="max-w-24 truncate">{triggerLabel ?? periodLabel}</span>
          <ChevronRight
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/15 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed inset-0 z-50 h-dvh overflow-hidden bg-background outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-4">
          <div className="mx-auto flex h-full w-full max-w-[720px] flex-col">
            <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-border px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Cancel period filter"
                  className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
              </Dialog.Close>

              <Dialog.Title className="text-[18px] font-semibold tracking-[-0.025em]">
                Select period
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Select a month, custom range, recent period, or all-time data.
              </Dialog.Description>

              <button
                type="button"
                aria-label="Apply period filter"
                disabled={!canApply}
                onClick={applyFilter}
                className="flex size-11 items-center justify-center justify-self-end rounded-[11px] border border-primary/20 bg-primary-soft text-primary transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:border-border disabled:bg-surface-subtle disabled:text-foreground-subtle"
              >
                <Check aria-hidden="true" className="size-5" />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
              <section aria-labelledby="month-heading">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id="month-heading" className="text-sm font-semibold">
                    Choose a month
                  </h2>
                  <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {CURRENT_DATE.getFullYear()}
                  </span>
                </div>
                <div className="-mx-4 mt-2 flex snap-x gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-5 sm:px-5">
                  {MONTHS.map((month, index) => {
                    const selected = selectedMonth === index;
                    const current = index === CURRENT_DATE.getMonth();

                    return (
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${month}${current ? " (current month)" : ""}${selected ? " (selected)" : ""}`}
                        className={`relative flex min-h-10 min-w-[64px] snap-start items-center justify-center gap-1.5 rounded-[9px] border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${current ? "ring-1 ring-income/45 ring-offset-1 ring-offset-background" : ""} ${
                          selected
                            ? "border-primary bg-primary-soft text-primary"
                            : current
                              ? "border-income/45 bg-income-soft/60 text-income"
                            : "border-border bg-card text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
                        }`}
                        key={month}
                        onClick={() => {
                          setSelectedMonth(index);
                          setDraftMode("month");
                        }}
                      >
                        {month}
                        {current ? <span aria-hidden="true" className="size-1.5 rounded-full bg-income" /> : null}
                      </button>
                    );
                  })}
                </div>
              </section>

              <CompactDivider />

              <section aria-labelledby="custom-heading">
                <h2 id="custom-heading" className="text-sm font-semibold">
                  Custom range
                </h2>
                <button
                  type="button"
                  aria-label="Choose custom date range"
                  className={`mt-2 flex min-h-[60px] w-full items-center justify-between gap-3 rounded-[10px] border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                    draftMode === "custom"
                      ? "border-primary/50 bg-primary-soft/60"
                      : "border-border bg-card hover:bg-surface-subtle"
                  }`}
                  onClick={() => {
                    setDraftMode("custom");
                    setCalendarMonth(customRange.from ?? CURRENT_DATE);
                    setCalendarOpen(true);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block text-[11px] font-medium text-muted-foreground">
                      Date range
                    </span>
                    <span
                      className={`mt-0.5 block truncate text-sm font-semibold ${
                        customRange.from && customRange.to
                          ? "text-foreground"
                          : "text-primary"
                      }`}
                    >
                      {customRange.from && customRange.to
                        ? `${format(customRange.from, "MMM d, yyyy")} – ${format(customRange.to, "MMM d, yyyy")}`
                        : "Select start and end dates"}
                    </span>
                  </span>
                  <CalendarDays
                    aria-hidden="true"
                    className="size-5 shrink-0 text-primary"
                  />
                </button>
              </section>

              <CompactDivider />

              <section
                aria-labelledby="last-heading"
                className={`rounded-[11px] border p-2.5 ${
                  draftMode === "last"
                    ? "border-primary/50 bg-primary-soft/60"
                    : "border-border bg-card"
                }`}
              >
                <h2 id="last-heading" className="text-sm font-semibold">
                  Last number of
                </h2>
                <div className="mt-2 grid grid-cols-[40px_1fr_40px_108px] items-center gap-2">
                  <button
                    type="button"
                    aria-label="Decrease period amount"
                    disabled={amount <= 1}
                    onClick={() => {
                      setAmount((current) => Math.max(1, current - 1));
                      setDraftMode("last");
                    }}
                    className="flex size-10 items-center justify-center rounded-[9px] bg-surface-subtle text-foreground hover:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Minus aria-hidden="true" className="size-4" />
                  </button>
                  <p
                    aria-live="polite"
                    className="text-center text-[17px] font-semibold tabular-nums"
                  >
                    {amount}
                  </p>
                  <button
                    type="button"
                    aria-label="Increase period amount"
                    disabled={amount >= 99}
                    onClick={() => {
                      setAmount((current) => Math.min(99, current + 1));
                      setDraftMode("last");
                    }}
                    className="flex size-10 items-center justify-center rounded-[9px] bg-surface-subtle text-foreground hover:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                  </button>
                  <select
                    aria-label="Period unit"
                    value={unit}
                    onChange={(event) => {
                      setUnit(event.target.value as PeriodUnit);
                      setDraftMode("last");
                    }}
                    className="h-10 min-w-0 rounded-[9px] border border-border bg-background px-2 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {UNITS.map((option) => (
                      <option key={option} value={option}>
                        {option[0].toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <CompactDivider />

              <section aria-labelledby="all-heading">
                <button
                  type="button"
                  aria-pressed={draftMode === "all"}
                  onClick={() => setDraftMode("all")}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-[10px] border px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                    draftMode === "all"
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-card text-foreground hover:bg-surface-subtle"
                  }`}
                >
                  <span className="flex size-8 items-center justify-center rounded-[8px] bg-surface-subtle text-primary">
                    <History aria-hidden="true" className="size-4" />
                  </span>
                  <span className="flex-1 text-sm font-semibold">All time</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    All data
                  </span>
                </button>
              </section>
            </div>

            {footer ? (
              <div className="shrink-0 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
                {footer(applyFilter, canApply)}
              </div>
            ) : null}

            {calendarOpen ? (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="calendar-drawer-title"
                className="fixed inset-0 z-[70] flex items-end bg-foreground/25"
              >
                <div className="drawer-enter flex max-h-[88dvh] w-full flex-col rounded-t-[24px] border-t border-border bg-background shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)]">
                  <div
                    className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-foreground/20"
                    aria-hidden="true"
                  />
                  <header className="flex shrink-0 items-center justify-between border-b border-border px-4 pb-3 pt-3">
                    <button
                      type="button"
                      aria-label="Back to period options"
                      onClick={() => setCalendarOpen(false)}
                      className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                    >
                      <X aria-hidden="true" className="size-5" />
                    </button>
                    <h2
                      id="calendar-drawer-title"
                      className="text-base font-semibold"
                    >
                      Choose date range
                    </h2>
                    <button
                      type="button"
                      onClick={() => setCalendarOpen(false)}
                      className="rounded-[10px] bg-primary-soft px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                    >
                      Done
                    </button>
                  </header>
                  <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                    <div className="w-full max-w-[420px] space-y-3">
                      <Calendar
                        mode="range"
                        month={calendarMonth}
                        onMonthChange={setCalendarMonth}
                        modifiers={{ today: CURRENT_DATE }}
                        selected={customRange}
                        onSelect={chooseCustomRange}
                        className="w-full rounded-[18px] border border-border bg-card p-4 shadow-[0_18px_50px_rgb(23_32_29_/_0.10)] [--cell-size:2.5rem] min-[420px]:[--cell-size:2.75rem]"
                      />
                      <p className="px-1 text-center text-xs text-muted-foreground">
                        Select a start date, then an end date.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
