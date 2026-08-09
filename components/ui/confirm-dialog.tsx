"use client";

import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  cancelLabel?: string;
  confirmLabel: string;
  secondaryLabel?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  onSecondary?: () => void | Promise<void>;
  destructive?: boolean;
  busy?: boolean;
};

/** A Luna-styled replacement for browser confirm dialogs. */
export function ConfirmDialog({
  open,
  title,
  description,
  cancelLabel = "Cancel",
  confirmLabel,
  secondaryLabel,
  onCancel,
  onConfirm,
  onSecondary,
  destructive = false,
  busy = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel, open]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/30 px-4 backdrop-blur-[2px]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-[440px] rounded-[20px] border border-border bg-background p-5 shadow-[0_22px_70px_rgb(23_32_29_/_0.22)]"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-[13px] ${destructive ? "bg-expense-soft text-expense" : "bg-primary-soft text-primary"}`}>
            <AlertTriangle aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-lg font-semibold tracking-[-0.03em]">
              {title}
            </h2>
            <p id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          <button
            type="button"
            aria-label={cancelLabel}
            onClick={onCancel}
            disabled={busy}
            className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className={`mt-5 grid gap-2 ${secondaryLabel ? "grid-cols-2" : "grid-cols-2"}`}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-11 rounded-[11px] border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          {secondaryLabel ? (
            <button
              type="button"
              onClick={() => void onSecondary?.()}
              disabled={busy}
              className="min-h-11 rounded-[11px] border border-primary/25 bg-primary-soft px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
            >
              {secondaryLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy}
            className={`${secondaryLabel ? "col-span-2" : ""} min-h-11 rounded-[11px] px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 ${destructive ? "bg-expense text-white hover:brightness-95 focus-visible:ring-expense/30" : "bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-primary/30"}`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
