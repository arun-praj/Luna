"use client";

import * as React from "react";
import { format, isBefore, isSameDay, isSameMonth } from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  History,
  Minus,
  Plus,
  X,
} from "lucide-react";
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

type DateField = "from" | "to";
type PeriodUnit = (typeof UNITS)[number];
type FilterMode = "day" | "month" | "custom" | "last" | "all";

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

export function DatePicker() {
  const [open, setOpen] = React.useState(false);
  const [periodLabel, setPeriodLabel] = React.useState(
    format(CURRENT_DATE, "MMM d")
  );
  const [committedMode, setCommittedMode] =
    React.useState<FilterMode>("day");
  const [draftMode, setDraftMode] = React.useState<FilterMode>("day");
  const [selectedMonth, setSelectedMonth] = React.useState(
    CURRENT_DATE.getMonth()
  );
  const [customRange, setCustomRange] = React.useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [activeField, setActiveField] = React.useState<DateField | null>(null);
  const [calendarMonth, setCalendarMonth] = React.useState(CURRENT_DATE);
  const [amount, setAmount] = React.useState(4);
  const [unit, setUnit] = React.useState<PeriodUnit>("weeks");

  const setOpenState = (nextOpen: boolean) => {
    if (nextOpen) setDraftMode(committedMode);
    if (!nextOpen) setActiveField(null);
    setOpen(nextOpen);
  };

  const chooseCustomDate = (date: Date | undefined) => {
    if (!date || !activeField) return;

    if (activeField === "from") {
      setCustomRange((current) => ({
        from: date,
        to:
          current.to && !isBefore(current.to, date) ? current.to : undefined,
      }));
      setCalendarMonth(date);
      setActiveField("to");
      return;
    }

    setCustomRange((current) => {
      if (current.from && isBefore(date, current.from)) {
        return { from: date, to: current.from };
      }
      return { from: current.from ?? date, to: date };
    });
    setCalendarMonth(date);
    setActiveField(null);
  };

  const canApply =
    draftMode !== "day" &&
    (draftMode !== "custom" || Boolean(customRange.from && customRange.to));

  const applyFilter = () => {
    if (!canApply) return;

    if (draftMode === "month") {
      setPeriodLabel(`${MONTHS[selectedMonth]} ${CURRENT_DATE.getFullYear()}`);
    } else if (
      draftMode === "custom" &&
      customRange.from &&
      customRange.to
    ) {
      setPeriodLabel(formatRange(customRange));
    } else if (draftMode === "last") {
      setPeriodLabel(formatLastPeriod(amount, unit));
    } else if (draftMode === "all") {
      setPeriodLabel("All time");
    }

    setCommittedMode(draftMode);
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpenState}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={`Choose reporting period, currently ${periodLabel}`}
          onClick={() => setOpenState(true)}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-[10px] border border-border bg-card px-3.5 text-sm font-semibold text-foreground shadow-[0_1px_2px_rgb(23_32_29_/_0.03)] transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          <CalendarDays
            aria-hidden="true"
            className="size-[18px] text-primary"
          />
          <span className="max-w-24 truncate">{periodLabel}</span>
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

                    return (
                      <button
                        type="button"
                        aria-pressed={selected}
                        className={`min-h-10 min-w-[64px] snap-start rounded-[9px] border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                          selected
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-border bg-card text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
                        }`}
                        key={month}
                        onClick={() => {
                          setSelectedMonth(index);
                          setDraftMode("month");
                        }}
                      >
                        {month}
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
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["from", "to"] as const).map((field) => {
                    const date = customRange[field];

                    return (
                      <button
                        type="button"
                        className={`min-h-[56px] rounded-[10px] border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                          draftMode === "custom"
                            ? "border-primary/50 bg-primary-soft/60"
                            : "border-border bg-card hover:bg-surface-subtle"
                        }`}
                        key={field}
                        onClick={() => {
                          setDraftMode("custom");
                          setActiveField(field);
                          setCalendarMonth(date ?? CURRENT_DATE);
                        }}
                      >
                        <span className="block text-[11px] font-medium capitalize text-muted-foreground">
                          {field}
                        </span>
                        <span
                          className={`mt-0.5 block truncate text-sm font-semibold ${
                            date ? "text-foreground" : "text-primary"
                          }`}
                        >
                          {date ? format(date, "MMM d, yyyy") : "Add date"}
                        </span>
                      </button>
                    );
                  })}
                </div>
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

            {activeField ? (
              <div className="fixed inset-0 z-[70] flex h-dvh flex-col overflow-hidden bg-background">
                <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-border px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                  <button
                    type="button"
                    aria-label="Back to period options"
                    onClick={() => setActiveField(null)}
                    className="flex size-10 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-surface-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                  >
                    <ArrowLeft aria-hidden="true" className="size-5" />
                  </button>
                  <h2 className="text-[18px] font-semibold tracking-[-0.025em]">
                    {activeField === "from" ? "From date" : "To date"}
                  </h2>
                  <span />
                </header>
                <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <div className="w-full max-w-[360px] rounded-[14px] border border-border bg-card p-3">
                    <Calendar
                      mode="single"
                      month={calendarMonth}
                      onMonthChange={setCalendarMonth}
                      modifiers={{ today: CURRENT_DATE }}
                      selected={customRange[activeField]}
                      onSelect={chooseCustomDate}
                      className="mx-auto bg-transparent p-0 [--cell-size:2.25rem] min-[360px]:[--cell-size:2.5rem] min-[420px]:[--cell-size:2.75rem]"
                    />
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
