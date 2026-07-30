"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  AlertCircle,
  BriefcaseMedical,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Menu,
  Plus,
  Tags,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";

import type { Transaction } from "@/lib/transactions";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { formatMoney, MoneyEditor } from "@/components/money/money-editor";

type TransactionKind = Transaction["kind"] | "";

const transactionTypes = [
  {
    value: "expense",
    label: "Expense",
    description: "Money leaving an account",
    icon: ArrowUpRight,
    className: "bg-expense-soft text-expense",
  },
  {
    value: "income",
    label: "Income",
    description: "Money added to an account",
    icon: ArrowDownLeft,
    className: "bg-income-soft text-income",
  },
  {
    value: "transfer",
    label: "Transfer",
    description: "Move money between accounts",
    icon: ArrowLeftRight,
    className: "bg-info-soft text-info",
  },
] satisfies Array<{
  value: Transaction["kind"];
  label: string;
  description: string;
  icon: typeof ArrowUpRight;
  className: string;
}>;

const accountOptions = ["eSewa Wallet", "Primary account", "Savings account", "Cash"];
const categoryOptions = ["Refund", "Income", "Housing", "Dining", "Shopping", "Insurance"];
const tagOptions = ["Recurring", "Personal", "Work", "Reimbursable"];

export function TransactionDetail({
  transaction,
  isNew = false,
  initialKind,
}: {
  transaction: Transaction;
  isNew?: boolean;
  initialKind?: Transaction["kind"];
}) {
  const [title, setTitle] = React.useState(
    isNew ? "" : transaction.description,
  );
  const [description, setDescription] = React.useState(
    isNew
      ? ""
      : transaction.kind === "income"
      ? `Received through ${transaction.account}`
      : transaction.kind === "transfer"
        ? `Moved from ${transaction.account} to ${transaction.destinationAccount}`
        : `Paid from ${transaction.account}`,
  );
  const [date, setDate] = React.useState(transaction.date);
  const [kind, setKind] = React.useState<TransactionKind>(
    isNew ? (initialKind ?? "") : transaction.kind,
  );
  const [typeOpen, setTypeOpen] = React.useState(false);
  const [category, setCategory] = React.useState(transaction.category);
  const [tags, setTags] = React.useState<string[]>([]);
  const [picker, setPicker] = React.useState<"category" | "tags" | null>(null);
  const [account, setAccount] = React.useState(transaction.account);
  const [amount, setAmount] = React.useState(String(transaction.amount));
  const [amountOpen, setAmountOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [saveAttempted, setSaveAttempted] = React.useState(false);

  const validationErrors = {
    type: !kind ? "Choose whether this is an expense, income, or transfer." : "",
    amount:
      Number(amount) <= 0 ? "Enter an amount greater than NPR 0.00." : "",
    category: !category ? "Choose a category for this transaction." : "",
    account: !account ? "Choose the account this transaction belongs to." : "",
  };
  const visibleErrors = saveAttempted
    ? Object.values(validationErrors).filter(Boolean)
    : [];

  const amountTone =
    kind === "income"
      ? "text-income"
      : kind === "expense"
        ? "text-expense"
        : kind === "transfer"
          ? "text-info"
          : "text-foreground";
  const TypeIcon =
    kind === "income"
      ? ArrowDownLeft
      : kind === "expense"
        ? ArrowUpRight
        : kind === "transfer"
          ? ArrowLeftRight
          : Plus;

  const saveTransaction = () => {
    setTypeOpen(false);
    setSaveAttempted(true);
    if (Object.values(validationErrors).some(Boolean)) return;

    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const openAmountEditor = () => {
    setAmountOpen(true);
  };

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto min-h-dvh w-full max-w-[720px] px-4 pb-6 sm:px-5">
        <StickyPageHeader className="-mx-4 grid grid-cols-[44px_1fr_44px] items-center gap-2 px-4 pb-3 sm:-mx-5 sm:px-5">
          <Link
            href="/"
            aria-label="Cancel and return to activity"
            className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <X aria-hidden="true" className="size-5" />
          </Link>

          <div className="relative min-w-0">
            <TypeIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-primary"
            />
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={typeOpen}
              onClick={() => setTypeOpen((current) => !current)}
              className={`h-11 w-full rounded-[11px] border bg-card pl-10 pr-9 text-left text-[15px] font-semibold outline-none transition-colors focus:ring-2 focus:ring-primary/20 ${
                saveAttempted && validationErrors.type
                  ? "border-expense"
                  : typeOpen
                    ? "border-primary"
                    : "border-border"
              } ${kind ? "text-foreground" : "text-muted-foreground"}`}
            >
              {kind
                ? transactionTypes.find((type) => type.value === kind)?.label
                : "Choose type"}
            </button>
            <ChevronDown
              aria-hidden="true"
              className={`pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-transform ${
                typeOpen ? "rotate-180" : ""
              }`}
            />

            {typeOpen ? (
              <div
                role="listbox"
                aria-label="Transaction type"
                className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-[14px] border border-border bg-card p-1.5 shadow-[0_16px_44px_rgb(23_32_29_/_0.16)]"
              >
                {transactionTypes.map((type) => {
                  const Icon = type.icon;
                  const selected = kind === type.value;

                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      key={type.value}
                      onClick={() => {
                        setKind(type.value);
                        setTypeOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors ${
                        selected ? "bg-primary-soft" : "hover:bg-surface-subtle"
                      }`}
                    >
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-[9px] ${type.className}`}
                      >
                        <Icon aria-hidden="true" className="size-[17px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          {type.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {type.description}
                        </span>
                      </span>
                      {selected ? (
                        <Check aria-hidden="true" className="size-4 text-primary" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Save transaction"
            onClick={saveTransaction}
            className={`flex size-11 items-center justify-center rounded-[11px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
              saved
                ? "border-primary bg-primary text-primary-foreground"
                : "border-primary/20 bg-primary-soft text-primary hover:border-primary/40"
            }`}
          >
            <Check aria-hidden="true" className="size-5" />
          </button>
        </StickyPageHeader>

        {visibleErrors.length ? (
          <div
            role="alert"
            className="mt-4 flex gap-3 rounded-[13px] border border-expense/25 bg-expense-soft px-4 py-3.5 text-expense animate-in fade-in-0 slide-in-from-top-2"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-card/75">
              <AlertCircle aria-hidden="true" className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">A few details are missing</p>
              <ul className="mt-1.5 space-y-1 text-xs leading-5 text-foreground/75">
                {visibleErrors.map((error) => (
                  <li key={error}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <section className="mt-9">
          <label>
            <span className="sr-only">Transaction title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full border-b border-border-strong bg-transparent pb-4 text-[36px] font-semibold leading-[1.08] tracking-[-0.05em] outline-none transition-colors focus:border-primary sm:text-[42px]"
              placeholder="Transaction title"
            />
          </label>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPicker("category")}
              className={`flex min-h-11 items-center gap-2 rounded-[11px] border px-3.5 text-sm font-semibold transition-colors ${
                saveAttempted && validationErrors.category
                  ? "border-expense bg-expense-soft text-expense"
                  : "border-transparent bg-primary-soft text-primary"
              }`}
            >
              <BriefcaseMedical aria-hidden="true" className="size-[18px]" />
              {category || "Choose category"}
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setPicker("tags")}
              className="flex min-h-11 items-center gap-2 rounded-[11px] border border-border-strong bg-card px-3.5 text-sm font-semibold"
            >
              <Plus aria-hidden="true" className="size-4" />
              {tags.length ? `${tags.length} ${tags.length === 1 ? "tag" : "tags"}` : "Add tags"}
              <Tags aria-hidden="true" className="size-4 text-muted-foreground" />
            </button>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[16px] border border-border bg-card shadow-[0_14px_40px_rgb(23_32_29_/_0.10)]">
          <div className="px-4 pb-3 pt-4">
            <h2 className="text-[18px] font-semibold tracking-[-0.025em]">
              {kind === "expense"
                ? "Pay money from"
                : kind === "transfer"
                  ? "Move money from"
                  : kind === "income"
                    ? "Add money to"
                    : "Choose an account"}
            </h2>
            {saveAttempted && validationErrors.account ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-expense">
                <AlertCircle aria-hidden="true" className="size-3.5" />
                {validationErrors.account}
              </p>
            ) : null}
          </div>

          <div className="flex gap-2 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {accountOptions.map((option) => {
              const selected = account === option;
              return (
                <button
                  type="button"
                  key={option}
                  aria-pressed={selected}
                  onClick={() => setAccount(option)}
                  className={`flex min-h-12 shrink-0 items-center gap-2 rounded-[12px] border px-4 text-sm font-semibold transition-colors ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-surface-subtle"
                  }`}
                >
                  <WalletCards aria-hidden="true" className="size-[18px]" />
                  {option.replace(" Wallet", "").replace(" account", "")}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={openAmountEditor}
            className={`flex min-h-[132px] w-full flex-col items-center justify-center border-t px-4 py-5 text-center transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 ${
              saveAttempted && validationErrors.amount
                ? "border-expense/35 bg-expense-soft/35"
                : "border-border"
            }`}
          >
            <span className={`text-[38px] font-semibold leading-none tracking-[-0.045em] tabular-nums sm:text-[44px] ${amountTone}`}>
              {formatMoney(amount)}
              <span className="ml-2 text-[17px] tracking-normal text-muted-foreground">
                NPR
              </span>
            </span>
            <span className="mt-2 text-xs font-medium text-muted-foreground">
              {saveAttempted && validationErrors.amount
                ? validationErrors.amount
                : "Tap amount to edit"}
            </span>
          </button>
        </section>

        <section className="mt-5 rounded-[14px] border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Menu aria-hidden="true" className="size-[18px] text-primary" />
            <h2 className="text-sm font-semibold">Description</h2>
          </div>
          <textarea
            value={description}
            rows={2}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-3 block w-full resize-none bg-transparent text-[16px] font-medium leading-6 outline-none placeholder:text-foreground-subtle"
            placeholder="Add a useful note"
          />
        </section>

        <label className="mt-3 flex min-h-[66px] items-center gap-3 rounded-[14px] border border-border bg-card px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-primary-soft text-primary">
            <CalendarDays aria-hidden="true" className="size-[17px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Transaction date
            </span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-0.5 block w-full bg-transparent text-[15px] font-semibold outline-none"
            />
          </span>
        </label>

        {!isNew ? (
          <button
            type="button"
            aria-label="Delete transaction"
            onClick={() => setConfirmDelete(true)}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] border border-expense/20 bg-expense-soft px-4 text-sm font-semibold text-expense transition-colors hover:border-expense/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-expense/30"
          >
            <Trash2 aria-hidden="true" className="size-[18px]" />
            Delete transaction
          </button>
        ) : null}

        <p
          aria-live="polite"
          className={`mt-2 text-center text-xs font-medium transition-colors ${
            saved ? "text-income" : "text-transparent"
          }`}
        >
          Changes saved
        </p>
      </div>

      <MoneyEditor
        open={amountOpen}
        value={amount}
        title="Edit transaction amount"
        onCancel={() => setAmountOpen(false)}
        onSet={(nextAmount) => {
          setAmount(nextAmount);
          setAmountOpen(false);
        }}
      />

      {confirmDelete && !isNew ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/25 px-5"
        >
          <div className="w-full max-w-[360px] rounded-[16px] border border-border bg-card p-5 shadow-xl">
            <h2 id="delete-title" className="text-xl font-semibold tracking-[-0.03em]">
              Delete transaction?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This removes “{title}” from your activity.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="h-11 rounded-[10px] border border-border font-semibold hover:bg-surface-subtle"
              >
                Cancel
              </button>
              <Link
                href="/"
                className="flex h-11 items-center justify-center rounded-[10px] bg-expense font-semibold text-white"
              >
                Delete
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {picker ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="picker-title"
          className="fixed inset-0 z-[55] flex items-end bg-foreground/20"
        >
          <div className="w-full rounded-t-[18px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgb(23_32_29_/_0.12)]">
            <div className="mx-auto w-full max-w-[480px]">
              <div className="grid grid-cols-[44px_1fr_44px] items-center">
                <button
                  type="button"
                  aria-label={`Close ${picker} picker`}
                  onClick={() => setPicker(null)}
                  className="flex size-11 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-surface-subtle"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
                <h2 id="picker-title" className="text-center text-[17px] font-semibold">
                  {picker === "category" ? "Choose category" : "Add tags"}
                </h2>
                <span />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(picker === "category" ? categoryOptions : tagOptions).map(
                  (option) => {
                    const selected =
                      picker === "category"
                        ? category === option
                        : tags.includes(option);
                    return (
                      <button
                        type="button"
                        key={option}
                        aria-pressed={selected}
                        onClick={() => {
                          if (picker === "category") {
                            setCategory(option);
                            setPicker(null);
                          } else {
                            setTags((current) =>
                              current.includes(option)
                                ? current.filter((tag) => tag !== option)
                                : [...current, option],
                            );
                          }
                        }}
                        className={`flex min-h-12 items-center justify-between rounded-[11px] border px-3.5 text-sm font-semibold ${
                          selected
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-border bg-card"
                        }`}
                      >
                        {option}
                        {selected ? <Check aria-hidden="true" className="size-4" /> : null}
                      </button>
                    );
                  },
                )}
              </div>
              {picker === "tags" ? (
                <button
                  type="button"
                  onClick={() => setPicker(null)}
                  className="mt-3 h-11 w-full rounded-[11px] bg-primary text-sm font-semibold text-primary-foreground"
                >
                  Done
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
