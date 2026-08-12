"use client";

import * as React from "react";
import { format, isSameDay, isSameMonth, sub } from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
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
const MONTH_OPTIONS = Array.from({ length: 18 }, (_, index) => ({
  month: index % 12,
  year: CURRENT_DATE.getFullYear() + Math.floor(index / 12),
}));
const UNITS = ["days", "weeks", "months", "years"] as const;

type PeriodUnit = (typeof UNITS)[number];
type MonthOption = (typeof MONTH_OPTIONS)[number];
export type FilterMode = "day" | "month" | "custom" | "last" | "all";

type QuickPeriod = {
  label: string;
  mode: FilterMode;
  from?: Date;
  to?: Date;
  amount?: number;
  unit?: PeriodUnit;
};

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
  if (amount === 1 && unit === "months") return "Last month";
  const singularUnit = unit.slice(0, -1);
  return `Last ${amount} ${amount === 1 ? singularUnit : unit}`;
}

const QUICK_PERIODS: QuickPeriod[] = [
  { label: "Last month", mode: "last", amount: 1, unit: "months" },
  { label: "Last 3 months", mode: "last", amount: 3, unit: "months" },
  { label: "This year", mode: "custom", from: new Date(CURRENT_DATE.getFullYear(), 0, 1), to: CURRENT_DATE },
  { label: "Last year", mode: "custom", from: new Date(CURRENT_DATE.getFullYear() - 1, 0, 1), to: new Date(CURRENT_DATE.getFullYear() - 1, 11, 31) },
  { label: "All time", mode: "all" },
];

function CompactDivider() {
  return <div aria-hidden="true" className="h-px bg-border" />;
}

export function DatePicker({
  initialMode = "day",
  initialLabel,
  initialCustomRange,
  initialQuickPeriodLabel,
  triggerLabel,
  triggerAriaLabel,
  triggerIcon,
  iconOnly = false,
  hideApplyButton = false,
  onApply,
  footer,
}: {
  initialMode?: FilterMode;
  initialLabel?: string;
  initialCustomRange?: DateRange;
  initialQuickPeriodLabel?: string | null;
  triggerLabel?: string;
  triggerAriaLabel?: string;
  triggerIcon?: LucideIcon;
  iconOnly?: boolean;
  hideApplyButton?: boolean;
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
  const [selectedMonth, setSelectedMonth] = React.useState<MonthOption>({
    month: CURRENT_DATE.getMonth(),
    year: CURRENT_DATE.getFullYear(),
  });
  const [customRange, setCustomRange] = React.useState<DateRange>({
    from: initialCustomRange?.from,
    to: initialCustomRange?.to,
  });
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [calendarMonth, setCalendarMonth] = React.useState(CURRENT_DATE);
  const monthScrollerRef = React.useRef<HTMLDivElement>(null);
  const [amount, setAmount] = React.useState(4);
  const [unit, setUnit] = React.useState<PeriodUnit>("weeks");
  const [quickPeriodLabel, setQuickPeriodLabel] = React.useState<string | null>(initialQuickPeriodLabel ?? null);
  const TriggerIcon = triggerIcon ?? CalendarDays;

  const setOpenState = (nextOpen: boolean) => {
    if (nextOpen) setDraftMode(committedMode);
    if (!nextOpen) setCalendarOpen(false);
    setOpen(nextOpen);
  };

  React.useEffect(() => {
    if (!open) return;
    let scrollerForCleanup: HTMLDivElement | null = null;

    const alignCurrentMonth = () => {
      const scroller = monthScrollerRef.current;
      if (!scroller) return;
      scrollerForCleanup = scroller;
      const currentMonthButton = scroller.querySelector<HTMLButtonElement>(
        "[data-current-month='true']",
      );
      if (!currentMonthButton) return;
      const scrollerLeft = scroller.getBoundingClientRect().left;
      const buttonLeft = currentMonthButton.getBoundingClientRect().left;
      const currentOffset =
        buttonLeft - scrollerLeft + scroller.scrollLeft;
      const desiredScrollLeft = Math.max(0, currentOffset - 16);
      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
      const extraScrollSpace = Math.max(
        0,
        desiredScrollLeft - maxScrollLeft,
      );

      if (extraScrollSpace > 0) {
        const paddingRight = Number.parseFloat(
          window.getComputedStyle(scroller).paddingRight,
        );
        scroller.style.paddingRight = `${paddingRight + extraScrollSpace}px`;
      }

      scroller.scrollLeft = desiredScrollLeft;
    };

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      alignCurrentMonth();
      secondFrame = requestAnimationFrame(alignCurrentMonth);
    });
    const delayedAlignment = window.setTimeout(alignCurrentMonth, 150);

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      window.clearTimeout(delayedAlignment);
      scrollerForCleanup?.style.removeProperty("padding-right");
    };
  }, [open]);

  const canApply =
    draftMode !== "day" &&
    (draftMode !== "custom" || Boolean(customRange.from && customRange.to));

  const applyFilter = (overrides: {
    mode?: FilterMode;
    selectedMonth?: MonthOption;
    customRange?: DateRange;
    amount?: number;
    unit?: PeriodUnit;
    quickPeriodLabel?: string | null;
  } = {}) => {
    const nextMode = overrides.mode ?? draftMode;
    const nextSelectedMonth = overrides.selectedMonth ?? selectedMonth;
    const nextCustomRange = overrides.customRange ?? customRange;
    const nextAmount = overrides.amount ?? amount;
    const nextUnit = overrides.unit ?? unit;
    const nextQuickPeriodLabel = Object.hasOwn(overrides, "quickPeriodLabel")
      ? overrides.quickPeriodLabel
      : quickPeriodLabel;
    const nextCanApply =
      nextMode !== "day" &&
      (nextMode !== "custom" || Boolean(nextCustomRange.from && nextCustomRange.to));

    if (!nextCanApply) return;

    let nextLabel = periodLabel;
    let from: Date | undefined;
    let to: Date | undefined;
    if (nextMode === "month") {
      nextLabel = `${MONTHS[nextSelectedMonth.month]} ${nextSelectedMonth.year}`;
      from = new Date(nextSelectedMonth.year, nextSelectedMonth.month, 1);
      to = new Date(nextSelectedMonth.year, nextSelectedMonth.month + 1, 0);
    } else if (nextMode === "custom" && nextCustomRange.from && nextCustomRange.to) {
      nextLabel = nextQuickPeriodLabel ?? formatRange(nextCustomRange);
      from = nextCustomRange.from;
      to = nextCustomRange.to;
    } else if (nextMode === "last") {
      nextLabel = formatLastPeriod(nextAmount, nextUnit);
      from = sub(CURRENT_DATE, { [nextUnit]: nextAmount });
      to = CURRENT_DATE;
    } else if (nextMode === "all") {
      nextLabel = "All time";
    } else {
      from = CURRENT_DATE;
      to = CURRENT_DATE;
    }

    setPeriodLabel(nextLabel);
    setCommittedMode(nextMode);
    onApply?.({ mode: nextMode, label: nextLabel, from, to });
    setCalendarOpen(false);
    setOpen(false);
  };

  const chooseCustomRange = (range: DateRange | undefined) => {
    if (!range) return;
    setCustomRange(range);
    setQuickPeriodLabel(null);
    setDraftMode("custom");
    if (range.from) setCalendarMonth(range.from);
    if (!hideApplyButton && range.from && range.to) {
      applyFilter({ mode: "custom", customRange: range, quickPeriodLabel: null });
    }
  };

  const chooseQuickPeriod = (period: QuickPeriod) => {
    setDraftMode(period.mode);
    setQuickPeriodLabel(period.label);
    const nextCustomRange = { from: period.from, to: period.to };
    if (period.from || period.to) setCustomRange(nextCustomRange);
    if (period.amount && period.unit) {
      setAmount(period.amount);
      setUnit(period.unit);
    }
    if (!hideApplyButton) {
      applyFilter({
        mode: period.mode,
        customRange: nextCustomRange,
        amount: period.amount,
        unit: period.unit,
        quickPeriodLabel: period.label,
      });
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpenState}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={triggerAriaLabel ?? `Choose reporting period, currently ${periodLabel}`}
          title={iconOnly ? triggerLabel : undefined}
          onClick={() => setOpenState(true)}
          className={`flex min-h-11 shrink-0 items-center rounded-[10px] border border-border bg-card text-sm font-semibold text-foreground shadow-[0_1px_2px_rgb(23_32_29_/_0.03)] transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${iconOnly ? "size-11 justify-center px-0" : "gap-2 px-3.5"}`}
        >
          <TriggerIcon
            aria-hidden="true"
            className="size-[18px] text-primary"
          />
          <span className={iconOnly ? "sr-only" : "max-w-24 truncate"}>{triggerLabel ?? periodLabel}</span>
          {iconOnly ? null : (
            <ChevronRight
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
          )}
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

              {hideApplyButton ? null : (
                <button
                  type="button"
                  aria-label="Apply period filter"
                  disabled={!canApply}
                  onClick={() => applyFilter()}
                  className="flex size-11 items-center justify-center justify-self-end rounded-[11px] border border-primary/20 bg-primary-soft text-primary transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:border-border disabled:bg-surface-subtle disabled:text-foreground-subtle"
                >
                  <Check aria-hidden="true" className="size-5" />
                </button>
              )}
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
              <section aria-labelledby="month-heading">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id="month-heading" className="text-sm font-semibold">
                    Choose a month
                  </h2>
                  <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {CURRENT_DATE.getFullYear()}–{CURRENT_DATE.getFullYear() + 1}
                  </span>
                </div>
                <div ref={monthScrollerRef} className="-mx-4 mt-2 flex snap-x gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-5 sm:px-5">
                  {MONTH_OPTIONS.map(({ month: monthIndex, year }) => {
                    const month = MONTHS[monthIndex];
                    const selected = selectedMonth.month === monthIndex && selectedMonth.year === year;
                    const current = monthIndex === CURRENT_DATE.getMonth() && year === CURRENT_DATE.getFullYear();

                    return (
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${month} ${year}${current ? " (current month)" : ""}${selected ? " (selected)" : ""}`}
                        className={`relative flex min-h-14 min-w-[72px] snap-start flex-col items-center justify-center rounded-[9px] border px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                          selected
                            ? "border-primary bg-primary-soft text-primary"
                            : current
                              ? "border-border bg-card text-primary"
                            : "border-border bg-card text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
                        }`}
                        key={`${year}-${monthIndex}`}
                        data-current-month={current ? "true" : undefined}
                        onClick={() => {
                          const nextSelectedMonth = { month: monthIndex, year };
                          setSelectedMonth(nextSelectedMonth);
                          setQuickPeriodLabel(null);
                          setDraftMode("month");
                          if (!hideApplyButton) {
                            applyFilter({
                              mode: "month",
                              selectedMonth: nextSelectedMonth,
                              quickPeriodLabel: null,
                            });
                          }
                        }}
                      >
                        <span className="inline-flex items-center gap-1 text-sm font-semibold">
                          {month}
                          {current ? <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" /> : null}
                        </span>
                        <span className="text-[10px] font-medium tabular-nums text-muted-foreground">{year}</span>
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
                    setQuickPeriodLabel(null);
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
                <div className="mt-2 grid grid-cols-[40px_1fr_40px_116px] items-center gap-2">
                  <button
                    type="button"
                    aria-label="Decrease period amount"
                    disabled={amount <= 1}
                    onClick={() => {
                      setAmount((current) => Math.max(1, current - 1));
                      setQuickPeriodLabel(null);
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
                      setQuickPeriodLabel(null);
                      setDraftMode("last");
                    }}
                    className="flex size-10 items-center justify-center rounded-[9px] bg-surface-subtle text-foreground hover:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                  </button>
                  <div className="relative min-w-0">
                    <select
                      aria-label="Period unit"
                      value={unit}
                      onChange={(event) => {
                        setUnit(event.target.value as PeriodUnit);
                        setQuickPeriodLabel(null);
                        setDraftMode("last");
                      }}
                      className="h-10 w-full appearance-none rounded-[10px] border border-border bg-card px-3 pr-8 text-sm font-semibold text-foreground shadow-[0_1px_2px_rgb(23_32_29_/_0.03)] outline-none transition-colors hover:bg-surface-subtle focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {UNITS.map((option) => (
                        <option key={option} value={option}>
                          {option[0].toUpperCase() + option.slice(1)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </section>

              <CompactDivider />

              <section aria-labelledby="quick-periods-heading">
                <h2 id="quick-periods-heading" className="text-sm font-semibold">Quick ranges</h2>
                <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-5 sm:px-5">
                  {QUICK_PERIODS.map((period) => (
                    <button
                      key={period.label}
                      type="button"
                      aria-pressed={(quickPeriodLabel ?? periodLabel) === period.label && draftMode === period.mode}
                      onClick={() => chooseQuickPeriod(period)}
                      className={`min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${(quickPeriodLabel ?? periodLabel) === period.label && draftMode === period.mode ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-foreground hover:bg-surface-subtle"}`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
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
