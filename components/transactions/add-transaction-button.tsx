"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Minus,
  Plus,
  X,
} from "lucide-react";

const quickActions = [
  {
    type: "expense",
    label: "Expense",
    icon: Minus,
    position: "-translate-y-[148px]",
    className: "border-white/25 bg-expense text-white",
  },
  {
    type: "income",
    label: "Income",
    icon: Plus,
    position: "-translate-x-[105px] -translate-y-[112px]",
    className: "border-white/25 bg-income text-white",
  },
  {
    type: "transfer",
    label: "Transfer",
    icon: ArrowLeftRight,
    position: "-translate-x-[158px] -translate-y-[48px]",
    className: "border-white/25 bg-info text-white",
  },
] as const;

export function AddTransactionButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close add transaction menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 cursor-default bg-foreground/35 backdrop-blur-[5px] animate-in fade-in-0"
        />
      ) : null}

      <div
        className={`fixed z-50 size-14 transition-all duration-300 ease-out ${
          open
            ? "bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 sm:right-[max(1.25rem,calc((100vw-720px)/2+1.25rem))]"
            : "bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 sm:right-[max(1.25rem,calc((100vw-720px)/2+1.25rem))]"
        }`}
      >
        {open ? (
          <>
            {quickActions.map((action, index) => {
              const Icon = action.icon;

              return (
                <div
                  key={action.type}
                  className={`absolute inset-0 ${action.position} animate-in fade-in-0 zoom-in-75`}
                  style={{ animationDelay: `${index * 35}ms` }}
                >
                  <button
                    type="button"
                    aria-label={`Add ${action.label.toLowerCase()}`}
                    onClick={() => {
                      setOpen(false);
                      router.push(`/transactions/new?type=${action.type}`);
                    }}
                    className={`relative flex size-14 items-center justify-center rounded-full border shadow-[0_10px_28px_rgb(23_32_29_/_0.24)] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${action.className}`}
                  >
                    <Icon aria-hidden="true" className="size-[18px]" strokeWidth={2.3} />
                    <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.45rem)] -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-card/95 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm">
                      {action.label}
                    </span>
                  </button>
                </div>
              );
            })}
          </>
        ) : null}

        <button
          type="button"
          aria-label={open ? "Close add transaction menu" : "Add transaction"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="relative z-10 flex size-14 items-center justify-center rounded-[16px] border border-primary-hover/20 bg-primary text-primary-foreground shadow-[0_10px_28px_rgb(53_107_104_/_0.28)] transition-[background-color,transform,box-shadow,border-radius] hover:bg-primary-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[open=true]:rounded-full"
          data-open={open}
        >
          {open ? (
            <X aria-hidden="true" className="size-6" strokeWidth={2.25} />
          ) : (
            <Plus aria-hidden="true" className="size-6" strokeWidth={2.25} />
          )}
        </button>
      </div>
    </>
  );
}
