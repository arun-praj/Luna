"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  ChevronRight,
  Minus,
  Plus,
  X,
} from "lucide-react";

const quickActions = [
  {
    type: "expense",
    label: "Expense",
    description: "Money you spent",
    icon: Minus,
    className: "bg-expense-soft text-expense",
  },
  {
    type: "income",
    label: "Income",
    description: "Money you received",
    icon: Plus,
    className: "bg-income-soft text-income",
  },
  {
    type: "transfer",
    label: "Transfer",
    description: "Move money between accounts",
    icon: ArrowLeftRight,
    className: "bg-info-soft text-info",
  },
] as const;

export function AddTransactionButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  const closeTimer = React.useRef<number | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const closeMenu = React.useCallback((after?: () => void) => {
    if (!open || closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      closeTimer.current = null;
      after?.();
      window.requestAnimationFrame(() => previouslyFocusedElement.current?.focus());
    }, 320);
  }, [closing, open]);

  React.useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  React.useEffect(() => {
    if (!open || closing) return;
    closeButtonRef.current?.focus();
  }, [closing, open]);

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      ) ?? [],
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const menuVisible = open || closing;

  if (!isMounted) return null;

  return createPortal((
    <>
      {menuVisible ? (
        <div
          aria-hidden="true"
          onClick={() => closeMenu()}
          className={`fixed inset-0 z-40 cursor-default bg-foreground/20 ${closing ? "drawer-scrim-exit" : "drawer-scrim-enter"}`}
        />
      ) : null}

      {menuVisible ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-transaction-title"
          onKeyDown={handleDialogKeyDown}
          className={`fixed bottom-0 left-1/2 z-50 w-full max-w-[720px] -translate-x-1/2 rounded-t-[22px] border border-b-0 border-border bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_32px_rgb(23_32_29_/_0.12)] sm:px-5 ${closing ? "drawer-exit" : "drawer-enter"}`}
        >
          <div aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-border-strong/70" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <h2 id="add-transaction-title" className="text-lg font-semibold tracking-[-0.03em]">Add transaction</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Choose what you want to record.</p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close add transaction menu"
              onClick={() => closeMenu()}
              className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-background text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.type}
                  type="button"
                  aria-label={`Add ${action.label.toLowerCase()}`}
                  onClick={() => closeMenu(() => router.push(`/transactions/new?type=${action.type}`))}
                  className="flex min-h-14 w-full items-center gap-3 rounded-[14px] border border-border bg-background px-3 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                >
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-[11px] ${action.className}`}>
                    <Icon aria-hidden="true" className="size-[18px]" strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">{action.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{action.description}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 size-14 sm:right-[max(1.25rem,calc((100vw-720px)/2+1.25rem))]">
        <button
          ref={triggerRef}
          type="button"
          aria-label="Add transaction"
          aria-expanded={open}
          aria-hidden={open}
          tabIndex={open ? -1 : 0}
          onClick={() => {
            if (open) {
              closeMenu();
              return;
            }

            if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
            previouslyFocusedElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : triggerRef.current;
            setClosing(false);
            setOpen(true);
          }}
          className={`relative z-10 flex size-14 items-center justify-center rounded-[16px] border border-primary-hover/20 bg-primary text-primary-foreground shadow-[0_10px_28px_rgb(53_107_104_/_0.28)] transition-[background-color,transform,box-shadow,opacity] hover:bg-primary-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${open ? "pointer-events-none opacity-0" : ""}`}
          data-open={open}
          data-tour="add-transaction"
        >
          <Plus aria-hidden="true" className="size-6" strokeWidth={2.25} />
        </button>
      </div>
    </>
  ), document.body);
}
