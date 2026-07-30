"use client";

import * as React from "react";
import { Check, Delete, X } from "lucide-react";

type Operator = "+" | "−" | "×" | "÷";

function calculate(left: number, right: number, operator: Operator) {
  if (operator === "+") return left + right;
  if (operator === "−") return left - right;
  if (operator === "×") return left * right;
  return right === 0 ? left : left / right;
}

export function formatMoney(value: string) {
  return Number(value || "0").toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function MoneyEditor({
  open,
  value,
  onCancel,
  onSet,
  title = "Edit amount",
  currency = "NPR",
}: {
  open: boolean;
  value: string;
  onCancel: () => void;
  onSet: (value: string) => void;
  title?: string;
  currency?: string;
}) {
  if (!open) return null;

  return (
    <MoneyEditorPanel
      key={value}
      value={value}
      onCancel={onCancel}
      onSet={onSet}
      title={title}
      currency={currency}
    />
  );
}

function MoneyEditorPanel({
  value,
  onCancel,
  onSet,
  title,
  currency,
}: {
  value: string;
  onCancel: () => void;
  onSet: (value: string) => void;
  title: string;
  currency: string;
}) {
  const [draft, setDraft] = React.useState(value || "0");
  const [operator, setOperator] = React.useState<Operator | null>(null);
  const [leftValue, setLeftValue] = React.useState<number | null>(null);
  const [freshEntry, setFreshEntry] = React.useState(false);

  const inputDigit = (digit: string) => {
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
  };

  const chooseOperator = (nextOperator: Operator) => {
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
  };

  const equals = () => {
    if (leftValue === null || !operator) return;
    const result = calculate(leftValue, Number(draft || "0"), operator);
    setDraft(String(Math.round(result * 100) / 100));
    setLeftValue(null);
    setOperator(null);
    setFreshEntry(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="money-editor-title"
      className="fixed inset-0 z-[70] flex items-end bg-foreground/25 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="w-full rounded-t-[18px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgb(23_32_29_/_0.14)]">
        <div className="mx-auto w-full max-w-[480px]">
          <div className="grid grid-cols-[44px_1fr_64px] items-center">
            <button
              type="button"
              aria-label="Cancel money edit"
              onClick={onCancel}
              className="flex size-11 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground hover:bg-surface-subtle"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
            <div className="min-w-0 px-2 text-center">
              <p id="money-editor-title" className="text-xs font-semibold text-muted-foreground">
                {title}
              </p>
              <p className="mt-0.5 truncate text-[27px] font-semibold tracking-[-0.035em] tabular-nums">
                {formatMoney(draft)}
                <span className="ml-2 text-sm text-muted-foreground">{currency}</span>
              </p>
              <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
                Original{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatMoney(value)} {currency}
                </span>
              </p>
              {leftValue !== null && operator ? (
                <p className="text-[11px] font-semibold text-primary">
                  {formatMoney(String(leftValue))} {operator}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Set money amount"
              onClick={() => onSet(draft || "0")}
              className="flex h-10 items-center justify-center gap-1 rounded-[10px] border border-primary/20 bg-primary-soft px-3 text-sm font-semibold text-primary"
            >
              <Check aria-hidden="true" className="size-4" />
              Set
            </button>
          </div>

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
                onClick={() =>
                  setDraft((current) =>
                    current.length > 1 ? current.slice(0, -1) : "0",
                  )
                }
                className="flex h-12 items-center justify-center rounded-[11px] bg-card text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)] active:bg-expense-soft"
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
        </div>
      </div>
    </div>
  );
}
