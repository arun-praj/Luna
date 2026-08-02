"use client";

import Image from "next/image";
import { createElement, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  CloudOff,
  CloudUpload,
  Landmark,
  LoaderCircle,
  Plus,
  RefreshCw,
  UserRoundCog,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import { AccountAvatar } from "@/components/accounts/account-avatar";
import { getAccountBackgroundColor } from "@/lib/account-appearance";
import { avatarForPreset } from "@/lib/avatar";
import { getCategoryForeground, getCategoryIcon } from "@/lib/category-appearance";
import { useAnimatedVisibility } from "@/lib/use-animated-visibility";
import { useOfflineSnapshot } from "@/lib/offline/use-offline-snapshot";
import {
  checkInternetConnection,
  queueOfflineTransaction,
  reconcileOfflineData,
  subscribeToNetworkStatus,
} from "@/lib/offline/sync";
import type {
  OfflineAccount,
  OfflineTransaction,
  OfflineTransactionInput,
} from "@/lib/offline/types";
import { ListDataSkeleton, Skeleton } from "@/components/ui/data-skeleton";

type ComposerType = OfflineTransactionInput["type"];

const transactionTypes = [
  { type: "expense", label: "Expense", icon: ArrowUpRight, tone: "text-expense bg-expense-soft" },
  { type: "income", label: "Income", icon: ArrowDownLeft, tone: "text-income bg-income-soft" },
  { type: "transfer", label: "Transfer", icon: ArrowLeftRight, tone: "text-info bg-info-soft" },
  { type: "savings", label: "Savings", icon: Landmark, tone: "text-primary bg-primary-soft" },
] satisfies Array<{ type: ComposerType; label: string; icon: typeof ArrowUpRight; tone: string }>;

function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localTimeValue(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatLastSync(value: string | null) {
  if (!value) return "Not yet";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "Not yet";
  return `${new Date(timestamp).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function adjustedBalances(accounts: OfflineAccount[], transactions: OfflineTransaction[]) {
  const balances = new Map(accounts.map((account) => [account.serverId, account.currentBalance]));
  for (const transaction of transactions) {
    if (transaction.syncStatus === "synced") continue;
    const current = balances.get(transaction.accountId) ?? 0;
    if (transaction.type === "income") balances.set(transaction.accountId, current + transaction.amount);
    else if (transaction.type === "adjust_balance") balances.set(transaction.accountId, current + transaction.amount);
    else balances.set(transaction.accountId, current - transaction.amount);
    if (transaction.type === "transfer" && transaction.transferToAccountId) {
      balances.set(
        transaction.transferToAccountId,
        (balances.get(transaction.transferToAccountId) ?? 0) + transaction.amount,
      );
    }
  }
  return balances;
}

function TransactionIcon({ transaction }: { transaction: OfflineTransaction }) {
  const backgroundColor = transaction.categoryColor ?? "#e3eee9";
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center rounded-[11px]"
      style={{ backgroundColor, color: getCategoryForeground(backgroundColor) }}
    >
      {createElement(
        getCategoryIcon(transaction.categoryIcon, transaction.categoryName ?? transaction.title),
        { "aria-hidden": true, className: "size-[18px]", strokeWidth: 1.9 },
      )}
    </span>
  );
}

function OfflineTransactionComposer({
  open,
  onClose,
  accounts,
  categories,
  savingsInstruments,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  accounts: OfflineAccount[];
  categories: ReturnType<typeof useOfflineSnapshot>["snapshot"]["categories"];
  savingsInstruments: ReturnType<typeof useOfflineSnapshot>["snapshot"]["savingsInstruments"];
  onSaved: () => void;
}) {
  const transition = useAnimatedVisibility(open);
  const [type, setType] = useState<ComposerType>("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [savingsInstrumentId, setSavingsInstrumentId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(localDateValue);
  const [time, setTime] = useState(localTimeValue);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const preferredAccount = accounts.find((account) => account.isDefault) ?? accounts[0];
  const effectiveAccountId = accountId || preferredAccount?.serverId || "";

  const visibleCategories = categories.filter((category) =>
    type === "income" ? category.type === "income" : category.type === "expense",
  );
  const numericAmount = Number(amount);
  const selectedAccount = accounts.find((account) => account.serverId === effectiveAccountId);
  const projectedBalance = selectedAccount
    ? selectedAccount.currentBalance + (type === "income" ? numericAmount : -numericAmount)
    : 0;
  const errors = {
    title: title.trim() ? "" : `Add a title for this ${type}.`,
    amount: Number.isFinite(numericAmount) && numericAmount > 0 ? "" : "Enter an amount greater than zero.",
    account: effectiveAccountId ? "" : "Choose an account.",
    category: type === "expense" || type === "income" ? (categoryId ? "" : "Choose a category.") : "",
    destination:
      type === "transfer" && (!destinationAccountId || destinationAccountId === effectiveAccountId)
        ? "Choose a different destination account."
        : "",
    savings:
      type === "savings" && savingsInstruments.length > 0 && !savingsInstrumentId
        ? "Choose a savings instrument."
        : "",
    balance:
      selectedAccount && !selectedAccount.allowNegativeBalance && projectedBalance < 0
        ? `${selectedAccount.name} cannot go below zero.`
        : "",
  };

  const resetAndClose = () => {
    setTitle("");
    setAmount("");
    setNotes("");
    setDestinationAccountId("");
    setCategoryId(null);
    setSavingsInstrumentId(null);
    setAttempted(false);
    setSaveError("");
    setDate(localDateValue());
    setTime(localTimeValue());
    onClose();
  };

  const save = async () => {
    setAttempted(true);
    setSaveError("");
    if (Object.values(errors).some(Boolean)) return;
    setSaving(true);
    try {
      await queueOfflineTransaction({
        accountId: effectiveAccountId,
        type,
        amount: numericAmount,
        categoryId,
        title: title.trim(),
        notes: notes.trim() || null,
        date,
        transactionAt: new Date(`${date}T${time}:00`).toISOString(),
        transferToAccountId: type === "transfer" ? destinationAccountId : null,
        savingsInstrumentId: type === "savings" ? savingsInstrumentId : null,
      });
      onSaved();
      resetAndClose();
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Could not save this transaction offline.");
    } finally {
      setSaving(false);
    }
  };

  if (!transition.mounted) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <button
        type="button"
        aria-label="Close offline transaction form"
        onClick={resetAndClose}
        className={`absolute inset-0 bg-foreground/40 backdrop-blur-[5px] ${transition.closing ? "drawer-scrim-exit" : "drawer-scrim-enter"}`}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-transaction-heading"
        className={`relative z-10 max-h-[92dvh] w-full max-w-[720px] min-w-0 overflow-x-clip overflow-y-auto rounded-t-[24px] border border-border bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_70px_rgb(23_32_29_/_0.22)] sm:px-5 ${transition.closing ? "drawer-exit" : "drawer-enter"}`}
      >
        <span className="mx-auto block h-1.5 w-11 rounded-full bg-border-strong" />
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-primary">Saved on this device</p>
            <h2 id="offline-transaction-heading" className="mt-1 text-[24px] font-semibold tracking-[-0.04em]">Add offline transaction</h2>
          </div>
          <button type="button" onClick={resetAndClose} className="flex size-10 items-center justify-center rounded-[11px] border border-border bg-card" aria-label="Close">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2" role="group" aria-label="Transaction type">
          {transactionTypes.map((option) => {
            const Icon = option.icon;
            const selected = type === option.type;
            return (
              <button
                type="button"
                key={option.type}
                aria-pressed={selected}
                onClick={() => {
                  setType(option.type);
                  setCategoryId(null);
                }}
                className={`flex min-w-0 flex-col items-center gap-1.5 rounded-[12px] border px-1 py-2.5 text-[11px] font-semibold transition-all ${selected ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card text-muted-foreground"}`}
              >
                <span className={`flex size-8 items-center justify-center rounded-[9px] ${selected ? "bg-white/15 text-white" : option.tone}`}>
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-semibold text-muted-foreground">{transactionTypes.find((option) => option.type === type)?.label} title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={type === "expense" ? "Coffee, rent, groceries…" : type === "income" ? "Salary, refund, freelance…" : "What was this for?"}
            className={`mt-2 h-12 w-full rounded-[12px] border bg-card px-4 text-[15px] outline-none focus:ring-2 focus:ring-primary/15 ${attempted && errors.title ? "border-expense" : "border-border"}`}
          />
          {attempted && errors.title ? <span className="mt-1.5 block text-xs font-medium text-expense">{errors.title}</span> : null}
        </label>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_92px] gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Amount</span>
            <span className={`mt-2 flex h-12 items-center rounded-[12px] border bg-card px-3 ${attempted && (errors.amount || errors.balance) ? "border-expense" : "border-border"}`}>
              <span className="mr-2 text-xs font-semibold text-muted-foreground">{selectedAccount?.currency ?? "NPR"}</span>
              <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0.00" className="min-w-0 flex-1 bg-transparent text-[20px] font-semibold tabular-nums outline-none" />
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 h-12 w-full rounded-[12px] border border-border bg-card px-2 text-xs outline-none" />
          </label>
        </div>
        {attempted && (errors.amount || errors.balance) ? <p className="mt-1.5 text-xs font-medium text-expense">{errors.amount || errors.balance}</p> : null}

        <fieldset className="mt-5 min-w-0">
          <legend className="text-xs font-semibold text-muted-foreground">{type === "income" ? "Add money to" : type === "transfer" ? "Move money from" : "Pay from"}</legend>
          <div className="mt-2 min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max min-w-max gap-2">
              {accounts.map((account) => {
              const selected = effectiveAccountId === account.serverId;
              const accountColor = getAccountBackgroundColor(account.backgroundColor, account.type);
              return (
                <button
                  type="button"
                  key={account.id}
                  onClick={() => setAccountId(account.serverId)}
                  aria-pressed={selected}
                  className={`flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[11px] border px-2 pr-2.5 text-xs font-semibold transition-all ${selected ? "border-primary ring-2 ring-primary/15" : "border-border"}`}
                  style={{ backgroundColor: accountColor }}
                >
                  <AccountAvatar icon={account.icon} name={account.name} type={account.type} backgroundColor={accountColor} size={28} />
                  <span className="max-w-24 truncate">{account.name}</span>
                  {selected ? <Check aria-hidden="true" className="size-3.5 stroke-[3]" /> : null}
                </button>
              );
              })}
            </div>
          </div>
          {attempted && errors.account ? <p className="mt-1 text-xs font-medium text-expense">{errors.account}</p> : null}
        </fieldset>

        {type === "transfer" ? (
          <fieldset className="mt-4 min-w-0">
            <legend className="text-xs font-semibold text-muted-foreground">Move money to</legend>
            <div className="mt-2 min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max min-w-max gap-2">
                {accounts.filter((account) => account.serverId !== effectiveAccountId).map((account) => {
                const selected = destinationAccountId === account.serverId;
                const accountColor = getAccountBackgroundColor(account.backgroundColor, account.type);
                return (
                  <button type="button" key={account.id} onClick={() => setDestinationAccountId(account.serverId)} className={`flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[11px] border px-2 pr-2.5 text-xs font-semibold ${selected ? "border-primary ring-2 ring-primary/15" : "border-border"}`} style={{ backgroundColor: accountColor }}>
                    <AccountAvatar icon={account.icon} name={account.name} type={account.type} backgroundColor={accountColor} size={28} />
                    <span className="max-w-24 truncate">{account.name}</span>
                    {selected ? <Check aria-hidden="true" className="size-3.5 stroke-[3]" /> : null}
                  </button>
                );
                })}
              </div>
            </div>
            {attempted && errors.destination ? <p className="mt-1 text-xs font-medium text-expense">{errors.destination}</p> : null}
          </fieldset>
        ) : null}

        {type === "expense" || type === "income" ? (
          <fieldset className="mt-4 min-w-0">
            <legend className="text-xs font-semibold text-muted-foreground">Category</legend>
            <div className="mt-2 min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max min-w-max gap-1.5">
                {visibleCategories.map((category) => {
                const selected = categoryId === category.serverId;
                const color = category.color ?? "#e3eee9";
                return (
                  <button type="button" key={category.id} onClick={() => setCategoryId(category.serverId)} className={`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-2.5 text-xs font-semibold ${selected ? "border-foreground/55 ring-2 ring-foreground/10" : "border-transparent"}`} style={{ backgroundColor: color, color: getCategoryForeground(color) }}>
                    {createElement(getCategoryIcon(category.icon, category.name), {
                      "aria-hidden": true,
                      className: "size-3.5",
                    })}
                    {category.name}
                    {selected ? <Check aria-hidden="true" className="size-3.5 stroke-[3]" /> : null}
                  </button>
                );
                })}
              </div>
            </div>
            {attempted && errors.category ? <p className="mt-1 text-xs font-medium text-expense">{errors.category}</p> : null}
          </fieldset>
        ) : null}

        {type === "savings" ? (
          <label className="mt-4 block">
            <span className="text-xs font-semibold text-muted-foreground">Savings instrument</span>
            <select value={savingsInstrumentId ?? ""} onChange={(event) => setSavingsInstrumentId(event.target.value || null)} className={`mt-2 h-12 w-full rounded-[12px] border bg-card px-3 text-sm font-semibold outline-none ${attempted && errors.savings ? "border-expense" : "border-border"}`}>
              <option value="">{savingsInstruments.length ? "Choose an instrument" : "No cached instruments — contribution will remain unassigned"}</option>
              {savingsInstruments.map((instrument) => <option value={instrument.serverId} key={instrument.id}>{instrument.name}</option>)}
            </select>
            {attempted && errors.savings ? <span className="mt-1 block text-xs font-medium text-expense">{errors.savings}</span> : null}
          </label>
        ) : null}

        <div className="mt-4 grid grid-cols-[92px_minmax(0,1fr)] gap-3">
          <label>
            <span className="text-xs font-semibold text-muted-foreground">Time</span>
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="mt-2 h-12 w-full rounded-[12px] border border-border bg-card px-2 text-xs" />
          </label>
          <label>
            <span className="text-xs font-semibold text-muted-foreground">Description</span>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional note" className="mt-2 h-12 w-full rounded-[12px] border border-border bg-card px-3 text-sm outline-none" />
          </label>
        </div>

        {saveError ? <p role="alert" className="mt-4 rounded-[12px] border border-expense/25 bg-expense-soft px-3 py-2.5 text-xs font-medium text-expense">{saveError}</p> : null}
        <button type="button" onClick={() => void save()} disabled={saving || accounts.length === 0} className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-[14px] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_10px_28px_rgb(53_107_104_/_0.22)] disabled:opacity-50">
          {saving ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <CloudOff aria-hidden="true" className="size-4" />}
          {saving ? "Saving on this device…" : "Save offline"}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">It will sync automatically when Luna reconnects.</p>
      </section>
    </div>
  );
}

export function OfflineHome() {
  const { snapshot, isLoading, error } = useOfflineSnapshot();
  const [composerOpen, setComposerOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(false);

  useEffect(() => subscribeToNetworkStatus(setOnline), []);
  useEffect(() => {
    if (
      process.env.NODE_ENV === "development" &&
      new URLSearchParams(window.location.search).get("preview") === "1"
    ) return;
    void checkInternetConnection().then(setOnline);
  }, []);

  const balances = useMemo(
    () => adjustedBalances(snapshot.accounts, snapshot.transactions),
    [snapshot.accounts, snapshot.transactions],
  );
  const totalBalance = snapshot.accounts
    .filter((account) => account.includeInTotalBalance)
    .reduce((total, account) => total + (balances.get(account.serverId) ?? account.currentBalance), 0);
  const income = snapshot.transactions.filter((transaction) => transaction.type === "income").reduce((total, transaction) => total + transaction.amount, 0);
  const expenses = snapshot.transactions.filter((transaction) => transaction.type === "expense").reduce((total, transaction) => total + transaction.amount, 0);
  const savings = snapshot.transactions.filter((transaction) => transaction.type === "savings").reduce((total, transaction) => total + transaction.amount, 0);
  const pendingCount = snapshot.transactions.filter((transaction) => transaction.syncStatus === "pending").length;
  const failedCount = snapshot.transactions.filter((transaction) => transaction.syncStatus === "failed").length;
  const queuedCount = pendingCount + failedCount;
  const lastSyncLabel = formatLastSync(snapshot.profile?.cachedAt ?? null);
  const currency = snapshot.profile?.currency ?? snapshot.accounts[0]?.currency ?? "NPR";
  const firstName = snapshot.profile?.name.trim().split(/\s+/)[0] || "there";
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date());

  const reconnect = async () => {
    setChecking(true);
    setNotice("");
    try {
      const connected = await reconcileOfflineData();
      setOnline(connected);
      if (!connected) setNotice("Still offline. Check Wi-Fi or mobile data, then try again.");
    } catch (reason) {
      setOnline(false);
      setNotice(
        reason instanceof Error
          ? `Connected, but local data could not refresh: ${reason.message}`
          : "Connected, but local data could not refresh. Try again.",
      );
    } finally {
      setChecking(false);
    }
  };

  const goOnline = () => {
    const savedPath = window.sessionStorage.getItem("cocomelon.offline-return-path");
    const returnPath = savedPath && savedPath.startsWith("/") && !savedPath.startsWith("//") ? savedPath : "/";
    window.sessionStorage.removeItem("cocomelon.offline-return-path");
    window.location.replace(returnPath);
  };

  return (
    <>
      <main className="page-route-enter min-h-dvh bg-background">
        <div className="mx-auto w-full max-w-[720px] px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-5">
          <header className="-mx-4 flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:-mx-5 sm:px-5 sm:pt-10">
            <div className="flex min-w-0 items-center gap-3">
              <span className="size-11 shrink-0">
                {snapshot.profile ? (
                  <Image src={avatarForPreset(snapshot.profile.avatarPreset)} alt="" width={44} height={44} unoptimized className="size-full rounded-[12px] border border-border bg-primary-soft" />
                ) : <Skeleton className="size-11 rounded-[12px]" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[23px] font-semibold tracking-[-0.035em]">Hello, {firstName}</p>
                <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Your offline budget</p>
              </div>
            </div>
            <span className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold ${online ? "border-income/20 bg-income-soft text-income" : "border-expense/20 bg-expense-soft text-expense"}`}>
              {online ? <Wifi aria-hidden="true" className="size-4" /> : <WifiOff aria-hidden="true" className="size-4" />}
              {online ? "Online" : "Offline"}
            </span>
          </header>

          <section className="mt-5 overflow-hidden rounded-[18px] border border-primary/15 bg-[linear-gradient(135deg,var(--primary-soft),var(--card))] p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-card text-primary shadow-sm">
                <UserRoundCog aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Sync Center</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Your cached budget is safe on this device. Luna syncs queued changes when the connection returns.</p>
              </div>
            </div>
            <div className="mt-4 rounded-[13px] border border-border/80 bg-card/75 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold">Sync status</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{checking ? "Refreshing your cached data" : online ? "Connection is available" : "Waiting for a connection"}</p>
                </div>
                <span role="status" className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${checking ? "bg-info-soft text-info" : online ? "bg-income-soft text-income" : "bg-surface-subtle text-muted-foreground"}`}>
                  {checking ? "Syncing" : online ? "Ready" : "Offline"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="min-w-0 rounded-[10px] bg-background/70 px-2.5 py-2">
                  <p className="text-[10px] font-medium text-muted-foreground">Last sync</p>
                  <p className="mt-1 truncate text-[11px] font-semibold" title={lastSyncLabel}>{lastSyncLabel}</p>
                </div>
                <div className="min-w-0 rounded-[10px] bg-background/70 px-2.5 py-2">
                  <p className="text-[10px] font-medium text-muted-foreground">Queue</p>
                  <p className={`mt-1 truncate text-[11px] font-semibold ${failedCount ? "text-expense" : ""}`}>
                    {failedCount ? `${failedCount} failed` : queuedCount ? `${pendingCount} pending` : "All clear"}
                  </p>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => void reconnect()} disabled={checking} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[11px] border border-primary/20 bg-card px-4 text-xs font-semibold text-primary shadow-sm disabled:opacity-60">
              {checking ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <RefreshCw aria-hidden="true" className="size-4" />}
              {checking ? "Checking connection…" : online ? failedCount ? "Retry failed sync" : "Sync cached data" : "Try to get online"}
            </button>
            {online && !checking ? (
              <button type="button" onClick={goOnline} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[11px] bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm">
                <ArrowRight aria-hidden="true" className="size-4" />
                Connection found — get online
              </button>
            ) : null}
            {notice ? <p role="status" className="mt-2 text-center text-[11px] font-medium text-expense">{notice}</p> : null}
          </section>

          <section aria-labelledby="offline-balance-heading" className="mt-8">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p id="offline-balance-heading" className="text-sm font-medium text-muted-foreground">Total balance</p>
                {isLoading ? <Skeleton className="mt-2 h-11 w-48" /> : (
                  <p className="mt-2 font-sans text-[38px] font-semibold leading-none tracking-[-0.05em] tabular-nums">
                    <span className="mr-2 text-[16px] tracking-normal text-muted-foreground">{currency}</span>{formatAmount(totalBalance)}
                  </p>
                )}
              </div>
              {queuedCount ? (
                <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-info-soft px-2.5 py-1 text-[11px] font-semibold text-info">
                  <CloudUpload aria-hidden="true" className="size-3.5" />
                  {failedCount ? `${failedCount} needs attention` : `${pendingCount} waiting`}
                </span>
              ) : null}
            </div>
          </section>

          <section aria-label="Current month overview" className="mt-7 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-[14px] border border-border bg-card">
            {[
              { label: "Income", value: income, icon: ArrowDownLeft, tone: "text-income bg-income-soft" },
              { label: "Expenses", value: expenses, icon: ArrowUpRight, tone: "text-expense bg-expense-soft" },
              { label: "Savings", value: savings, icon: Landmark, tone: "text-primary bg-primary-soft" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div className="min-w-0 px-3 py-4" key={item.label}>
                  <span className={`flex size-8 items-center justify-center rounded-[9px] ${item.tone}`}><Icon aria-hidden="true" className="size-4" /></span>
                  <p className="mt-3 truncate text-[11px] font-medium text-muted-foreground">{item.label}</p>
                  <p className="mt-1 truncate text-[15px] font-semibold tabular-nums">{formatAmount(item.value)}</p>
                </div>
              );
            })}
          </section>

          <section aria-labelledby="offline-activity-heading" className="mt-9">
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <p className="text-[13px] font-medium text-muted-foreground">{monthLabel}</p>
                <h2 id="offline-activity-heading" className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">Activity</h2>
              </div>
              <p className="text-right text-[11px] font-medium text-muted-foreground">Current month only<br /><span className="font-semibold text-primary">Stored on device</span></p>
            </div>

            {isLoading ? <ListDataSkeleton rows={4} /> : error ? (
              <div role="alert" className="mt-4 rounded-[14px] border border-expense/25 bg-expense-soft p-4 text-sm text-expense">{error}</div>
            ) : snapshot.transactions.length === 0 ? (
              <div className="mt-4 rounded-[16px] border border-dashed border-border-strong bg-card px-5 py-10 text-center">
                <CloudOff aria-hidden="true" className="mx-auto size-7 text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold">No transactions this month</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">You can add one now—even without internet.</p>
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-[14px] border border-border bg-card">
                {snapshot.transactions.map((transaction, index) => {
                  const positive = transaction.type === "income";
                  return (
                    <article key={transaction.id} className={`flex items-center gap-3 px-4 py-3.5 ${index ? "border-t border-border" : ""}`}>
                      <TransactionIcon transaction={transaction} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="truncate text-sm font-semibold">{transaction.title}</h3>
                          <p className={`shrink-0 text-sm font-semibold tabular-nums ${positive ? "text-income" : transaction.type === "transfer" ? "text-info" : "text-expense"}`}>{positive ? "+" : transaction.type === "transfer" ? "" : "−"}{transaction.accountCurrency} {formatAmount(transaction.amount)}</p>
                        </div>
                        <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="truncate">{transaction.notes || transaction.categoryName || transaction.type}</span>
                          <span aria-hidden="true">·</span>
                          <span className="shrink-0">{transaction.accountName}</span>
                          {transaction.syncStatus !== "synced" ? <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 font-semibold ${transaction.syncStatus === "failed" ? "bg-expense-soft text-expense" : "bg-info-soft text-info"}`}>{transaction.syncStatus === "failed" ? "Needs attention" : "Waiting to sync"}</span> : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {notice && notice.startsWith("Saved") ? <div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background shadow-lg">{notice}</div> : null}
      <button type="button" onClick={() => setComposerOpen(true)} aria-label="Add offline transaction" disabled={snapshot.accounts.length === 0} className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 flex size-14 items-center justify-center rounded-[16px] border border-primary-hover/20 bg-primary text-primary-foreground shadow-[0_10px_28px_rgb(53_107_104_/_0.28)] disabled:opacity-45 sm:right-[max(1.25rem,calc((100vw-720px)/2+1.25rem))]">
        <Plus aria-hidden="true" className="size-6" />
      </button>
      <OfflineTransactionComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        accounts={snapshot.accounts}
        categories={snapshot.categories}
        savingsInstruments={snapshot.savingsInstruments}
        onSaved={() => {
          setNotice("Saved offline — queued for sync");
          window.setTimeout(() => setNotice(""), 2800);
        }}
      />
    </>
  );
}
