"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, Delete, X } from "lucide-react";

type Operator = "+" | "−" | "×" | "÷";

function calculate(left: number, right: number, operator: Operator) {
  if (operator === "+") return left + right;
  if (operator === "−") return left - right;
  if (operator === "×") return left * right;
  return right === 0 ? left : left / right;
}

export function formatMoney(value: string) {
  const rawValue = value || "0";
  const decimalIndex = rawValue.indexOf(".");
  const amount = Number(rawValue);
  const integerPart = decimalIndex >= 0 ? rawValue.slice(0, decimalIndex) : rawValue;
  const fractionalPart = decimalIndex >= 0 ? rawValue.slice(decimalIndex + 1) : "";
  const formattedInteger = Number(integerPart || "0").toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });

  if (decimalIndex >= 0 && fractionalPart.length <= 2) {
    return `${formattedInteger}.${fractionalPart}`;
  }

  const formatted = amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
  return rawValue.endsWith(".") ? `${formatted}.` : formatted;
}

export function MoneyEditor({
  open,
  value,
  onCancel,
  onSet,
  title = "Edit amount",
  currency = "NPR",
  confirmPlacement = "top",
  confirmLabel = "Set",
  confirmDisabled = false,
  confirmValidation,
  liveValidation,
  validationAction,
  previousLabel = "Original",
  topContent,
  headerContent,
  instanceKey,
  cancelVariant = "icon",
  cancelLabel = "Cancel money edit",
  dismissOnBackdrop = true,
  closeOnEscape = true,
  skipCloseAnimation = false,
}: {
  open: boolean;
  value: string;
  onCancel: () => void;
  onSet: (value: string) => void;
  title?: string;
  currency?: string;
  confirmPlacement?: "top" | "bottom";
  confirmLabel?: string;
  confirmDisabled?: boolean | ((value: string) => boolean);
  confirmValidation?: (value: string) => string;
  liveValidation?: (value: string) => string;
  validationAction?: { label: string; onClick: () => void };
  previousLabel?: string;
  topContent?: React.ReactNode | ((draft: string) => React.ReactNode);
  headerContent?: React.ReactNode;
  instanceKey?: string;
  cancelVariant?: "icon" | "text";
  cancelLabel?: string;
  dismissOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  skipCloseAnimation?: boolean;
}) {
  const [isMounted, setIsMounted] = React.useState(open);
  const [isClosing, setIsClosing] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      const frame = window.requestAnimationFrame(() => {
        setIsMounted(true);
        setIsClosing(false);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    if (!isMounted) return;
    if (skipCloseAnimation) {
      const frame = window.requestAnimationFrame(() => {
        setIsMounted(false);
        setIsClosing(false);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const frame = window.requestAnimationFrame(() => setIsClosing(true));
    const timer = window.setTimeout(() => {
      setIsMounted(false);
      setIsClosing(false);
    }, 320);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [isMounted, open, skipCloseAnimation]);

  if (!isMounted || typeof document === "undefined") return null;

  return (
    <MoneyEditorPanel
      key={`${instanceKey ?? "money"}:${value}`}
      value={value}
      onCancel={onCancel}
      onSet={onSet}
      title={title}
      currency={currency}
      confirmPlacement={confirmPlacement}
      confirmLabel={confirmLabel}
      confirmDisabled={confirmDisabled}
      confirmValidation={confirmValidation}
      liveValidation={liveValidation}
      validationAction={validationAction}
      previousLabel={previousLabel}
      topContent={topContent}
      headerContent={headerContent}
      cancelVariant={cancelVariant}
      cancelLabel={cancelLabel}
      dismissOnBackdrop={dismissOnBackdrop}
      closeOnEscape={closeOnEscape}
      isClosing={isClosing}
    />
  );
}

function MoneyEditorPanel({
  value,
  onCancel,
  onSet,
  title,
  currency,
  confirmPlacement,
  confirmLabel,
  confirmDisabled,
  confirmValidation,
  liveValidation,
  validationAction,
  previousLabel,
  topContent,
  headerContent,
  cancelVariant,
  cancelLabel,
  dismissOnBackdrop,
  closeOnEscape,
  isClosing,
}: {
  value: string;
  onCancel: () => void;
  onSet: (value: string) => void;
  title: string;
  currency: string;
  confirmPlacement: "top" | "bottom";
  confirmLabel: string;
  confirmDisabled: boolean | ((value: string) => boolean);
  confirmValidation?: (value: string) => string;
  liveValidation?: (value: string) => string;
  validationAction?: { label: string; onClick: () => void };
  previousLabel: string;
  topContent?: React.ReactNode | ((draft: string) => React.ReactNode);
  headerContent?: React.ReactNode;
  cancelVariant: "icon" | "text";
  cancelLabel: string;
  dismissOnBackdrop: boolean;
  closeOnEscape: boolean;
  isClosing: boolean;
}) {
  const [draft, setDraft] = React.useState(value || "0");
  const [operator, setOperator] = React.useState<Operator | null>(null);
  const [leftValue, setLeftValue] = React.useState<number | null>(null);
  const [freshEntry, setFreshEntry] = React.useState(true);
  const [validationMessage, setValidationMessage] = React.useState("");
  const isConfirmDisabled = typeof confirmDisabled === "function" ? confirmDisabled(draft) : confirmDisabled;
  const liveValidationMessage = liveValidation?.(draft) ?? "";

  const confirm = () => {
    const message = confirmValidation?.(draft) ?? "";
    if (message) {
      setValidationMessage(message);
      return;
    }
    onSet(draft || "0");
  };

  const inputDigit = React.useCallback((digit: string) => {
    setValidationMessage("");
    setDraft((current) => {
      if (freshEntry) {
        setFreshEntry(false);
        return digit === "." ? "0." : digit;
      }
      if (digit === "." && current.includes(".")) return current;
      if (current === "0" && digit !== ".") return digit;
      if (current.replace(".", "").length >= 10) return current;
      return `${current}${digit}`;
    });
  }, [freshEntry]);

  const chooseOperator = React.useCallback((nextOperator: Operator) => {
    setValidationMessage("");
    const current = Number(draft || "0");
    if (leftValue !== null && operator && !freshEntry) {
      const result = calculate(leftValue, current, operator);
      setLeftValue(result);
      setDraft(String(Math.round(result * 100) / 100));
    } else {
      setLeftValue(current);
    }
    setOperator(nextOperator);
    setFreshEntry(true);
  }, [draft, freshEntry, leftValue, operator]);

  const equals = React.useCallback(() => {
    if (leftValue === null || !operator) return;
    setValidationMessage("");
    const result = calculate(leftValue, Number(draft || "0"), operator);
    setDraft(String(Math.round(result * 100) / 100));
    setLeftValue(null);
    setOperator(null);
    setFreshEntry(true);
  }, [draft, leftValue, operator]);

  const deleteLastDigit = React.useCallback(() => {
    setValidationMessage("");
    if (freshEntry) {
      setFreshEntry(false);
      setDraft("0");
      return;
    }
    setDraft((current) => (current.length > 1 ? current.slice(0, -1) : "0"));
  }, [freshEntry]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (/^\d$/.test(event.key) || event.key === ".") {
        event.preventDefault();
        inputDigit(event.key);
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        deleteLastDigit();
        return;
      }

      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        onCancel();
        return;
      }

      const operators: Record<string, Operator> = {
        "/": "÷",
        "*": "×",
        "-": "−",
        "+": "+",
      };
      const nextOperator = operators[event.key];
      if (nextOperator) {
        event.preventDefault();
        chooseOperator(nextOperator);
        return;
      }

      if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        equals();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chooseOperator, closeOnEscape, deleteLastDigit, equals, inputDigit, onCancel]);

  return createPortal((
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="money-editor-title"
      className={`fixed inset-0 z-[70] flex items-end bg-foreground/25 backdrop-blur-[2px] ${isClosing ? "drawer-scrim-exit" : "drawer-scrim-enter"}`}
      onClick={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) onCancel();
      }}
    >
      <div className={`w-full rounded-t-[18px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgb(23_32_29_/_0.14)] ${isClosing ? "drawer-exit" : "drawer-enter"}`}>
        <div className="mx-auto w-full max-w-[480px]">
          {headerContent ? <div className="mb-3">{headerContent}</div> : null}
          <div
            className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center"
          >
            <button
              type="button"
              aria-label={cancelLabel}
              onClick={onCancel}
              className={cancelVariant === "text" ? "justify-self-start flex h-11 items-center rounded-[10px] px-2 text-sm font-semibold text-expense hover:bg-expense-soft" : "justify-self-start flex size-11 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground hover:bg-surface-subtle"}
            >
              {cancelVariant === "text" ? cancelLabel : <X aria-hidden="true" className="size-5" />}
            </button>
            <div className="min-w-0 px-2 text-center">
              <p id="money-editor-title" className="text-xs font-semibold text-muted-foreground">
                {title}
              </p>
              <p className="mt-0.5 truncate text-[27px] font-semibold tracking-[-0.035em] tabular-nums">
                {formatMoney(draft)}
                <span className="ml-2 text-sm text-muted-foreground">{currency}</span>
              </p>
              {draft !== value || leftValue !== null ? (
                <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
                  {previousLabel}{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatMoney(value)} {currency}
                  </span>
                </p>
              ) : null}
              {leftValue !== null && operator ? (
                <p className="text-[11px] font-semibold text-primary">
                  {formatMoney(String(leftValue))} {operator}
                </p>
              ) : null}
            </div>
            {confirmPlacement === "top" ? (
              <button
                type="button"
                aria-label="Set money amount"
                disabled={isConfirmDisabled}
                onClick={confirm}
                className="justify-self-end flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-primary/20 bg-primary-soft px-3 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Check aria-hidden="true" className="size-4 shrink-0" />
                {confirmLabel}
              </button>
            ) : <span aria-hidden="true" />}
          </div>

          {topContent ? (
            <div className="mt-3">
              {typeof topContent === "function" ? topContent(draft) : topContent}
            </div>
          ) : null}

          {validationMessage ? (
            <div role="alert" className="mt-3 rounded-[11px] border border-expense/25 bg-expense-soft px-3 py-2.5 text-xs font-semibold leading-5 text-expense">
              <p>{validationMessage}</p>
              {validationAction ? (
                <button type="button" onClick={validationAction.onClick} className="mt-1 inline-flex rounded-[6px] bg-card/70 px-2 py-1 font-semibold text-primary underline decoration-primary/45 underline-offset-2 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
                  {validationAction.label}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-[1fr_64px] gap-2">
            <div className="grid grid-cols-3 gap-2">
              {["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0"].map(
                (key) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => inputDigit(key)}
                    className="flex h-12 items-center justify-center rounded-[11px] bg-card text-xl font-semibold shadow-[inset_0_0_0_1px_var(--border)] active:bg-primary-soft"
                  >
                    {key}
                  </button>
                ),
              )}
              <button
                type="button"
                aria-label="Delete last digit"
                onClick={deleteLastDigit}
                className="flex h-12 items-center justify-center rounded-[11px] bg-expense-soft text-expense shadow-[inset_0_0_0_1px_var(--border)] hover:bg-expense/10 active:bg-expense-soft"
              >
                <Delete aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="grid grid-rows-5 gap-2" aria-label="Calculator">
              {(["÷", "×", "−", "+"] as Operator[]).map((key) => (
                <button
                  type="button"
                  key={key}
                  aria-label={`${key} operator`}
                  aria-pressed={operator === key}
                  onClick={() => chooseOperator(key)}
                  className={`flex h-10 items-center justify-center rounded-[10px] text-lg font-semibold ${
                    operator === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary-soft text-primary"
                  }`}
                >
                  {key}
                </button>
              ))}
              <button
                type="button"
                aria-label="Calculate result"
                onClick={equals}
                className="flex h-10 items-center justify-center rounded-[10px] bg-primary text-lg font-semibold text-primary-foreground"
              >
                =
              </button>
            </div>
          </div>

          {confirmPlacement === "bottom" ? (
            <div className="mt-4 border-t border-border pt-3">
              {liveValidationMessage ? (
                <div role="alert" className="mb-3 rounded-[11px] border border-expense/25 bg-expense-soft px-3 py-2.5 text-xs font-semibold leading-5 text-expense">
                  {liveValidationMessage}
                </div>
              ) : null}
              <button
                type="button"
                aria-label={confirmLabel}
                disabled={isConfirmDisabled}
                onClick={confirm}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_rgb(53_107_104_/_0.15)] transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Check aria-hidden="true" className="size-4" />
                {confirmLabel}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  ), document.body);
}
