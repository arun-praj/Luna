"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeftRight,
  AlertCircle,
  Banknote,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  HandCoins,
  Layers3,
  LoaderCircle,
  Menu,
  Plus,
  ReceiptText,
  Search,
  Store,
  Tags,
  Target,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import type { Transaction } from "@/lib/transactions";
import { AccountAvatar } from "@/components/accounts/account-avatar";
import { authenticatedFetch, notifyTransactionsChanged } from "@/lib/auth-client";
import { addMoney, sumMoney } from "@/lib/money";
import { navigateWithRouteExit } from "@/lib/route-motion";
import type { ApiTransaction } from "@/components/transactions/transaction-list";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { formatMoney, MoneyEditor } from "@/components/money/money-editor";
import { AuthenticatedImage } from "@/components/ui/authenticated-image";
import { BudgetStatusBadge } from "@/components/shadcn-space/badge/badge-09";
import { getCategoryForeground, getCategoryIcon } from "@/lib/category-appearance";
import { CategoryIconPicker } from "@/components/categories/category-icon-picker";
import {
  getAccountBackgroundColor,
  getAccountForeground,
} from "@/lib/account-appearance";
import { Calendar } from "@/components/ui/calendar";
import { useAnimatedVisibility } from "@/lib/use-animated-visibility";
import { useUnsavedChangesGuard } from "@/components/ui/unsaved-changes-dialog";
import type { Budget } from "@/lib/budgets";
import type {
  CategoryBudgetPreview,
  CategoryOption,
  IncomeGoalOption,
  MerchantOption,
  SavingsInstrumentOption,
  SplitDraft,
  TransactionKind,
} from "./transaction-detail/types";
import {
  BUDGET_PERIODS,
  INCOME_GOALS_PER_PAGE,
  LAST_ACCOUNT_KEY,
  tagOptions,
  transactionTypes,
} from "./transaction-detail/types";
import {
  budgetProgressColor,
  categoryForeground,
  displayAccountName,
  serializeTransactionDraft,
  sortTransactionAccounts,
  transferTitle,
} from "./transaction-detail/selectors";
import { orderCategoryOptions } from "./transaction-detail/category-ordering";
import {
  createTransactionDraftState,
  localDateValue,
  localTimeValue,
  transactionDraftReducer,
  type TransactionDraftAction,
  type TransactionDraftState,
} from "./transaction-detail/reducer";
import { LoadingBlock, SavingsInstrumentAvatar } from "./transaction-detail/presentation";
import { isLoanTransaction } from "./transaction-detail/presentation-rules";
import { TransactionTypeForm, type SelectedTransactionType } from "./transaction-detail/transaction-type-forms";

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
  const [draft, dispatchDraft] = React.useReducer(
    transactionDraftReducer,
    createTransactionDraftState({
      title: isNew ? "" : transaction.description,
      description: isNew
        ? ""
        : transaction.kind === "income"
          ? `Received through ${transaction.account}`
          : transaction.kind === "transfer"
            ? `Moved from ${transaction.account} to ${transaction.destinationAccount}`
            : `Paid from ${transaction.account}`,
      date: transaction.date,
      kind: isNew ? (initialKind ?? "") : transaction.kind,
      amount: String(transaction.amount),
    }),
  );
  const setDraftField = React.useCallback(<K extends keyof TransactionDraftState>(field: K, next: React.SetStateAction<TransactionDraftState[K]>) => {
    dispatchDraft({ type: "set-field", field, value: next } as TransactionDraftAction);
  }, []);
  const title = draft.title;
  const description = draft.description;
  const date = draft.date;
  const time = draft.time;
  const kind = draft.kind;
  const category = draft.category;
  const categoryId = draft.categoryId;
  const splits = draft.splits;
  const merchantName = draft.merchantName;
  const tags = draft.tags;
  const accountId = draft.accountId;
  const savingsInstrumentId = draft.savingsInstrumentId;
  const transferToAccountId = draft.transferToAccountId;
  const amount = draft.amount;
  const receiptImageUrl = draft.receiptImageUrl;
  const setTitle = React.useCallback((value: React.SetStateAction<string>) => setDraftField("title", value), [setDraftField]);
  const setDescription = React.useCallback((value: React.SetStateAction<string>) => setDraftField("description", value), [setDraftField]);
  const setDate = React.useCallback((value: React.SetStateAction<string>) => setDraftField("date", value), [setDraftField]);
  const setTime = React.useCallback((value: React.SetStateAction<string>) => setDraftField("time", value), [setDraftField]);
  const setKind = React.useCallback((value: TransactionKind) => dispatchDraft({ type: "set-kind", value }), []);
  const setCategory = React.useCallback((value: React.SetStateAction<string>) => setDraftField("category", value), [setDraftField]);
  const setCategoryId = React.useCallback((value: React.SetStateAction<string | null>) => setDraftField("categoryId", value), [setDraftField]);
  const setSplits = React.useCallback((value: React.SetStateAction<SplitDraft[]>) => setDraftField("splits", value), [setDraftField]);
  const setMerchantName = React.useCallback((value: React.SetStateAction<string>) => setDraftField("merchantName", value), [setDraftField]);
  const setTags = React.useCallback((value: React.SetStateAction<string[]>) => setDraftField("tags", value), [setDraftField]);
  const setAccountId = React.useCallback((value: React.SetStateAction<string>) => setDraftField("accountId", value), [setDraftField]);
  const setSavingsInstrumentId = React.useCallback((value: React.SetStateAction<string | null>) => setDraftField("savingsInstrumentId", value), [setDraftField]);
  const setTransferToAccountId = React.useCallback((value: React.SetStateAction<string>) => setDraftField("transferToAccountId", value), [setDraftField]);
  const setAmount = React.useCallback((value: React.SetStateAction<string>) => setDraftField("amount", value), [setDraftField]);
  const setReceiptImageUrl = React.useCallback((value: React.SetStateAction<string | null>) => setDraftField("receiptImageUrl", value), [setDraftField]);
  const [receiptFile, setReceiptFile] = React.useState<File | null>(null);
  const receiptPreviewUrl = React.useMemo(
    () => receiptFile ? URL.createObjectURL(receiptFile) : null,
    [receiptFile],
  );
  const [receiptError, setReceiptError] = React.useState("");
  const [typeOpen, setTypeOpen] = React.useState(false);
  const [splitEditorOpen, setSplitEditorOpen] = React.useState(false);
  const [splitAmountIndex, setSplitAmountIndex] = React.useState<number | null>(null);
  const [splitCategoryIndex, setSplitCategoryIndex] = React.useState<number | null>(null);
  const [categoryOptions, setCategoryOptions] = React.useState<CategoryOption[]>([]);
  const [categoryBudgets, setCategoryBudgets] = React.useState<Budget[]>([]);
  const [categorySearch, setCategorySearch] = React.useState("");
  const [categoryCreateOpen, setCategoryCreateOpen] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryIcon, setNewCategoryIcon] = React.useState("Wallet");
  const [categoryCreateError, setCategoryCreateError] = React.useState("");
  const [isCreatingCategory, setIsCreatingCategory] = React.useState(false);
  const [savedTagOptions, setSavedTagOptions] = React.useState<string[]>([]);
  const [merchantOptions, setMerchantOptions] = React.useState<MerchantOption[]>([]);
  const [merchantSearch, setMerchantSearch] = React.useState("");
  const [newTag, setNewTag] = React.useState("");
  const [tagError, setTagError] = React.useState("");
  const [picker, setPicker] = React.useState<"category" | "merchant" | "tags" | null>(null);
  const [accountOptions, setAccountOptions] = React.useState<Array<{ id: string; name: string; type: string; currency: string; icon: string | null; backgroundColor: string | null; currentBalance: number; allowNegativeBalance: boolean; isDefault?: boolean }>>([]);
  const [goalOptions, setGoalOptions] = React.useState<IncomeGoalOption[]>([]);
  const [incomeAllocations, setIncomeAllocations] = React.useState<Record<string, string>>({});
  const [goalsExpanded, setGoalsExpanded] = React.useState(false);
  const [goalsPage, setGoalsPage] = React.useState(0);
  const [allocationGoalId, setAllocationGoalId] = React.useState<string | null>(null);
  const [savingsOptions, setSavingsOptions] = React.useState<SavingsInstrumentOption[]>([]);
  const [amountOpen, setAmountOpen] = React.useState(false);
  const [dateOpen, setDateOpen] = React.useState(false);
  const dateTransition = useAnimatedVisibility(dateOpen);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveAttempted, setSaveAttempted] = React.useState(false);
  const [loadError, setLoadError] = React.useState("");
  const [transactionLoading, setTransactionLoading] = React.useState(!isNew);
  const [loanContext, setLoanContext] = React.useState<Pick<ApiTransaction, "loanId" | "loanComponent">>({ loanId: null, loanComponent: null });
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const receiptInputRef = React.useRef<HTMLInputElement>(null);
  const splitSnapshotRef = React.useRef<SplitDraft[]>([]);
  const initialDraftRef = React.useRef<string | null>(null);
  const [hasUserEdited, setHasUserEdited] = React.useState(false);
  const hasUserEditedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isNew || hasUserEditedRef.current) return;
    const now = new Date();
    dispatchDraft({ type: "set-field", field: "date", value: localDateValue(now) });
    dispatchDraft({ type: "set-field", field: "time", value: localTimeValue(now) });
  }, [isNew]);

  const markUserEdited = React.useCallback(() => {
    hasUserEditedRef.current = true;
    setHasUserEdited(true);
  }, []);

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
        const [accountResponse, categoryResponse, tagResponse, merchantResponse, savingsResponse, goalResponse] = await Promise.all([
          authenticatedFetch("/api/accounts"),
          authenticatedFetch("/api/categories"),
          authenticatedFetch("/api/tags"),
          authenticatedFetch("/api/merchants"),
          authenticatedFetch("/api/savings/instruments"),
          authenticatedFetch("/api/goals"),
        ]);
        const accountResult = (await accountResponse.json()) as { accounts?: Array<{ id: string; name: string; type: string; currency: string; icon: string | null; backgroundColor: string | null; currentBalance: number; allowNegativeBalance: boolean; isDefault?: boolean }> };
        const categoryResult = (await categoryResponse.json()) as { categories?: CategoryOption[] };
        const tagResult = tagResponse.ok ? (await tagResponse.json()) as { tags?: Array<{ name: string }> } : { tags: [] };
        const merchantResult = merchantResponse.ok ? (await merchantResponse.json()) as { merchants?: Array<{ name: string | null; lastUsedAt: string; usageCount: number | string }> } : { merchants: [] };
        const savingsResult = savingsResponse.ok ? (await savingsResponse.json()) as { instruments?: SavingsInstrumentOption[] } : { instruments: [] };
        const goalResult = goalResponse.ok ? (await goalResponse.json()) as { goals?: IncomeGoalOption[] } : { goals: [] };
        if (!active) return;
        const storedAccountId = isNew ? window.localStorage.getItem(LAST_ACCOUNT_KEY) : null;
        const orderedAccounts = sortTransactionAccounts(accountResult.accounts ?? [], storedAccountId);
        setAccountOptions(orderedAccounts);
        setCategoryOptions(categoryResult.categories ?? []);
        setSavedTagOptions(tagResult.tags?.map((tag) => tag.name) ?? []);
        setMerchantOptions(merchantResult.merchants?.flatMap((merchant) => merchant.name ? [{ name: merchant.name, lastUsedAt: merchant.lastUsedAt, usageCount: Number(merchant.usageCount) || 0 }] : []) ?? []);
        setSavingsOptions(savingsResult.instruments ?? []);
        setGoalOptions(goalResult.goals ?? []);

        if (!isNew) {
          const response = await authenticatedFetch(`/api/transactions/${transaction.id}`);
          if (!response.ok) throw new Error("Unable to load transaction");
          const result = (await response.json()) as { transaction?: ApiTransaction };
          const record = result.transaction;
          if (!record || !active) {
            if (active) setTransactionLoading(false);
            return;
          }
          const loadedTitle = record.title || record.categoryName || "Transaction";
          const loadedMerchantName = record.merchantName ?? "";
          const loadedDescription = record.notes ?? "";
          const loadedReceiptImageUrl = record.receiptImageUrl ?? null;
          const loadedTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(record.transactionAt || record.createdAt || `${record.date}T12:00:00.000Z`));
          const loadedSplits = (record.splits ?? []).map((split) => ({
            id: window.crypto.randomUUID(),
            categoryId: split.categoryId,
            amount: String(split.amount),
            note: split.note ?? null,
          }));
          const loadedTags = record.tags ?? [];
          const loadedTransferToAccountId = record.transferToAccountId ?? "";
          const loadedSavingsInstrumentId = record.savingsInstrumentId ?? null;
          const loadedAmount = String(record.amount);
          setTitle(loadedTitle);
          setMerchantName(loadedMerchantName);
          setDescription(loadedDescription);
          setReceiptImageUrl(loadedReceiptImageUrl);
          setDate(record.date);
          setTime(loadedTime);
          setKind(record.type);
          setCategory(record.categoryName ?? "");
          setCategoryId(record.categoryId);
          setSplits(loadedSplits);
          setTags(loadedTags);
          setAccountId(record.accountId);
          setTransferToAccountId(loadedTransferToAccountId);
          setSavingsInstrumentId(loadedSavingsInstrumentId);
          setAmount(loadedAmount);
          setLoanContext({ loanId: record.loanId, loanComponent: record.loanComponent });
          const loadedDraft = serializeTransactionDraft({ title: loadedTitle, description: loadedDescription, date: record.date, time: loadedTime, kind: record.type, category: record.categoryName ?? "", categoryId: record.categoryId, splits: loadedSplits, merchantName: loadedMerchantName, tags: loadedTags, accountId: record.accountId, savingsInstrumentId: loadedSavingsInstrumentId, transferToAccountId: loadedTransferToAccountId, amount: loadedAmount, receiptImageUrl: loadedReceiptImageUrl, receiptFileKey: null });
          initialDraftRef.current = loadedDraft;
          setTransactionLoading(false);
        } else {
          if (initialKind) {
            setKind(initialKind);
            if (guidedNew && orderedAccounts[0]) {
              setAccountId(orderedAccounts[0].id);
              setAmountOpen(true);
            }
          }
          setTransactionLoading(false);
        }
      } catch {
        if (active) {
          setTransactionLoading(false);
          setLoadError("We could not load this transaction. Please try again.");
        }
      }
    };
    void load();
    return () => { active = false; };
  }, [guidedNew, initialKind, isNew, setAccountId, setAmount, setCategory, setCategoryId, setDate, setDescription, setKind, setMerchantName, setReceiptImageUrl, setSavingsInstrumentId, setSplits, setTags, setTime, setTitle, setTransferToAccountId, transaction.id]);

  React.useEffect(() => {
    let active = true;
    if (kind !== "expense") {
      return () => { active = false; };
    }
    void Promise.all(BUDGET_PERIODS.map(async (budgetPeriod) => {
      const response = await authenticatedFetch(`/api/budgets?period=${budgetPeriod}`);
      if (!response.ok) return [];
      const result = await response.json() as { budgets?: Budget[] };
      return result.budgets ?? [];
    })).then((groups) => {
      if (active) setCategoryBudgets(groups.flat().filter((budget) => Boolean(budget.categoryId)));
    }).catch(() => {
      if (active) setCategoryBudgets([]);
    });
    return () => { active = false; };
  }, [kind]);

  React.useEffect(() => {
    if (!isNew || initialDraftRef.current !== null || !accountOptions.length) return;
    const newDraft = serializeTransactionDraft({ title, description, date, time, kind, category, categoryId, splits, merchantName, tags, accountId, savingsInstrumentId, transferToAccountId, amount, receiptImageUrl, receiptFileKey: receiptFile ? `${receiptFile.name}:${receiptFile.size}:${receiptFile.lastModified}` : null });
    initialDraftRef.current = newDraft;
  }, [accountOptions.length, amount, category, categoryId, date, description, isNew, kind, merchantName, receiptFile, receiptImageUrl, savingsInstrumentId, splits, tags, time, title, transferToAccountId, accountId]);

  React.useEffect(() => {
    if (!receiptPreviewUrl) return;
    return () => URL.revokeObjectURL(receiptPreviewUrl);
  }, [receiptPreviewUrl]);

  const selectedAccount = accountOptions.find((account) => account.id === accountId);
  const destinationAccount = accountOptions.find((account) => account.id === transferToAccountId);
  const incomeAmount = kind === "income" ? Math.max(0, Number(amount) || 0) : 0;
  const incomeAllocationEntries = Object.entries(incomeAllocations)
    .map(([goalId, value]) => ({ goalId, amount: Number(value) }))
    .filter(({ amount }) => Number.isFinite(amount) && amount > 0);
  const allocatedIncomeTotal = sumMoney(incomeAllocationEntries.map(({ amount }) => amount));
  const usableIncomeGoals = goalOptions.filter((goal) => goal.status === "active" && goal.accountId && addMoney(goal.targetAmount, -goal.allocatedAmount) > 0);
  const selectedAllocationCount = incomeAllocationEntries.filter(({ goalId }) => usableIncomeGoals.some((goal) => goal.id === goalId)).length;
  const goalPageCount = Math.max(1, Math.ceil(usableIncomeGoals.length / INCOME_GOALS_PER_PAGE));
  const visibleIncomeGoals = usableIncomeGoals.slice(goalsPage * INCOME_GOALS_PER_PAGE, (goalsPage + 1) * INCOME_GOALS_PER_PAGE);
  const selectedAllocationGoal = allocationGoalId ? usableIncomeGoals.find((goal) => goal.id === allocationGoalId) ?? null : null;
  const getAllocationAmountError = (goalId: string, value: string) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return "";
    const goal = usableIncomeGoals.find((option) => option.id === goalId);
    if (!goal) return "Choose an active goal account.";
    const remainingGoalAmount = addMoney(goal.targetAmount, -goal.allocatedAmount);
    if (numericValue > remainingGoalAmount) {
      return `${goal.name} needs only ${formatMoney(String(remainingGoalAmount))} ${selectedAccount?.currency ?? "NPR"} more.`;
    }
    const otherAllocationsTotal = sumMoney(incomeAllocationEntries.filter(({ goalId: existingGoalId }) => existingGoalId !== goalId).map(({ amount }) => amount));
    const nextTotal = addMoney(otherAllocationsTotal, numericValue);
    return nextTotal > incomeAmount
      ? `This allocation would exceed this income by ${formatMoney(String(addMoney(nextTotal, -incomeAmount)))} ${selectedAccount?.currency ?? "NPR"}.`
      : "";
  };
  const incomeAllocationError = isNew && kind === "income" && allocatedIncomeTotal > incomeAmount
    ? `Allocations exceed this income by ${formatMoney(String(addMoney(allocatedIncomeTotal, -incomeAmount)))} ${selectedAccount?.currency ?? "NPR"}.`
    : incomeAllocationEntries.map(({ goalId, amount }) => {
        const goal = goalOptions.find((option) => option.id === goalId);
        const remaining = goal ? addMoney(goal.targetAmount, -goal.allocatedAmount) : 0;
        return goal && amount > remaining
          ? `${goal.name} needs only ${formatMoney(String(Math.max(0, remaining)))} ${selectedAccount?.currency ?? "NPR"} more.`
          : "";
      }).find(Boolean) ?? "";
  const availableIncomeRemaining = addMoney(incomeAmount, -allocatedIncomeTotal);
  const transferCurrencyError = kind === "transfer" && selectedAccount && destinationAccount && selectedAccount.currency !== destinationAccount.currency
    ? `Cross-currency transfers are not supported yet. Both accounts must use ${selectedAccount.currency}.`
    : "";
  const getBalanceError = (value: string) => {
    const numericValue = Number(value);
    if (!isNew || !selectedAccount || selectedAccount.allowNegativeBalance || !Number.isFinite(numericValue)) return "";
    const projectedBalance = addMoney(selectedAccount.currentBalance, kind === "income" || kind === "adjust_balance" ? numericValue : -numericValue);
    return projectedBalance < 0
      ? `This transaction would make ${selectedAccount.name} negative. Enable Allow negative balance in account settings or lower the amount.`
      : "";
  };
  const getTransferBalanceError = (value: string) => {
    const numericValue = Number(value);
    if (kind !== "transfer" || !selectedAccount || !Number.isFinite(numericValue) || numericValue <= 0) return "";
    return addMoney(selectedAccount.currentBalance, -numericValue) < 0
      ? `Not enough money in ${selectedAccount.name}. Available balance: ${formatMoney(String(selectedAccount.currentBalance))} ${selectedAccount.currency}.`
      : "";
  };
  const balanceError = getBalanceError(amount);
  const splitTotal = sumMoney(splits.map((split) => Number(split.amount) || 0));
  const splitRemaining = addMoney(Number(amount) || 0, -splitTotal);
  const splitError = splits.length
    ? splits.length < 2
      ? "Add at least two split categories."
      : splits.some((split) => !split.categoryId)
        ? "Choose a category for every split."
        : splits.some((split) => !Number.isFinite(Number(split.amount)) || Number(split.amount) <= 0)
          ? "Enter an amount greater than zero for every split."
          : new Set(splits.map((split) => split.categoryId)).size !== splits.length
            ? "Use each category only once."
            : splitRemaining !== 0
              ? `Allocate the remaining ${formatMoney(String(Math.abs(splitRemaining)))} ${selectedAccount?.currency ?? "NPR"}.`
              : ""
    : "";

  const validationErrors = {
    type: !kind ? "Choose whether this is an expense, income, or transfer." : "",
    title: !title.trim() ? `Add a title for this ${titleLabel.toLowerCase().replace(" title", "")}.` : "",
    amount:
      !Number.isFinite(Number(amount)) || (kind === "adjust_balance" ? Number(amount) === 0 : Number(amount) <= 0)
        ? kind === "adjust_balance" ? "Enter a non-zero balance adjustment." : "Enter an amount greater than NPR 0.00."
        : "",
    category: kind === "transfer" || category || splits.length ? "" : "Choose a category for this transaction.",
    splits: splitError,
    account: !accountId ? "Choose the account this transaction belongs to." : "",
    transfer: kind === "transfer"
      ? !transferToAccountId ? "Choose the account receiving the transfer." : transferCurrencyError
      : "",
    savingsInstrument: kind === "savings" && !savingsInstrumentId ? "Choose the saving instrument receiving this contribution." : "",
    balance: balanceError,
    incomeAllocation: incomeAllocationError,
  };
  const visibleNonTitleErrors = saveAttempted
    ? [
        validationErrors.type,
        validationErrors.amount,
        validationErrors.category,
        validationErrors.splits,
        validationErrors.account,
        validationErrors.transfer,
        validationErrors.savingsInstrument,
        validationErrors.incomeAllocation,
      ].filter(Boolean)
    : [];

  const draftSnapshot = serializeTransactionDraft({ title, description, date, time, kind, category, categoryId, splits, merchantName, tags, accountId, savingsInstrumentId, transferToAccountId, amount, receiptImageUrl, receiptFileKey: receiptFile ? `${receiptFile.name}:${receiptFile.size}:${receiptFile.lastModified}` : null });
  const isDirty = React.useCallback(
    () => hasUserEditedRef.current || hasUserEdited || (initialDraftRef.current !== null && draftSnapshot !== initialDraftRef.current),
    [draftSnapshot, hasUserEdited],
  );
  const { requestDiscard, discardDialog } = useUnsavedChangesGuard(isDirty());
  const receiptSource = receiptPreviewUrl ?? receiptImageUrl;

  const loanTransaction = isLoanTransaction(loanContext);
  const amountTone =
    loanTransaction
      ? "text-primary"
      : kind === "income"
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
  const selectedType: SelectedTransactionType | undefined =
    loanTransaction
      ? {
          value: kind || "transfer",
          label: "Loan",
          description: "Recorded from loan activity",
          icon: HandCoins,
          iconClassName: "bg-primary-soft text-primary",
          foregroundClassName: "text-primary",
        }
      : transactionTypes.find((type) => type.value === kind) ??
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
  const categoryBudgetPreviews = React.useMemo(() => {
    const previews = new Map<string, CategoryBudgetPreview>();
    if (kind !== "expense") return previews;
    const draftAmount = Number.isFinite(Number(amount)) ? Math.max(0, Number(amount)) : 0;
    for (const budget of categoryBudgets) {
      if (!budget.categoryId || !(budget.limitAmount > 0)) continue;
      const existingContribution = !isNew && transaction.kind === "expense" && transaction.category === budget.category?.name
        ? transaction.amount
        : 0;
      const projectedSpent = addMoney(budget.spent, addMoney(draftAmount, -existingContribution));
      const percentage = Math.max(0, Math.round((projectedSpent / budget.limitAmount) * 100));
      const tone = percentage >= 100 ? "danger" : percentage >= 90 ? "warning" : "safe";
      const current = previews.get(budget.categoryId);
      if (!current || percentage > current.percentage) previews.set(budget.categoryId, { percentage, tone });
    }
    return previews;
  }, [amount, categoryBudgets, isNew, kind, transaction.amount, transaction.category, transaction.kind]);
  const categoryIcon = getCategoryIcon(selectedCategory?.icon, selectedCategory?.name);
  const titleFocusMode = guidedNew && Boolean(categoryId || splits.length) && !title.trim();
  const guidedPickerHandoff = guidedNew && amountOpen && picker === "category";
  const categoryPickerOptions = React.useMemo(() => {
    const selectedCategoryId = splitCategoryIndex === null ? categoryId : splits[splitCategoryIndex]?.categoryId ?? null;
    const search = categorySearch.trim().toLocaleLowerCase();
    const visibleOptions = categoryOptions.filter((option) =>
      option.name.toLocaleLowerCase().includes(search),
    );
    return orderCategoryOptions(visibleOptions, selectedCategoryId, kind);
  }, [categoryId, categoryOptions, categorySearch, kind, splitCategoryIndex, splits]);

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
    if (splitCategoryIndex !== null) {
      setSplits((current) => current.map((split, index) => index === splitCategoryIndex ? { ...split, categoryId: result.category!.id } : split));
      setSplitCategoryIndex(null);
    } else {
      setSplits([]);
      setCategory(result.category.name);
      setCategoryId(result.category.id);
    }
    finishCategorySelection();
    setNewCategoryName("");
    setNewCategoryIcon("Wallet");
    setIsCreatingCategory(false);
  }

  function finishCategorySelection() {
    const wasSplitSelection = splitCategoryIndex !== null;
    setCategorySearch("");
    setCategoryCreateOpen(false);
    setCategoryCreateError("");
    setPicker(null);
    setSplitCategoryIndex(null);
    if (wasSplitSelection) setSplitEditorOpen(true);
    if (guidedNew) setAmountOpen(false);
    if (guidedNew && !wasSplitSelection) {
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
    let uploadedReceiptUrl: string | null = null;
    let receiptCommitted = !receiptFile;
    const discardUploadedReceipt = async () => {
      if (!uploadedReceiptUrl || receiptCommitted) return;
      await authenticatedFetch(uploadedReceiptUrl, { method: "DELETE" }).catch(() => undefined);
    };
    try {
      let nextReceiptImageUrl = receiptImageUrl;
      if (receiptFile) {
        const formData = new FormData();
        formData.set("file", receiptFile);
        const uploadResponse = await authenticatedFetch("/api/uploads/transaction-receipts", {
          method: "POST",
          body: formData,
        });
        const uploadResult = (await uploadResponse.json().catch(() => null)) as { url?: string; error?: string } | null;
        if (!uploadResponse.ok || !uploadResult?.url) {
          setReceiptError(uploadResult?.error ?? "We could not upload this receipt. Try another image.");
          setSaving(false);
          return;
        }
        nextReceiptImageUrl = uploadResult.url;
        uploadedReceiptUrl = uploadResult.url;
        setReceiptImageUrl(nextReceiptImageUrl);
      }
      const payload = {
        accountId,
        type: kind as Exclude<TransactionKind, "">,
        amount: Number(amount),
        categoryId: splits.length ? null : categoryId,
        splits: splits.length ? splits.map((split) => ({ categoryId: split.categoryId, amount: Number(split.amount), note: split.note ?? null })) : undefined,
        title: title.trim(),
        merchantName: merchantName.trim() || null,
        notes: description.trim() || null,
        tags,
        receiptImageUrl: nextReceiptImageUrl,
        date,
        transactionAt: new Date(`${date}T${time}:00`).toISOString(),
        transferToAccountId: kind === "transfer" ? transferToAccountId : null,
        savingsInstrumentId: kind === "savings" ? savingsInstrumentId : null,
      };
      const response = await authenticatedFetch(isNew ? "/api/transactions" : `/api/transactions/${transaction.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        await discardUploadedReceipt();
        setLoadError(result?.error ?? "We could not save this transaction. Check the details and try again.");
        setSaving(false);
        return;
      }
      receiptCommitted = true;
      if (isNew && kind === "income" && incomeAllocationEntries.length) {
        for (const allocation of incomeAllocationEntries) {
          const goal = goalOptions.find((option) => option.id === allocation.goalId);
          if (!goal) continue;
          const allocationResponse = await authenticatedFetch(`/api/goals/${goal.id}/actions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "contribute",
              amount: allocation.amount,
              accountId,
              notes: `Allocated from ${title.trim()}`,
            }),
          });
          if (!allocationResponse.ok) {
            const result = (await allocationResponse.json().catch(() => null)) as { error?: string } | null;
            setLoadError(`Income saved, but the allocation for ${goal.name} could not be completed. ${result?.error ?? "Try allocating it from the goal page."}`);
            setSaving(false);
            return;
          }
        }
      }
      notifyTransactionsChanged();
      setSaved(true);
      navigateWithRouteExit(() => router.back());
    } catch {
      await discardUploadedReceipt();
      setLoadError("We could not save this transaction. Check your connection and try again.");
      setSaving(false);
    }
  };

  const chooseReceipt = (file: File | null) => {
    setReceiptError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setReceiptError("Use a JPG, PNG, or WebP receipt image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setReceiptError("The receipt image must be smaller than 5 MB.");
      return;
    }
    setReceiptFile(file);
  };

  const openAmountEditor = () => {
    setAmountOpen(true);
  };

  const selectTransferSource = (nextAccountId: string) => {
    setAccountId(nextAccountId);
    window.localStorage.setItem(LAST_ACCOUNT_KEY, nextAccountId);
    if (transferToAccountId === nextAccountId) setTransferToAccountId("");
  };

  const selectTransferDestination = (nextAccountId: string) => {
    setTransferToAccountId(nextAccountId);
  };

  const applyTransferMetadata = (nextAmount: string) => {
    setCategory("Transfer");
    setCategoryId(null);
    setTitle(transferTitle(nextAmount, selectedAccount?.name, destinationAccount?.name, selectedAccount?.currency ?? "NPR"));
  };

  const openCategoryPicker = (splitIndex: number | null = null) => {
    setCategorySearch("");
    setCategoryCreateOpen(false);
    setCategoryCreateError("");
    setSplitCategoryIndex(splitIndex);
    if (splitIndex !== null) setSplitEditorOpen(false);
    setPicker("category");
  };

  const openSplitEditor = () => {
    splitSnapshotRef.current = splits.map((split) => ({ ...split }));
    if (!splits.length) {
      const total = Number(amount) || 0;
      const firstAmount = Math.round((total / 2) * 100) / 100;
      setSplits([
        { id: window.crypto.randomUUID(), categoryId: categoryId ?? "", amount: String(firstAmount) },
        { id: window.crypto.randomUUID(), categoryId: "", amount: String(addMoney(total, -firstAmount)) },
      ]);
    }
    setPicker(null);
    setSplitEditorOpen(true);
  };

  const cancelSplitEditor = () => {
    setSplits(splitSnapshotRef.current.map((split) => ({ ...split })));
    setSplitEditorOpen(false);
  };

  const finishSplitEditor = () => {
    setCategory("");
    setCategoryId(null);
    setSplitEditorOpen(false);
    if (guidedNew) window.requestAnimationFrame(() => titleInputRef.current?.focus());
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

  const transferAmountPicker = (
    <div className="space-y-3 rounded-[13px] border border-border bg-card px-3 py-3">
      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Move money from</p>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {accountOptions.map((option) => {
            const selected = accountId === option.id;
            const accountColor = getAccountBackgroundColor(option.backgroundColor, option.type);
            const accountForeground = getAccountForeground(accountColor, option.type);
            return (
              <button
                type="button"
                key={`transfer-source-${option.id}`}
                aria-pressed={selected}
                onClick={() => selectTransferSource(option.id)}
                style={{ backgroundColor: selected ? accountColor : undefined, borderColor: `${accountForeground}8c`, color: accountForeground }}
                className="flex min-h-14 shrink-0 items-center gap-2 rounded-[12px] border bg-background px-3 text-left text-sm font-semibold transition-colors hover:brightness-[0.98]"
              >
                <span className="flex size-9 shrink-0 overflow-hidden rounded-[9px]"><AccountAvatar icon={option.icon} name={option.name} type={option.type} backgroundColor={accountColor} size={36} /></span>
                <span className="flex min-w-0 flex-col items-start leading-tight"><span className="max-w-[130px] truncate">{displayAccountName(option.name)}</span><span className="mt-1 text-[11px] font-medium tabular-nums opacity-75">{formatMoney(String(option.currentBalance))} {option.currency}</span></span>
                {selected ? <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background"><Check aria-hidden="true" className="size-3.5 stroke-[3]" /></span> : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-t border-border pt-3">
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
                key={`transfer-destination-${option.id}`}
                aria-pressed={selected}
                disabled={incompatibleCurrency}
                onClick={() => selectTransferDestination(option.id)}
                title={incompatibleCurrency ? `Unavailable: this account uses ${option.currency}` : undefined}
                style={{ backgroundColor: selected ? accountForeground : undefined, borderColor: selected ? accountForeground : `${accountForeground}8c`, color: selected ? "#ffffff" : accountForeground }}
                className="flex min-h-14 shrink-0 items-center gap-2 rounded-[12px] border bg-background px-3 text-left text-sm font-semibold transition-colors hover:brightness-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="flex size-9 shrink-0 overflow-hidden rounded-[9px]"><AccountAvatar icon={option.icon} name={option.name} type={option.type} backgroundColor={accountColor} size={36} /></span>
                <span className="flex min-w-0 flex-col items-start leading-tight"><span className="max-w-[130px] truncate">{displayAccountName(option.name)}</span><span className="mt-1 text-[11px] font-medium tabular-nums opacity-75">{formatMoney(String(option.currentBalance))} {option.currency}</span></span>
                {selected ? <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/90 text-foreground"><Check aria-hidden="true" className="size-3.5 stroke-[3]" /></span> : null}
              </button>
            );
          })}
        </div>
        {transferCurrencyError ? <p className="mt-2 text-[11px] font-medium text-expense">{transferCurrencyError}</p> : null}
      </div>
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

  const amountEditorContent = transactionLoading ? (
    <div role="status" aria-label="Loading transaction amount" className="flex min-h-[132px] flex-col items-center justify-center border-t border-border px-4 py-5">
      <LoadingBlock className="h-12 w-40" />
      <LoadingBlock className="mt-3 h-4 w-28" />
    </div>
  ) : (
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
  );

  return (
    <main
      className="page-route-enter min-h-dvh bg-background"
      onInputCapture={markUserEdited}
    >
      <div className="mx-auto min-h-dvh w-full max-w-[720px] px-4 pb-6 sm:px-5">
        <StickyPageHeader className="-mx-4 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <button
            type="button"
            aria-label="Cancel and return to activity"
            onClick={(event) => {
              event.preventDefault();
              requestDiscard(() => navigateWithRouteExit(() => router.push("/")));
            }}
            className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
            <X aria-hidden="true" className="size-5" />
          </button>

          <TransactionTypeForm
            kind={kind}
            open={typeOpen}
            selectedType={selectedType}
            hasError={Boolean(saveAttempted && validationErrors.type)}
            locked={loanTransaction}
            onToggle={() => setTypeOpen((current) => !current)}
            onSelect={(nextKind) => {
              setKind(nextKind);
              setTypeOpen(false);
            }}
          />

          <button
            type="button"
            aria-label={transactionLoading ? "Loading transaction" : saving ? "Saving transaction" : "Save transaction"}
            disabled={saving || transactionLoading}
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
          {transactionLoading ? (
            <div role="status" aria-label="Loading transaction title" className="border-b border-border-strong pb-4">
              <LoadingBlock className="h-10 w-3/4 sm:h-12" />
            </div>
          ) : (
            <label>
              <span className="sr-only">{titleLabel}</span>
              <input
                ref={titleInputRef}
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  markUserEdited();
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
          )}

        </section>

        <div className={`transition-[filter,opacity] duration-300 ${titleFocusMode ? "pointer-events-none select-none blur-[3px] opacity-55" : ""}`}>

          {transactionLoading ? (
            <div role="status" aria-label="Loading transaction details" className="mt-5 flex flex-wrap items-center gap-2.5">
              <LoadingBlock className="h-11 w-52" />
              <LoadingBlock className="h-11 w-32" />
              <LoadingBlock className="h-11 w-28" />
            </div>
          ) : (
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (kind !== "transfer") openCategoryPicker();
              }}
              style={selectedCategory?.color ? { backgroundColor: selectedCategory.color, color: getCategoryForeground(selectedCategory.color), borderColor: `${getCategoryForeground(selectedCategory.color)}55` } : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-[11px] border px-3.5 text-sm font-semibold transition-colors ${
                saveAttempted && validationErrors.category
                  ? "border-expense bg-expense-soft text-expense"
                  : loanTransaction ? "cursor-default border-primary/25 bg-primary-soft text-primary" : kind === "transfer" ? "cursor-default border-info/25 bg-info-soft text-info" : "border-transparent bg-primary-soft text-primary"
              }`}
            >
              {loanTransaction
                ? <HandCoins aria-hidden="true" className="size-[18px]" />
                : kind === "transfer"
                  ? <ArrowLeftRight aria-hidden="true" className="size-[18px]" />
                : splits.length
                  ? <Layers3 aria-hidden="true" className="size-[18px]" />
                  : React.createElement(categoryIcon, { "aria-hidden": true, className: "size-[18px]" })}
              {loanTransaction ? "Loan" : kind === "transfer" ? "Transfer" : splits.length ? `Split across ${splits.length} categories` : category || "Choose category"}
              {kind === "transfer" ? null : <ChevronRight aria-hidden="true" className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setMerchantSearch("");
                setPicker("merchant");
              }}
              className={`flex min-h-11 items-center gap-2 rounded-[11px] border px-3.5 text-sm font-semibold ${merchantName ? "border-primary/25 bg-primary-soft text-primary" : "border-border-strong bg-card"}`}
            >
              <Store aria-hidden="true" className="size-4" />
              <span className="max-w-40 truncate">{merchantName || (kind === "income" ? "Add payer" : "Add merchant")}</span>
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
          )}
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

          {amountEditorContent}

          {transactionLoading ? (
            <div role="status" aria-label="Loading accounts" className="flex gap-2 overflow-hidden px-4 pb-4 pt-2">
              <LoadingBlock className="h-14 w-36 shrink-0" />
              <LoadingBlock className="h-14 w-36 shrink-0" />
              <LoadingBlock className="h-14 w-36 shrink-0" />
            </div>
          ) : (
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
          )}

          {!transactionLoading && kind === "transfer" ? (
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

          {!transactionLoading && kind === "savings" ? (
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

        </section>

        {isNew && kind === "income" && !transactionLoading ? (
          <section className="mt-5 rounded-[14px] border border-border bg-card p-4 shadow-[0_14px_40px_rgb(23_32_29_/_0.08)]">
            <button
              type="button"
              aria-expanded={goalsExpanded}
              onClick={() => setGoalsExpanded((current) => !current)}
              className="flex w-full items-center justify-between gap-3 rounded-[10px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                  <Target aria-hidden="true" className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[18px] font-semibold tracking-[-0.025em]">Allocate to goals</span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-muted-foreground">
                    {selectedAllocationCount ? `${selectedAllocationCount} goal${selectedAllocationCount === 1 ? "" : "s"} selected · Tap to edit` : "Tap to choose goals"}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`text-right text-sm font-semibold tabular-nums ${incomeAllocationError ? "text-expense" : "text-primary"}`}>
                  {formatMoney(String(allocatedIncomeTotal))} / {formatMoney(String(incomeAmount))} {selectedAccount?.currency ?? "NPR"}
                </span>
                <ChevronDown aria-hidden="true" className={`size-4 text-muted-foreground transition-transform ${goalsExpanded ? "rotate-180" : ""}`} />
              </span>
            </button>

            {goalsExpanded ? (
              <div className="mt-3 border-t border-border pt-3">
                {usableIncomeGoals.length ? (
                  <div className="space-y-2">
                    {visibleIncomeGoals.map((goal) => {
                      const remaining = addMoney(goal.targetAmount, -goal.allocatedAmount);
                      const value = incomeAllocations[goal.id] ?? "0";
                      return (
                        <button
                          type="button"
                          key={goal.id}
                          aria-label={`Set allocation for ${goal.name}`}
                          onClick={() => setAllocationGoalId(goal.id)}
                          className="flex min-h-[64px] w-full items-center gap-3 rounded-[12px] border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/45 hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-primary-soft text-primary">
                            <Target aria-hidden="true" className="size-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{goal.name}</span>
                            <span className="mt-0.5 block truncate text-[11px] font-medium text-muted-foreground">
                              {formatMoney(String(remaining))} {selectedAccount?.currency ?? "NPR"} remaining
                            </span>
                          </span>
                          <span className={`flex min-w-[86px] shrink-0 items-center justify-between gap-2 rounded-[9px] border px-2.5 py-2 text-right ${Number(value) > 0 ? "border-primary/35 bg-primary-soft/45 text-primary" : "border-border-strong bg-background text-muted-foreground"}`}>
                            <span className="text-[11px] font-semibold">{selectedAccount?.currency ?? "NPR"}</span>
                            <span className="text-sm font-semibold tabular-nums">{formatMoney(value)}</span>
                          </span>
                          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-[11px] border border-dashed border-border-strong bg-background px-3 py-3 text-xs font-medium leading-5 text-muted-foreground">
                    Create an active goal account first, then you can allocate part of this income to it.
                  </p>
                )}

                {goalPageCount > 1 ? (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={goalsPage === 0}
                      onClick={() => setGoalsPage((current) => Math.max(0, current - 1))}
                      className="flex min-h-9 items-center gap-1 rounded-[9px] border border-border bg-card px-2.5 text-xs font-semibold text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight aria-hidden="true" className="size-3.5 rotate-180" />Previous
                    </button>
                    <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{goalsPage + 1} / {goalPageCount}</span>
                    <button
                      type="button"
                      disabled={goalsPage >= goalPageCount - 1}
                      onClick={() => setGoalsPage((current) => Math.min(goalPageCount - 1, current + 1))}
                      className="flex min-h-9 items-center gap-1 rounded-[9px] border border-border bg-card px-2.5 text-xs font-semibold text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next<ChevronRight aria-hidden="true" className="size-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {incomeAllocationError ? (
              <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs font-medium leading-5 text-expense">
                <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                {incomeAllocationError}
              </p>
            ) : null}
            <p className="mt-2 text-[11px] font-medium text-muted-foreground">
              {availableIncomeRemaining < 0
                ? "Lower the allocations to continue."
                : `${formatMoney(String(availableIncomeRemaining))} ${selectedAccount?.currency ?? "NPR"} left from this income.`}
            </p>
          </section>
        ) : null}

        <section className="mt-5 rounded-[14px] border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Menu aria-hidden="true" className="size-[18px] text-primary" />
            <h2 className="text-sm font-semibold">Description</h2>
          </div>
          {transactionLoading ? (
            <div role="status" aria-label="Loading description" className="mt-3 space-y-2">
              <LoadingBlock className="h-5 w-11/12" />
              <LoadingBlock className="h-5 w-2/3" />
            </div>
          ) : (
            <textarea
              value={description}
              rows={2}
              onChange={(event) => {
                setDescription(event.target.value);
                markUserEdited();
              }}
              className="mt-3 block w-full resize-none bg-transparent text-[16px] font-medium leading-6 outline-none placeholder:text-foreground-subtle"
              placeholder="Add a useful note"
            />
          )}
        </section>

        <section className="mt-3 rounded-[14px] border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <ReceiptText aria-hidden="true" className="size-[18px] text-primary" />
            <h2 className="text-sm font-semibold">Receipt</h2>
            <span className="text-[11px] font-medium text-muted-foreground">Optional</span>
          </div>
          {!transactionLoading ? <input
            ref={receiptInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              chooseReceipt(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          /> : null}
          {transactionLoading ? (
            <div role="status" aria-label="Loading receipt" className="mt-3">
              <LoadingBlock className="h-14 w-full" />
            </div>
          ) : receiptSource ? (
            <div className="mt-3 overflow-hidden rounded-[12px] border border-border bg-surface-subtle">
              <AuthenticatedImage
                src={receiptSource}
                alt="Transaction receipt"
                width={720}
                height={420}
                className="h-44 w-full object-cover sm:h-52"
                unoptimized
              />
              <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => receiptInputRef.current?.click()}
                  className="min-h-10 rounded-[10px] px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary-soft"
                >
                  Replace receipt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptFile(null);
                    setReceiptImageUrl(null);
                    setReceiptError("");
                  }}
                  className="min-h-10 rounded-[10px] px-3 text-xs font-semibold text-expense transition-colors hover:bg-expense-soft"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => receiptInputRef.current?.click()}
              className="mt-3 flex min-h-14 w-full items-center gap-3 rounded-[12px] border border-dashed border-primary/30 bg-primary-soft/30 px-3.5 text-left transition-colors hover:border-primary/50 hover:bg-primary-soft/55"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-card text-primary">
                <Upload aria-hidden="true" className="size-[17px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Add receipt image</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">JPG, PNG, or WebP · up to 5 MB</span>
              </span>
            </button>
          )}
          {receiptError ? <p role="alert" className="mt-2 text-xs font-medium text-expense">{receiptError}</p> : null}
        </section>

        {transactionLoading ? (
          <div role="status" aria-label="Loading transaction date" className="mt-3 flex min-h-[66px] items-center gap-3 rounded-[14px] border border-border bg-card px-4 py-3">
            <LoadingBlock className="size-9 shrink-0" />
            <span className="flex-1 space-y-2">
              <LoadingBlock className="h-3 w-28" />
              <LoadingBlock className="h-5 w-56 max-w-full" />
            </span>
          </div>
        ) : (
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
        )}

        {!isNew && !transactionLoading ? (
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
        topContent={guidedNew ? (kind === "transfer" ? transferAmountPicker : amountAccountPicker) : undefined}
        confirmPlacement={guidedNew ? "bottom" : "top"}
        confirmLabel={guidedNew ? "Continue" : "Set"}
        confirmDisabled={guidedNew ? (value) => !Number.isFinite(Number(value)) || Number(value) <= 0 || (kind === "transfer" && (!accountId || !transferToAccountId || Boolean(transferCurrencyError) || Boolean(getTransferBalanceError(value)))) : false}
        confirmValidation={guidedNew ? (value) => kind === "transfer" && !accountId ? "Choose the account to move money from." : kind === "transfer" && !transferToAccountId ? "Choose the account to move money to." : transferCurrencyError || getTransferBalanceError(value) || getBalanceError(value) : undefined}
        liveValidation={guidedNew && kind === "transfer" ? getTransferBalanceError : undefined}
        validationAction={guidedNew && selectedAccount ? {
          label: "Open account settings",
          onClick: () => {
            const returnTo = `${window.location.pathname}${window.location.search}`;
            navigateWithRouteExit(() => router.push(`/accounts/${selectedAccount.id}/edit?returnTo=${encodeURIComponent(returnTo)}&focus=allow-negative-balance`));
          },
        } : undefined}
        cancelVariant={guidedNew ? "text" : "icon"}
        cancelLabel={guidedNew ? "Cancel" : "Cancel money edit"}
        dismissOnBackdrop
        closeOnEscape={!guidedNew}
        skipCloseAnimation={guidedNew && !amountOpen && !picker}
        onCancel={() => guidedNew ? requestDiscard(() => navigateWithRouteExit(() => router.back())) : setAmountOpen(false)}
        onSet={(nextAmount) => {
          setAmount(nextAmount);
          if (guidedNew && kind === "transfer") {
            applyTransferMetadata(nextAmount);
            setAmountOpen(false);
          } else if (guidedNew) {
            openCategoryPicker();
          }
        }}
      />

      <MoneyEditor
        open={allocationGoalId !== null}
        instanceKey={`income-allocation-${allocationGoalId ?? "none"}`}
        value={allocationGoalId ? incomeAllocations[allocationGoalId] ?? "0" : "0"}
        title={selectedAllocationGoal ? `Allocate to ${selectedAllocationGoal.name}` : "Allocate to goal"}
        currency={selectedAccount?.currency ?? "NPR"}
        previousLabel="Current allocation"
        confirmPlacement="bottom"
        confirmLabel="Set allocation"
        confirmDisabled={(value) => Boolean(!allocationGoalId || !Number.isFinite(Number(value)) || Number(value) <= 0 || getAllocationAmountError(allocationGoalId ?? "", value))}
        confirmValidation={(value) => !Number.isFinite(Number(value)) || Number(value) <= 0 ? "Enter an amount greater than zero." : allocationGoalId ? getAllocationAmountError(allocationGoalId, value) : "Choose a goal first."}
        liveValidation={(value) => allocationGoalId && Number(value) > 0 ? getAllocationAmountError(allocationGoalId, value) : ""}
        cancelVariant="text"
        cancelLabel="Cancel"
        onCancel={() => setAllocationGoalId(null)}
        topContent={selectedAllocationGoal ? (
          <div className="rounded-[13px] border border-primary/15 bg-primary-soft/35 px-3.5 py-3">
            <p className="text-sm font-semibold">Set aside money for {selectedAllocationGoal.name}.</p>
            <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
              {formatMoney(String(addMoney(selectedAllocationGoal.targetAmount, -selectedAllocationGoal.allocatedAmount)))} {selectedAccount?.currency ?? "NPR"} remains in this goal · {formatMoney(String(Math.max(0, availableIncomeRemaining)))} {selectedAccount?.currency ?? "NPR"} is currently unallocated.
            </p>
          </div>
        ) : undefined}
        onSet={(nextAmount) => {
          if (allocationGoalId) {
            setIncomeAllocations((current) => ({ ...current, [allocationGoalId]: nextAmount }));
            markUserEdited();
          }
          setAllocationGoalId(null);
        }}
      />

      {splitEditorOpen ? (
        <div role="dialog" aria-modal="true" aria-labelledby="split-editor-title" className="fixed inset-0 z-[60] flex items-end bg-foreground/25">
          <div className="flex max-h-[88dvh] w-full flex-col rounded-t-[18px] border-t border-border bg-background pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgb(23_32_29_/_0.14)]">
            <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col px-4 pt-3">
              <header className="grid shrink-0 grid-cols-[44px_1fr_72px] items-center gap-2">
                <button type="button" aria-label="Cancel category split" onClick={cancelSplitEditor} className="flex size-11 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground">
                  <X aria-hidden="true" className="size-5" />
                </button>
                <div className="min-w-0 text-center">
                  <h2 id="split-editor-title" className="text-base font-semibold">Split {formatMoney(amount)} {selectedAccount?.currency ?? "NPR"}</h2>
                  <p className={`mt-0.5 text-[11px] font-medium ${splitRemaining === 0 && splits.every((split) => split.categoryId) ? "text-income" : "text-muted-foreground"}`}>
                    {splits.some((split) => !split.categoryId)
                      ? "Choose categories"
                      : splitRemaining === 0
                        ? "Fully allocated"
                        : `${formatMoney(String(Math.abs(splitRemaining)))} ${selectedAccount?.currency ?? "NPR"} remaining`}
                  </p>
                </div>
                <button type="button" disabled={Boolean(splitError)} onClick={finishSplitEditor} className="flex h-11 items-center justify-center gap-1 rounded-[10px] border border-primary/20 bg-primary-soft px-3 text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-45">
                  <Check aria-hidden="true" className="size-4" />Done
                </button>
              </header>

              <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pb-3">
                {splits.map((split, index) => {
                  const option = categoryOptions.find((categoryOption) => categoryOption.id === split.categoryId);
                  const Icon = getCategoryIcon(option?.icon, option?.name);
                  return (
                    <div key={split.id} className="grid grid-cols-[minmax(0,1fr)_112px_44px] items-center gap-2 rounded-[13px] border border-border bg-card p-2">
                      <button type="button" onClick={() => openCategoryPicker(index)} className="flex min-h-11 min-w-0 items-center gap-2 rounded-[10px] px-2 text-left text-sm font-semibold transition-colors hover:bg-surface-subtle">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-primary-soft text-primary"><Icon aria-hidden="true" className="size-4" /></span>
                        <span className={`truncate ${option ? "text-foreground" : "text-muted-foreground"}`}>{option?.name ?? "Choose category"}</span>
                        <ChevronRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-muted-foreground" />
                      </button>
                      <button type="button" onClick={() => setSplitAmountIndex(index)} className="flex min-h-11 items-center justify-end rounded-[10px] border border-border bg-background px-3 text-sm font-semibold tabular-nums text-foreground">
                        {formatMoney(split.amount)}
                      </button>
                      <button type="button" aria-label={`Remove split ${index + 1}`} disabled={splits.length <= 2} onClick={() => setSplits((current) => current.filter((_, splitIndex) => splitIndex !== index))} className="flex size-11 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-expense-soft hover:text-expense disabled:opacity-30">
                        <Trash2 aria-hidden="true" className="size-[18px]" />
                      </button>
                    </div>
                  );
                })}
                {splits.length < 20 ? (
                  <button type="button" onClick={() => setSplits((current) => [...current, { id: window.crypto.randomUUID(), categoryId: "", amount: "0" }])} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[11px] border border-dashed border-primary/35 bg-primary-soft/25 text-sm font-semibold text-primary">
                    <Plus aria-hidden="true" className="size-4" />Add category
                  </button>
                ) : null}
              </div>
              {splitError ? <p role="alert" className="shrink-0 rounded-[11px] border border-warning/25 bg-warning-soft px-3 py-2.5 text-xs font-medium text-warning">{splitError}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      <MoneyEditor
        open={splitAmountIndex !== null}
        value={splitAmountIndex === null ? "0" : splits[splitAmountIndex]?.amount ?? "0"}
        title="Edit split amount"
        previousLabel="Previous split"
        currency={selectedAccount?.currency ?? "NPR"}
        confirmLabel="Set"
        confirmValidation={(value) => Number(value) > 0 ? "" : "Enter an amount greater than zero."}
        onCancel={() => setSplitAmountIndex(null)}
        onSet={(nextAmount) => {
          if (splitAmountIndex !== null) setSplits((current) => current.map((split, index) => index === splitAmountIndex ? { ...split, amount: nextAmount } : split));
          setSplitAmountIndex(null);
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

      {picker && typeof document !== "undefined" ? createPortal((
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="picker-title"
          className={`fixed inset-0 ${guidedPickerHandoff ? "z-[75] bg-transparent" : "drawer-scrim-enter z-[55] bg-foreground/20"} flex items-end`}
        >
          <div className={`${guidedPickerHandoff ? "transaction-picker-morph" : "drawer-enter"} flex h-[min(88dvh,680px)] max-h-[calc(100dvh-env(safe-area-inset-bottom))] w-full flex-col overflow-hidden overscroll-contain rounded-t-[18px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgb(23_32_29_/_0.12)]`}>
            <div className="mx-auto flex min-h-0 w-full max-w-[480px] flex-1 flex-col">
              <div className="grid shrink-0 grid-cols-[44px_1fr_44px] items-center">
                <button
                  type="button"
                  aria-label={`Close ${picker} picker`}
                  onClick={() => {
                    setPicker(null);
                    if (guidedNew) setAmountOpen(false);
                    if (picker === "category") {
                      if (splitCategoryIndex !== null) setSplitEditorOpen(true);
                      setSplitCategoryIndex(null);
                      setCategorySearch("");
                      setCategoryCreateOpen(false);
                      setNewCategoryIcon("Wallet");
                      setCategoryCreateError("");
                    }
                  }}
                  className="flex size-11 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-surface-subtle"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
                <h2 id="picker-title" className="text-center text-[17px] font-semibold">
                  {picker === "category" ? "Choose category" : picker === "merchant" ? (kind === "income" ? "Choose payer" : "Choose merchant") : "Add tags"}
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
                        <legend className="mb-2 block text-xs font-semibold text-foreground">Choose an icon</legend>
                        <CategoryIconPicker selected={newCategoryIcon} compact onSelect={setNewCategoryIcon} />
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
              {picker === "merchant" ? (
                <label className="mt-3 flex min-h-11 shrink-0 items-center gap-2 rounded-[12px] border border-border bg-card px-3 text-muted-foreground focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
                  <Search aria-hidden="true" className="size-4 shrink-0" />
                  <span className="sr-only">Search or enter merchant</span>
                  <input autoFocus value={merchantSearch} onChange={(event) => setMerchantSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && merchantSearch.trim()) { setMerchantName(merchantSearch.trim()); setPicker(null); } }} placeholder={kind === "income" ? "Search or enter payer" : "Search or enter merchant"} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground" />
                  {merchantSearch ? <button type="button" aria-label="Clear merchant search" onClick={() => setMerchantSearch("")} className="rounded-full p-1 hover:bg-surface-subtle"><X aria-hidden="true" className="size-4" /></button> : null}
                </label>
              ) : null}
              <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom))] pr-0.5">
                {(picker === "category"
                  ? categoryPickerOptions
                  : picker === "merchant"
                    ? merchantOptions.filter((merchant) => merchant.name.toLocaleLowerCase().includes(merchantSearch.trim().toLocaleLowerCase()))
                    : [...tagOptions, ...savedTagOptions.filter((tag) => !tagOptions.includes(tag))]
                ).map(
                  (option) => {
                    const isCategory = picker === "category";
                    const isMerchant = picker === "merchant";
                    const optionName = typeof option === "string" ? option : option.name;
                    const optionId = isCategory && typeof option !== "string" ? (option as CategoryOption).id : null;
                    const categoryOption = isCategory && typeof option !== "string" ? option as CategoryOption : null;
                    const merchantOption = isMerchant && typeof option !== "string" ? option as MerchantOption : null;
                    const budgetPreview = optionId ? categoryBudgetPreviews.get(optionId) : undefined;
                    const selected =
                      picker === "category"
                        ? category === optionName
                        : picker === "merchant"
                          ? merchantName === optionName
                          : tags.includes(optionName);
                    const Icon = categoryOption ? getCategoryIcon(categoryOption.icon, categoryOption.name) : null;
                    const iconColor = categoryOption ? categoryForeground(categoryOption.color) : undefined;
                    return (
                      <button
                        type="button"
                        key={categoryOption?.id ?? optionName}
                        aria-pressed={selected}
                        onClick={() => {
                          if (picker === "category") {
                            if (splitCategoryIndex !== null && optionId) {
                              setSplits((current) => current.map((split, index) => index === splitCategoryIndex ? { ...split, categoryId: optionId } : split));
                            } else {
                              setSplits([]);
                              setCategory(optionName);
                              setCategoryId(optionId);
                            }
                            finishCategorySelection();
                          } else if (picker === "merchant") {
                            setMerchantName(optionName);
                            setPicker(null);
                          } else {
                            setTags((current) =>
                              current.includes(optionName)
                                ? current.filter((tag) => tag !== optionName)
                                : [...current, optionName],
                            );
                          }
                        }}
                        style={!selected && categoryOption?.color ? { backgroundColor: categoryOption.color } : undefined}
                        className={`relative isolate flex min-h-11 items-center gap-2 overflow-visible border px-3 py-2 text-left text-sm font-semibold transition-colors ${isMerchant ? "rounded-[12px]" : "rounded-full"} ${
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
                        <span className="min-w-0 flex-1">
                          <span className="block min-w-0 truncate">{optionName}</span>
                          {merchantOption ? <span className={`mt-0.5 block truncate text-[10px] font-medium ${selected ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(merchantOption.lastUsedAt))} · {merchantOption.usageCount} {merchantOption.usageCount === 1 ? "use" : "uses"}</span> : null}
                        </span>
                        {selected ? <Check aria-hidden="true" className="size-4 shrink-0 text-white" strokeWidth={2.5} /> : null}
                        {budgetPreview?.tone === "warning" ? <BudgetStatusBadge tone="warning" label={`${budgetPreview.percentage}%`} ariaLabel={`${budgetPreview.percentage}% of budget used`} className="absolute right-1.5 top-0.5" /> : null}
                        {budgetPreview?.tone === "danger" ? <BudgetStatusBadge tone="danger" label="Over" ariaLabel="Over budget" className="absolute right-1.5 top-0.5" /> : null}
                        {budgetPreview ? <span aria-label={`${budgetPreview.percentage}% of budget after this expense`} className="absolute bottom-0.5 left-11 right-3 h-[2px] overflow-hidden rounded-full bg-foreground/10"><span className="block h-full rounded-full transition-[width,background-color] duration-300" style={{ width: `${Math.min(100, budgetPreview.percentage)}%`, backgroundColor: budgetProgressColor(budgetPreview.percentage) }} /></span> : null}
                      </button>
                    );
                  },
                )}
              </div>
              {picker === "category" && (kind === "expense" || kind === "income") ? (
                <div className="shrink-0 border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={openSplitEditor}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[11px] text-sm font-semibold text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                  >
                    <Layers3 aria-hidden="true" className="size-[18px]" />
                    {splits.length ? "Edit category split" : "Split into multiple categories"}
                  </button>
                </div>
              ) : null}
              {picker === "merchant" ? (
                <div className="shrink-0 space-y-2 border-t border-border pt-3">
                  {merchantName ? <button type="button" onClick={() => { setMerchantName(""); setMerchantSearch(""); setPicker(null); }} className="h-11 w-full rounded-[11px] text-sm font-semibold text-expense hover:bg-expense-soft">Remove {kind === "income" ? "payer" : "merchant"}</button> : null}
                  {merchantSearch.trim() && !merchantOptions.some((merchant) => merchant.name.toLocaleLowerCase() === merchantSearch.trim().toLocaleLowerCase()) ? <button type="button" onClick={() => { const name = merchantSearch.trim(); setMerchantName(name); setMerchantOptions((current) => [{ name, lastUsedAt: new Date().toISOString(), usageCount: 0 }, ...current.filter((merchant) => merchant.name.toLocaleLowerCase() !== name.toLocaleLowerCase())]); setPicker(null); }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[11px] bg-primary text-sm font-semibold text-primary-foreground"><Check aria-hidden="true" className="size-4" />Use “{merchantSearch.trim()}”</button> : null}
                </div>
              ) : null}
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
      ), document.body) : null}
      {discardDialog}
    </main>
  );
}
