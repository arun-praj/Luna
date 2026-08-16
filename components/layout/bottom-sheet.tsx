"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",");

export function BottomSheet({
  open,
  onClose,
  title,
  labelledBy,
  children,
  className = "",
  backdropClassName = "",
  initialFocusRef,
  closeOnBackdrop = true,
  showHandle = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  labelledBy?: string;
  children: ReactNode;
  className?: string;
  backdropClassName?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeOnBackdrop?: boolean;
  showHandle?: boolean;
}) {
  const generatedTitleId = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const titleId = labelledBy ?? (title ? generatedTitleId : undefined);

  useEffect(() => {
    if (!open || !sheetRef.current) return;
    const sheet = sheetRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusFirst = () => {
      const preferred = initialFocusRef?.current;
      const first = preferred ?? sheet.querySelector<HTMLElement>("[autofocus]") ?? sheet.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? sheet).focus();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
      if (!focusable.length) {
        event.preventDefault();
        sheet.focus();
        return;
      }
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

    const keepFocusInside = (event: FocusEvent) => {
      if (!sheet.contains(event.target as Node)) focusFirst();
    };

    sheet.addEventListener("luna:bottom-sheet-dismiss", onClose as EventListener);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", keepFocusInside, true);
    window.requestAnimationFrame(focusFirst);

    return () => {
      sheet.removeEventListener("luna:bottom-sheet-dismiss", onClose as EventListener);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", keepFocusInside, true);
      if (previousFocus?.isConnected) window.requestAnimationFrame(() => previousFocus.focus());
    };
  }, [initialFocusRef, onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`luna-bottom-sheet-backdrop fixed inset-0 z-[90] flex items-end bg-foreground/25 backdrop-blur-[2px] ${backdropClassName}`}
      role="presentation"
      onPointerDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={titleId ? undefined : title}
        aria-labelledby={titleId}
        tabIndex={-1}
        data-luna-bottom-sheet="true"
        className={`luna-bottom-sheet drawer-enter w-full rounded-t-[24px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)] ${className}`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {showHandle ? <div data-luna-bottom-sheet-handle="true" className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-foreground/20" aria-hidden="true" /> : null}
        {title && !labelledBy ? <h2 id={generatedTitleId} className="sr-only">{title}</h2> : null}
        {children}
      </section>
    </div>,
    document.body,
  );
}
