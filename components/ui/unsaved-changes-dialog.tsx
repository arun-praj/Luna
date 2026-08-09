"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DiscardAction = () => void;

export function UnsavedChangesDialog({
  open,
  onKeepEditing,
  onDiscard,
}: {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/30 px-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onKeepEditing();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        aria-describedby="unsaved-changes-description"
        className="w-full max-w-[380px] rounded-[20px] border border-border bg-background p-5 shadow-[0_22px_70px_rgb(23_32_29_/_0.22)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex size-11 items-center justify-center rounded-[13px] bg-expense-soft text-expense">
          <span aria-hidden="true" className="text-xl font-semibold">!</span>
        </div>
        <h2 id="unsaved-changes-title" className="mt-4 text-lg font-semibold tracking-[-0.03em]">
          Unsaved changes
        </h2>
        <p id="unsaved-changes-description" className="mt-2 text-sm leading-6 text-muted-foreground">
          You have unsaved changes. Are you sure you want to cancel?
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onKeepEditing}
            className="min-h-11 rounded-[11px] border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="min-h-11 rounded-[11px] bg-expense px-3 text-sm font-semibold text-white transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-expense/30"
          >
            Discard changes
          </button>
        </div>
      </section>
    </div>
  );
}

export function useUnsavedChangesGuard(isDirty: boolean) {
  const [open, setOpen] = useState(false);
  const pendingAction = useRef<DiscardAction | null>(null);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const requestDiscard = useCallback((action: DiscardAction) => {
    if (!isDirty) {
      action();
      return;
    }
    pendingAction.current = action;
    setOpen(true);
  }, [isDirty]);

  const keepEditing = useCallback(() => {
    pendingAction.current = null;
    setOpen(false);
  }, []);

  const discard = useCallback(() => {
    const action = pendingAction.current;
    pendingAction.current = null;
    setOpen(false);
    action?.();
  }, []);

  return {
    requestDiscard,
    discardDialog: (
      <UnsavedChangesDialog
        open={open}
        onKeepEditing={keepEditing}
        onDiscard={discard}
      />
    ),
  };
}
