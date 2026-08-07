"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  AlertCircle,
  Banknote,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Landmark,
  LoaderCircle,
  Menu,
  Plus,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";

import type { Transaction } from "@/lib/transactions";
import { AccountAvatar } from "@/components/accounts/account-avatar";
import { authenticatedFetch, notifyTransactionsChanged } from "@/lib/auth-client";
import { navigateWithRouteExit } from "@/lib/route-motion";
import type { ApiTransaction } from "@/components/transactions/transaction-list";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { formatMoney, MoneyEditor } from "@/components/money/money-editor";
import { AuthenticatedImage } from "@/components/ui/authenticated-image";
import { getCategoryIcon } from "@/lib/category-appearance";
import { getCategoryForeground } from "@/lib/category-appearance";
import { getSavingsIconSource } from "@/lib/savings-appearance";
import {
  getAccountBackgroundColor,
  getAccountForeground,
} from "@/lib/account-appearance";
import { Calendar } from "@/components/ui/calendar";
import { useAnimatedVisibility } from "@/lib/use-animated-visibility";

type TransactionKind = Transaction["kind"] | "";

const transactionTypes = [
  {
    value: "expense",
    label: "Expense",
    description: "Money leaving an account",
    icon: ArrowUpRight,
    iconClassName: "bg-expense-soft text-expense",
    foregroundClassName: "text-expense",
  },
  {
    value: "income",
    label: "Income",
    description: "Money added to an account",
    icon: ArrowDownLeft,
    iconClassName: "bg-income-soft text-income",
    foregroundClassName: "text-income",
  },
  {
    value: "transfer",
    label: "Transfer",
    description: "Move money between accounts",
    icon: ArrowLeftRight,
    iconClassName: "bg-info-soft text-info",
    foregroundClassName: "text-info",
  },
  {
    value: "savings",
    label: "Savings",
    description: "Set money aside",
    icon: Landmark,
    iconClassName: "bg-income-soft text-income",
    foregroundClassName: "text-income",
  },
] satisfies Array<{
  value: Transaction["kind"];
  label: string;
  description: string;
  icon: typeof ArrowUpRight;
  iconClassName: string;
  foregroundClassName: string;
}>;

const tagOptions = ["Recurring", "Personal", "Work", "Reimbursable"];
const categoryIconOptions = [
  "Home", "Food", "Shopping", "Travel", "Health", "Gifts", "Work", "Wallet",
  "Plants", "Online Shopping", "Shopping Cart", "Groceries", "Coffee", "Fitness",
  "Education", "Flights", "Pets", "Movies", "Cash", "Insurance", "Car", "Transport",
  "Vehicles", "Salary", "Freelancing", "Investments", "FD", "Loans", "Family",
  "Entertainment", "Music", "Restaurants", "Clothing", "Bills", "Utilities", "Rent",
  "Phone", "Internet", "Subscriptions", "Fuel", "Medicine", "Bank", "Savings", "CreditCard",
  "Vacation", "Repairs", "Events", "Charity", "Hobbies", "Receipts", "Books",
];

type CategoryOption = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

type SavingsInstrumentOption = { id: string; name: string; typeName?: string; currentBalance: number; icon?: string | null };

function SavingsInstrumentAvatar({ icon }: { icon?: string | null }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[9px] border border-primary/10 bg-primary-soft">
      <AuthenticatedImage
        src={getSavingsIconSource(icon)}
        alt=""
        width={36}
        height={36}
        className="size-full object-cover"
        unoptimized
      />
    </span>
  );
}

const LAST_ACCOUNT_KEY = "cocomelon.last-transaction-account";

function sortTransactionAccounts<T extends { id: string; isDefault?: boolean }>(accounts: T[], preferredId: string | null) {
  const preferred = preferredId
    ? accounts.find((account) => account.id === preferredId)
    : accounts.find((account) => account.isDefault);
  return preferred ? [preferred, ...accounts.filter((account) => account.id !== preferred.id)] : accounts;
}

const categoryForegrounds: Record<string, string> = {
  "#e3eee9": "#356b68",
  "#f8e9e6": "#9e514b",
  "#f3e8d4": "#95631e",
  "#e3eff6": "#436f9a",
  "#e5f3eb": "#2f7d5a",
  "#ece6f3": "#735b8f",
  "#fbe8dc": "#a9512e",
};

function categoryForeground(color: string | null) {
  return categoryForegrounds[color?.toLowerCase() ?? ""] ?? "#356b68";
}

export function TransactionDetail({
  transaction,
  isNew = false,
  initialKind,
  guidedNew = false,
}: {
  transaction: Transaction;
  isNew?: boolean;
  initialKind?: Transaction["kind"];
  guidedNew?: boolean;
}) {
  const router = useRouter();
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
  const [time, setTime] = React.useState("12:00");
  const [kind, setKind] = React.useState<TransactionKind>(
    isNew ? (initialKind ?? "") : transaction.kind,
  );
  const [typeOpen, setTypeOpen] = React.useState(false);
  const [category, setCategory] = React.useState(transaction.category);
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = React.useState<CategoryOption[]>([]);
  const [categorySearch, setCategorySearch] = React.useState("");
  const [categoryCreateOpen, setCategoryCreateOpen] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryIcon, setNewCategoryIcon] = React.useState("Wallet");
  const [showMoreCategoryIcons, setShowMoreCategoryIcons] = React.useState(false);
  const [categoryCreateError, setCategoryCreateError] = React.useState("");
  const [isCreatingCategory, setIsCreatingCategory] = React.useState(false);
  const [savedTagOptions, setSavedTagOptions] = React.useState<string[]>([]);
  const [newTag, setNewTag] = React.useState("");
  const [tagError, setTagError] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [picker, setPicker] = React.useState<"category" | "tags" | null>(null);
  const [accountId, setAccountId] = React.useState("");
  const [accountOptions, setAccountOptions] = React.useState<Array<{ id: string; name: string; type: string; currency: string; icon: string | null; backgroundColor: string | null; currentBalance: number; allowNegativeBalance: boolean; isDefault?: boolean }>>([]);
  const [savingsOptions, setSavingsOptions] = React.useState<SavingsInstrumentOption[]>([]);
  const [savingsInstrumentId, setSavingsInstrumentId] = React.useState<string | null>(null);
  const [transferToAccountId, setTransferToAccountId] = React.useState("");
  const [amount, setAmount] = React.useState(String(transaction.amount));
  const [amountOpen, setAmountOpen] = React.useState(false);
  const [dateOpen, setDateOpen] = React.useState(false);
  const dateTransition = useAnimatedVisibility(dateOpen);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveAttempted, setSaveAttempted] = React.useState(false);
  const [loadError, setLoadError] = React.useState("");
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  const titleLabel =
    kind === "income"
      ? "Income title"
      : kind === "expense"
        ? "Expense title"
        : kind === "savings"
          ? "Savings title"
          : kind === "transfer"
            ? "Transfer title"
            : kind === "adjust_balance"
              ? "Balance adjustment title"
              : "Transaction title";

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [accountResponse, categoryResponse, tagResponse, savingsResponse] = await Promise.all([
          authenticatedFetch("/api/accounts"),
          authenticatedFetch("/api/categories"),
          authenticatedFetch("/api/tags"),
          authenticatedFetch("/api/savings/instruments"),
        ]);
        const accountResult = (await accountResponse.json()) as { accounts?: Array<{ id: string; name: string; type: string; currency: string; icon: string | null; backgroundColor: string | null; currentBalance: number; allowNegativeBalance: boolean; isDefault?: boolean }> };
        const categoryResult = (await categoryResponse.json()) as { categories?: CategoryOption[] };
        const tagResult = tagResponse.ok ? (await tagResponse.json()) as { tags?: Array<{ name: string }> } : { tags: [] };
        const savingsResult = savingsResponse.ok ? (await savingsResponse.json()) as { instruments?: SavingsInstrumentOption[] } : { instruments: [] };
        if (!active) return;
        const storedAccountId = isNew ? window.localStorage.getItem(LAST_ACCOUNT_KEY) : null;
        const orderedAccounts = sortTransactionAccounts(accountResult.accounts ?? [], storedAccountId);
        setAccountOptions(orderedAccounts);
        setCategoryOptions(categoryResult.categories ?? []);
        setSavedTagOptions(tagResult.tags?.map((tag) => tag.name) ?? []);
        setSavingsOptions(savingsResult.instruments ?? []);

        if (!isNew) {
          const response = await authenticatedFetch(`/api/transactions/${transaction.id}`);
          if (!response.ok) throw new Error("Unable to load transaction");
          const result = (await response.json()) as { transaction?: ApiTransaction };
          const record = result.transaction;
          if (!record || !active) return;
          setTitle(record.title || record.categoryName || "Transaction");
          setDescription(record.notes ?? "");
          setDate(record.date);
          setTime(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(record.transactionAt || `${record.date}T12:00:00.000Z`)));
          setKind(record.type);
          setCategory(record.categoryName ?? "");
          setCategoryId(record.categoryId);
          setTags(record.tags ?? []);
          setAccountId(record.accountId);
          setTransferToAccountId(record.transferToAccountId ?? "");
          setSavingsInstrumentId(record.savingsInstrumentId ?? null);
          setAmount(String(record.amount));
        } else if (initialKind) {
          setKind(initialKind);
          if (guidedNew && orderedAccounts[0]) {
            setAccountId(orderedAccounts[0].id);
            setAmountOpen(true);
          }
        }
      } catch {
        if (active) setLoadError("We could not load this transaction. Please try again.");
      }
    };
    void load();
    return () => { active = false; };
  }, [guidedNew, initialKind, isNew, transaction.id]);

  const selectedAccount = accountOptions.find((account) => account.id === accountId);
  const destinationAccount = accountOptions.find((account) => account.id === transferToAccountId);
  const transferCurrencyError = kind === "transfer" && selectedAccount && destinationAccount && selectedAccount.currency !== destinationAccount.currency
    ? `Cross-currency transfers are not supported yet. Both accounts must use ${selectedAccount.currency}.`
    : "";
  const getBalanceError = (value: string) => {
    const numericValue = Number(value);
    if (!isNew || !selectedAccount || selectedAccount.allowNegativeBalance || !Number.isFinite(numericValue)) return "";
    const projectedBalance = selectedAccount.currentBalance + (kind === "income" || kind === "adjust_balance" ? numericValue : -numericValue);
    return projectedBalance < -0.000001
      ? `This transaction would make ${selectedAccount.name} negative. Enable Allow negative balance in account settings or lower the amount.`
      : "";
  };
  const balanceError = getBalanceError(amount);

  const validationErrors = {
    type: !kind ? "Choose whether this is an expense, income, or transfer." : "",
    title: !title.trim() ? `Add a title for this ${titleLabel.toLowerCase().replace(" title", "")}.` : "",
    amount:
      !Number.isFinite(Number(amount)) || (kind === "adjust_balance" ? Number(amount) === 0 : Number(amount) <= 0)
        ? kind === "adjust_balance" ? "Enter a non-zero balance adjustment." : "Enter an amount greater than NPR 0.00."
        : "",
    category: !category ? "Choose a category for this transaction." : "",
    account: !accountId ? "Choose the account this transaction belongs to." : "",
    transfer: kind === "transfer"
      ? !transferToAccountId ? "Choose the account receiving the transfer." : transferCurrencyError
      : "",
    savingsInstrument: kind === "savings" && !savingsInstrumentId ? "Choose the saving instrument receiving this contribution." : "",
    balance: balanceError,
  };
  const visibleNonTitleErrors = saveAttempted
    ? [
        validationErrors.type,
        validationErrors.amount,
        validationErrors.category,
        validationErrors.account,
        validationErrors.transfer,
        validationErrors.savingsInstrument,
        validationErrors.balance,
      ].filter(Boolean)
    : [];

  const amountTone =
    kind === "income"
      ? "text-income"
      : kind === "expense"
        ? "text-expense"
        : kind === "savings"
          ? "text-income"
          : kind === "adjust_balance"
            ? "text-foreground"
        : kind === "transfer"
          ? "text-info"
          : "text-foreground";
  const TypeIcon =
    kind === "income"
      ? ArrowDownLeft
      : kind === "expense"
        ? ArrowUpRight
        : kind === "savings"
          ? Landmark
          : kind === "adjust_balance"
            ? Banknote
        : kind === "transfer"
          ? ArrowLeftRight
          : Plus;
  const selectedType =
    transactionTypes.find((type) => type.value === kind) ??
    (kind === "adjust_balance"
      ? {
          value: "adjust_balance" as const,
          label: "Adjust balance",
          description: "Correct an account balance",
          icon: Banknote,
          iconClassName: "bg-surface-subtle text-foreground",
          foregroundClassName: "text-foreground",
        }
      : undefined);
  const selectedCategory = categoryOptions.find((option) => option.name === category);
  const categoryIcon = getCategoryIcon(selectedCategory?.icon, selectedCategory?.name);
  const titleFocusMode = guidedNew && Boolean(categoryId) && !title.trim();

  async function createTag() {
    const name = newTag.trim();
    if (!name) return;
    setTagError("");
    const response = await authenticatedFetch("/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    if (!response.ok) {
      setTagError("Could not save this tag.");
      return;
    }
    const result = await response.json() as { tag?: { name: string } };
    const savedName = result.tag?.name ?? name;
    setSavedTagOptions((current) => current.includes(savedName) ? current : [...current, savedName]);
    setTags((current) => current.includes(savedName) ? current : [...current, savedName]);
    setNewTag("");
  }

  async function createCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setCategoryCreateError("Give this category a name.");
      return;
    }

    setIsCreatingCategory(true);
    setCategoryCreateError("");
    const colors = ["#e3eee9", "#e3eff6", "#e5f3eb", "#f3e8d4", "#f8e9e6", "#ece6f3"];
    const response = await authenticatedFetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        type: kind === "income" ? "income" : "expense",
        icon: newCategoryIcon,
        color: colors[categoryOptions.length % colors.length],
      }),
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      setCategoryCreateError(result?.error ?? "Could not create this category.");
      setIsCreatingCategory(false);
      return;
    }

    const result = (await response.json()) as { category?: CategoryOption };
    if (!result.category) {
      setCategoryCreateError("Could not create this category.");
      setIsCreatingCategory(false);
      return;
    }

    setCategoryOptions((current) => [...current, result.category!]);
    setCategory(result.category.name);
    setCategoryId(result.category.id);
    finishCategorySelection();
    setNewCategoryName("");
    setNewCategoryIcon("Wallet");
    setShowMoreCategoryIcons(false);
    setIsCreatingCategory(false);
  }

  function finishCategorySelection() {
    setCategorySearch("");
    setCategoryCreateOpen(false);
    setCategoryCreateError("");
    setPicker(null);
    if (guidedNew) {
      titleInputRef.current?.focus();
      window.requestAnimationFrame(() => {
        titleInputRef.current?.focus();
      });
    }
  }

  const saveTransaction = async () => {
    if (saving) return;
    setTypeOpen(false);
    setSaveAttempted(true);
    if (Object.values(validationErrors).some(Boolean)) return;
    setSaving(true);
    setLoadError("");
    const payload = {
      accountId,
      type: kind as Exclude<TransactionKind, "">,
      amount: Number(amount),
      categoryId,
      title: title.trim(),
      notes: description.trim() || null,
      tags,
      date,
      transactionAt: new Date(`${date}T${time}:00`).toISOString(),
      transferToAccountId: kind === "transfer" ? transferToAccountId : null,
      savingsInstrumentId: kind === "savings" ? savingsInstrumentId : null,
    };
    try {
      const response = await authenticatedFetch(isNew ? "/api/transactions" : `/api/transactions/${transaction.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setLoadError(result?.error ?? "We could not save this transaction. Check the details and try again.");
        setSaving(false);
        return;
      }
      notifyTransactionsChanged();
      setSaved(true);
      navigateWithRouteExit(() => router.back());
    } catch {
      setLoadError("We could not save this transaction. Check your connection and try again.");
      setSaving(false);
    }
  };

  const openAmountEditor = () => {
    setAmountOpen(true);
  };

  const openCategoryPicker = () => {
    setCategorySearch("");
    setCategoryCreateOpen(false);
    setCategoryCreateError("");
    setPicker("category");
  };

  const amountAccountPicker = (
    <div className="rounded-[13px] border border-border bg-card px-3 py-3">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">
        {kind === "income" ? "Add money to" : kind === "savings" ? "Set money aside from" : "Pay money from"}
      </p>
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {accountOptions.map((option) => {
          const selected = accountId === option.id;
          const accountColor = getAccountBackgroundColor(option.backgroundColor, option.type);
          const accountForeground = getAccountForeground(accountColor, option.type);
          return (
            <button
              type="button"
              key={`amount-account-${option.id}`}
              aria-pressed={selected}
              onClick={() => {
                setAccountId(option.id);
                window.localStorage.setItem(LAST_ACCOUNT_KEY, option.id);
              }}
              style={{
                backgroundColor: selected ? accountColor : undefined,
                borderColor: `${accountForeground}8c`,
                color: accountForeground,
              }}
              className="flex min-h-14 shrink-0 items-center gap-2 rounded-[12px] border bg-background px-3 text-left text-sm font-semibold transition-colors hover:brightness-[0.98]"
            >
              <span className="flex size-9 shrink-0 overflow-hidden rounded-[9px]">
                <AccountAvatar icon={option.icon} name={option.name} type={option.type} backgroundColor={accountColor} size={36} />
              </span>
              <span className="flex min-w-0 flex-col items-start leading-tight">
                <span className="max-w-[130px] truncate">{option.name.replace(" Wallet", "").replace(" account", "")}</span>
                <span className="mt-1 text-[11px] font-medium tabular-nums opacity-75">{formatMoney(String(option.currentBalance))} {option.currency}</span>
              </span>
              {selected ? <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background"><Check aria-hidden="true" className="size-3.5 stroke-[3]" /></span> : null}
            </button>
          );
        })}
      </div>
      {kind === "savings" ? (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Saving instrument</p>
          {saveAttempted && validationErrors.savingsInstrument ? <p className="mb-2 text-xs font-medium text-expense">{validationErrors.savingsInstrument}</p> : null}
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {savingsOptions.map((option) => {
              const selected = savingsInstrumentId === option.id;
              return <button type="button" key={`amount-${option.id}`} aria-pressed={selected} onClick={() => setSavingsInstrumentId(option.id)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-[11px] border px-3.5 text-sm font-semibold transition-colors ${selected ? "border-primary bg-primary-soft text-primary shadow-sm" : "border-border bg-background hover:border-primary/50"}`}><SavingsInstrumentAvatar icon={option.icon} /><span className="max-w-[150px] truncate">{option.name}</span>{option.typeName ? <span className="max-w-[120px] truncate text-xs font-medium text-muted-foreground">· {option.typeName}</span> : null}</button>;
            })}
            {savingsOptions.length === 0 ? <Link href="/savings-instruments/new" className="flex min-h-11 shrink-0 items-center rounded-[11px] border border-dashed border-primary/35 bg-primary-soft/35 px-3.5 text-sm font-semibold text-primary">Add a saving instrument</Link> : null}
          </div>
        </div>
      ) : null}
    </div>
  );

  const deleteCurrentTransaction = async () => {
    const response = await authenticatedFetch(`/api/transactions/${transaction.id}`, { method: "DELETE" });
    if (response.ok) {
      notifyTransactionsChanged();
      navigateWithRouteExit(() => router.push("/"));
    }
    else setLoadError("We could not delete this transaction. Please try again.");
  };

  return (
    <main className="page-route-enter min-h-dvh bg-background">
      <div className="mx-auto min-h-dvh w-full max-w-[720px] px-4 pb-6 sm:px-5">
        <StickyPageHeader className="-mx-4 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
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
              className={`pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 ${selectedType?.foregroundClassName ?? "text-primary"}`}
            />
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={typeOpen}
              onClick={() => setTypeOpen((current) => !current)}
              className={`h-11 w-full rounded-[11px] border bg-card pl-10 pr-9 text-left text-[15px] font-semibold outline-none transition-colors focus:ring-2 focus:ring-primary/20 ${selectedType?.foregroundClassName ?? "text-muted-foreground"} ${
                saveAttempted && validationErrors.type
                  ? "border-expense"
                  : typeOpen
                    ? "border-primary"
                    : "border-border"
              }`}
            >
              {selectedType?.label ?? "Choose type"}
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
                        className={`flex size-9 shrink-0 items-center justify-center rounded-[9px] ${type.iconClassName}`}
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
            aria-label={saving ? "Saving transaction" : "Save transaction"}
            disabled={saving}
            onClick={saveTransaction}
            className={`flex size-11 justify-self-end items-center justify-center rounded-[11px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-wait disabled:opacity-75 ${
              saved
                ? "border-primary bg-primary text-primary-foreground"
                : "border-primary/20 bg-primary-soft text-primary hover:border-primary/40"
            }`}
          >
            {saving ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <Check aria-hidden="true" className="size-5" />}
          </button>
        </StickyPageHeader>

        {visibleNonTitleErrors.length ? (
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
                {visibleNonTitleErrors.map((error) => (
                  <li key={error}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
        {loadError ? (
          <p role="alert" className="mt-4 rounded-[11px] border border-expense/25 bg-expense-soft px-4 py-3 text-sm font-medium text-expense">
            {loadError}
          </p>
        ) : null}

        <section className="mt-9">
          <label>
            <span className="sr-only">{titleLabel}</span>
            <input
              ref={titleInputRef}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setLoadError("");
              }}
              aria-invalid={saveAttempted && Boolean(validationErrors.title)}
              className={`w-full border-b bg-transparent pb-4 text-[36px] font-semibold leading-[1.08] tracking-[-0.05em] outline-none transition-colors focus:border-primary sm:text-[42px] ${saveAttempted && validationErrors.title ? "border-expense text-expense placeholder:text-expense/65 motion-safe:animate-[title-error-nudge_260ms_ease-out]" : "border-border-strong"}`}
              placeholder={titleLabel}
            />
            {saveAttempted && validationErrors.title ? (
              <span className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-expense motion-safe:animate-[title-error-nudge_260ms_ease-out]">
                <AlertCircle aria-hidden="true" className="size-3.5" />
                {validationErrors.title}
              </span>
            ) : null}
          </label>

        </section>

        <div className={`transition-[filter,opacity] duration-300 ${titleFocusMode ? "pointer-events-none select-none blur-[3px] opacity-55" : ""}`}>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                openCategoryPicker();
              }}
              style={selectedCategory?.color ? { backgroundColor: selectedCategory.color, color: getCategoryForeground(selectedCategory.color), borderColor: `${getCategoryForeground(selectedCategory.color)}55` } : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-[11px] border px-3.5 text-sm font-semibold transition-colors ${
                saveAttempted && validationErrors.category
                  ? "border-expense bg-expense-soft text-expense"
                  : "border-transparent bg-primary-soft text-primary"
              }`}
            >
              {React.createElement(categoryIcon, { "aria-hidden": true, className: "size-[18px]" })}
              {category || "Choose category"}
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setPicker("tags")}
              className="flex min-h-11 items-center gap-2 rounded-[11px] border border-border-strong bg-card px-3.5 text-sm font-semibold"
            >
              <Plus aria-hidden="true" className="size-4" />
              {tags.length ? (tags.length === 1 ? tags[0] : `${tags.length} tags`) : "Add tags"}
              <Tags aria-hidden="true" className="size-4 text-muted-foreground" />
            </button>
          </div>
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
              {selectedAccount ? <span className="ml-2 text-xs font-semibold text-muted-foreground">· {selectedAccount.currency}</span> : null}
            </h2>
            {saveAttempted && validationErrors.account ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-expense">
                <AlertCircle aria-hidden="true" className="size-3.5" />
                {validationErrors.account}
              </p>
            ) : null}
          </div>

          <div className="flex gap-2 overflow-x-auto px-4 pb-4 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {accountOptions.map((option) => {
              const selected = accountId === option.id;
              const accountColor = getAccountBackgroundColor(option.backgroundColor, option.type);
              const accountForeground = getAccountForeground(accountColor, option.type);
              return (
                <button
                  type="button"
                  key={option.id}
                  aria-pressed={selected}
                  onClick={() => {
                    setAccountId(option.id);
                    window.localStorage.setItem(LAST_ACCOUNT_KEY, option.id);
                  }}
                  style={{
                    backgroundColor: selected ? accountColor : undefined,
                    borderColor: `${accountForeground}8c`,
                    color: accountForeground,
                  }}
                  className="flex min-h-14 shrink-0 items-center gap-2 rounded-[12px] border bg-card px-3 text-sm font-semibold transition-colors hover:brightness-[0.98]"
                >
                  <span className="flex size-10 shrink-0 overflow-hidden rounded-[10px]">
                    <AccountAvatar icon={option.icon} name={option.name} type={option.type} backgroundColor={accountColor} size={40} />
                  </span>
                  <span className="flex min-w-0 flex-col items-start leading-tight">
                    <span>{option.name.replace(" Wallet", "").replace(" account", "")}</span>
                    <span className="mt-1 text-[11px] font-medium tabular-nums opacity-75">
                      {formatMoney(String(option.currentBalance))} {option.currency}
                    </span>
                  </span>
                  {selected ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                      <Check aria-hidden="true" className="size-3.5 stroke-[3]" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {kind === "transfer" ? (
            <div className="border-t border-border px-4 pb-4 pt-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Move money to</p>
              <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {accountOptions.filter((option) => option.id !== accountId).map((option) => {
                  const selected = transferToAccountId === option.id;
                  const incompatibleCurrency = Boolean(selectedAccount && selectedAccount.currency !== option.currency);
                  const accountColor = getAccountBackgroundColor(option.backgroundColor, option.type);
                  const accountForeground = getAccountForeground(accountColor, option.type);
                  return (
                    <button
                      type="button"
                      key={`destination-${option.id}`}
                      aria-pressed={selected}
                      disabled={incompatibleCurrency}
                      title={incompatibleCurrency ? `Unavailable: this account uses ${option.currency}` : undefined}
                      onClick={() => setTransferToAccountId(option.id)}
                      style={{
                        backgroundColor: selected ? accountForeground : accountColor,
                        borderColor: selected ? accountForeground : `${accountForeground}45`,
                        color: selected ? "#ffffff" : accountForeground,
                      }}
                      className={`flex min-h-14 shrink-0 items-center gap-2 rounded-[11px] border px-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${selected ? "shadow-[0_0_0_3px_rgb(255_255_255_/_0.92),0_0_0_5px_rgb(23_32_29_/_0.22)]" : "hover:brightness-[0.98]"}`}
                    >
                      <span className="flex size-9 shrink-0 overflow-hidden rounded-[9px]">
                        <AccountAvatar icon={option.icon} name={option.name} type={option.type} backgroundColor={accountColor} size={36} />
                      </span>
                      <span className="flex min-w-0 flex-col items-start leading-tight">
                        <span>{option.name.replace(" Wallet", "").replace(" account", "")}</span>
                        <span className="mt-1 text-[11px] font-medium tabular-nums opacity-75">
                          {formatMoney(String(option.currentBalance))} {option.currency}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {kind === "savings" ? (
            <div className="border-t border-border px-4 pb-4 pt-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Saving instrument</p>
              {saveAttempted && validationErrors.savingsInstrument ? <p className="mb-2 text-xs font-medium text-expense">{validationErrors.savingsInstrument}</p> : null}
              <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {savingsOptions.map((option) => {
                  const selected = savingsInstrumentId === option.id;
                  return <button type="button" key={option.id} aria-pressed={selected} onClick={() => setSavingsInstrumentId(option.id)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-[11px] border px-3.5 text-sm font-semibold transition-colors ${selected ? "border-primary bg-primary-soft text-primary shadow-sm" : "border-border bg-background hover:border-primary/50"}`}><SavingsInstrumentAvatar icon={option.icon} /><span className="max-w-[150px] truncate">{option.name}</span>{option.typeName ? <span className="max-w-[120px] truncate text-xs font-medium text-muted-foreground">· {option.typeName}</span> : null}</button>;
                })}
                {savingsOptions.length === 0 ? <Link href="/savings-instruments/new" className="flex min-h-11 shrink-0 items-center rounded-[11px] border border-dashed border-primary/35 bg-primary-soft/35 px-3.5 text-sm font-semibold text-primary">Add a saving instrument</Link> : null}
              </div>
            </div>
          ) : null}

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
                {selectedAccount?.currency ?? "NPR"}
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

        <button type="button" onClick={() => setDateOpen(true)} className="mt-3 flex min-h-[66px] w-full items-center gap-3 rounded-[14px] border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-surface-subtle">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-primary-soft text-primary">
            <CalendarDays aria-hidden="true" className="size-[17px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Transaction date
            </span>
            <span className="mt-0.5 block text-[15px] font-semibold">{format(new Date(`${date}T12:00:00`), "EEEE, MMM d, yyyy")} · {time}</span>
          </span>
          <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
        </button>

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
      </div>

      <MoneyEditor
        open={amountOpen}
        value={amount}
        title={guidedNew ? "Enter transaction amount" : "Edit transaction amount"}
        currency={selectedAccount?.currency ?? "NPR"}
        topContent={guidedNew ? amountAccountPicker : undefined}
        confirmPlacement={guidedNew ? "bottom" : "top"}
        confirmLabel={guidedNew ? "Continue" : "Set"}
        confirmDisabled={guidedNew ? (value) => !Number.isFinite(Number(value)) || Number(value) <= 0 : false}
        confirmValidation={guidedNew ? getBalanceError : undefined}
        cancelVariant={guidedNew ? "text" : "icon"}
        cancelLabel={guidedNew ? "Cancel" : "Cancel money edit"}
        dismissOnBackdrop
        closeOnEscape={!guidedNew}
        onCancel={() => guidedNew ? navigateWithRouteExit(() => router.back()) : setAmountOpen(false)}
        onSet={(nextAmount) => {
          setAmount(nextAmount);
          setAmountOpen(false);
          if (guidedNew) openCategoryPicker();
        }}
      />

      {dateTransition.mounted ? (
        <div role="dialog" aria-modal="true" aria-labelledby="transaction-date-title" className={`fixed inset-0 z-[70] flex items-end bg-foreground/25 ${dateTransition.closing ? "drawer-scrim-exit" : "drawer-scrim-enter"}`}>
          <div className={`${dateTransition.closing ? "drawer-exit" : "drawer-enter"} flex max-h-[88dvh] w-full flex-col rounded-t-[24px] border-t border-border bg-background shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)]`}>
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-foreground/20" aria-hidden="true" />
          <header className="flex items-center justify-between border-b border-border px-4 pb-3 pt-3">
            <button type="button" onClick={() => setDateOpen(false)} aria-label="Close date picker" className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card"><X aria-hidden="true" className="size-5" /></button>
            <h2 id="transaction-date-title" className="text-base font-semibold">Choose date</h2>
            <button type="button" onClick={() => setDateOpen(false)} className="rounded-[10px] bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">Done</button>
          </header>
          <div className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-8">
            <div className="w-full max-w-[420px] space-y-4">
              <Calendar mode="single" selected={new Date(`${date}T12:00:00`)} onSelect={(selected) => { if (selected) setDate(format(selected, "yyyy-MM-dd")); }} className="w-full rounded-[18px] border border-border bg-card p-4 shadow-[0_18px_50px_rgb(23_32_29_/_0.10)]" />
              <div className="rounded-[16px] border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-sm font-semibold">Transaction time</p><p className="mt-1 text-xs text-muted-foreground">When it happened in real life</p></div>
                  <input aria-label="Transaction time" type="time" value={time} onChange={(event) => setTime(event.target.value)} className="h-11 rounded-[11px] border border-border bg-background px-3 text-base font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {["08:00", "12:00", "18:00", "21:00"].map((suggestion) => <button key={suggestion} type="button" onClick={() => setTime(suggestion)} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${time === suggestion ? "border-primary bg-primary-soft text-primary" : "border-border bg-background text-muted-foreground"}`}>{suggestion}</button>)}
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      ) : null}

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
              <button
                type="button"
                onClick={() => void deleteCurrentTransaction()}
                className="flex h-11 items-center justify-center rounded-[10px] bg-expense font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {picker ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="picker-title"
          className={`fixed inset-0 ${guidedNew && picker === "category" ? "z-[75]" : "z-[55]"} flex items-end bg-foreground/20`}
        >
          <div className="flex h-[min(88dvh,680px)] max-h-[calc(100dvh-env(safe-area-inset-bottom))] w-full flex-col overflow-hidden overscroll-contain rounded-t-[18px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgb(23_32_29_/_0.12)]">
            <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col">
              <div className="grid shrink-0 grid-cols-[44px_1fr_44px] items-center">
                <button
                  type="button"
                  aria-label={`Close ${picker} picker`}
                  onClick={() => {
                    setPicker(null);
                    if (picker === "category") {
                      setCategorySearch("");
                      setCategoryCreateOpen(false);
                      setNewCategoryIcon("Wallet");
                      setShowMoreCategoryIcons(false);
                      setCategoryCreateError("");
                    }
                  }}
                  className="flex size-11 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-surface-subtle"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
                <h2 id="picker-title" className="text-center text-[17px] font-semibold">
                  {picker === "category" ? "Choose category" : "Add tags"}
                </h2>
                <span />
              </div>
              {picker === "category" ? (
                <div className="mt-3 shrink-0 space-y-2">
                  <label className="flex min-h-11 items-center gap-2 rounded-[12px] border border-border bg-card px-3 text-muted-foreground focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
                    <Search aria-hidden="true" className="size-4 shrink-0" />
                    <span className="sr-only">Search categories in picker</span>
                    <input
                      value={categorySearch}
                      onChange={(event) => setCategorySearch(event.target.value)}
                      placeholder="Search categories"
                      aria-label="Search categories in picker"
                      className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </label>
                  {categoryCreateOpen ? (
                    <div className="rounded-[14px] border border-primary/20 bg-primary-soft/45 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Add new category</p>
                        <button
                          type="button"
                          onClick={() => {
                            setCategoryCreateOpen(false);
                            setNewCategoryIcon("Wallet");
                            setShowMoreCategoryIcons(false);
                            setCategoryCreateError("");
                          }}
                          className="shrink-0 rounded-md px-1 py-1 text-xs font-semibold text-muted-foreground hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="mt-2 flex flex-col gap-2 min-[380px]:flex-row">
                        <input
                          autoFocus
                          value={newCategoryName}
                          onChange={(event) => {
                            setNewCategoryName(event.target.value);
                            setCategoryCreateError("");
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void createCategory();
                          }}
                          placeholder="Category name"
                          aria-label="New category name"
                          className="min-h-11 min-w-0 flex-1 rounded-[11px] border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => void createCategory()}
                          disabled={isCreatingCategory}
                          className="min-h-11 shrink-0 rounded-[11px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60 min-[380px]:self-stretch"
                        >
                          {isCreatingCategory ? "Saving…" : "Add"}
                        </button>
                      </div>
                      <fieldset className="mt-3">
                        <div className="flex items-center justify-between gap-2">
                          <legend className="text-xs font-semibold text-foreground">Choose an icon</legend>
                          <button
                            type="button"
                            onClick={() => setShowMoreCategoryIcons((current) => !current)}
                            className="shrink-0 rounded-md px-1 py-1 text-[11px] font-semibold text-primary hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                          >
                            {showMoreCategoryIcons ? "Show fewer" : "Show more"}
                          </button>
                        </div>
                        <div className="mt-2 max-h-[180px] overflow-y-auto overscroll-contain rounded-[10px] pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-surface-subtle [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/25">
                          <div className="grid grid-cols-4 gap-1.5 min-[380px]:grid-cols-5">
                          {categoryIconOptions.slice(0, showMoreCategoryIcons ? categoryIconOptions.length : 8).map((iconName) => {
                            const Icon = getCategoryIcon(iconName);
                            const selected = newCategoryIcon === iconName;
                            return (
                              <button
                                type="button"
                                key={iconName}
                                aria-label={iconName}
                                aria-pressed={selected}
                                onClick={() => setNewCategoryIcon(iconName)}
                                className={`flex min-h-11 items-center justify-center rounded-[9px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"}`}
                              >
                                <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
                              </button>
                            );
                          })}
                          </div>
                        </div>
                      </fieldset>
                      {categoryCreateError ? <p role="alert" className="mt-2 text-xs font-medium text-expense">{categoryCreateError}</p> : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCategoryCreateOpen(true)}
                      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-dashed border-primary/35 bg-primary-soft/35 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft"
                    >
                      <Plus aria-hidden="true" className="size-4" />
                      Add new category
                    </button>
                  )}
                </div>
              ) : null}
              <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom))] pr-0.5">
                {(picker === "category"
                  ? categoryOptions.filter((option) => option.name.toLocaleLowerCase().includes(categorySearch.trim().toLocaleLowerCase()))
                  : [...tagOptions, ...savedTagOptions.filter((tag) => !tagOptions.includes(tag))]
                ).map(
                  (option) => {
                    const isCategory = picker === "category";
                    const optionName = typeof option === "string" ? option : option.name;
                    const optionId = typeof option === "string" ? null : option.id;
                    const categoryOption = isCategory && typeof option !== "string" ? option : null;
                    const selected =
                      picker === "category"
                        ? category === optionName
                        : tags.includes(optionName);
                    const Icon = categoryOption ? getCategoryIcon(categoryOption.icon, categoryOption.name) : null;
                    const iconColor = categoryOption ? categoryForeground(categoryOption.color) : undefined;
                    return (
                      <button
                        type="button"
                        key={optionName}
                        aria-pressed={selected}
                        onClick={() => {
                          if (picker === "category") {
                            setCategory(optionName);
                            setCategoryId(optionId);
                            finishCategorySelection();
                          } else {
                            setTags((current) =>
                              current.includes(optionName)
                                ? current.filter((tag) => tag !== optionName)
                                : [...current, optionName],
                            );
                          }
                        }}
                        style={!selected && categoryOption?.color ? { backgroundColor: categoryOption.color } : undefined}
                        className={`flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card hover:border-primary/50"
                        }`}
                      >
                        {Icon ? (
                          <span
                            className={`grid size-7 shrink-0 place-items-center rounded-full ${selected ? "bg-white/20" : "bg-white/65"}`}
                            style={!selected ? { color: iconColor } : undefined}
                          >
                            <Icon aria-hidden="true" className="size-[17px]" strokeWidth={1.9} />
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">{optionName}</span>
                        {selected ? <Check aria-hidden="true" className="size-4 shrink-0 text-white" strokeWidth={2.5} /> : null}
                      </button>
                    );
                  },
                )}
              </div>
              {picker === "tags" ? (
                <div className="mt-3">
                  <div className="flex gap-2">
                    <input value={newTag} onChange={(event) => setNewTag(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createTag(); }} placeholder="Create a new tag" className="min-h-11 min-w-0 flex-1 rounded-[11px] border border-border bg-card px-3 text-sm outline-none focus:border-primary" />
                    <button type="button" onClick={() => void createTag()} className="min-h-11 rounded-[11px] bg-primary px-4 text-sm font-semibold text-primary-foreground">Add</button>
                  </div>
                  {tagError ? <p role="alert" className="mt-2 text-xs font-medium text-expense">{tagError}</p> : null}
                </div>
              ) : null}
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
