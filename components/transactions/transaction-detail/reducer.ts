import type { TransactionKind, SplitDraft } from "./types";

export type TransactionDraftState = {
  title: string;
  description: string;
  date: string;
  time: string;
  kind: TransactionKind;
  category: string;
  categoryId: string | null;
  splits: SplitDraft[];
  merchantName: string;
  tags: string[];
  accountId: string;
  savingsInstrumentId: string | null;
  transferToAccountId: string;
  amount: string;
  receiptImageUrl: string | null;
  receiptFileKey: string | null;
};

export type TransactionDraftAction =
  | { type: "set-field"; field: keyof TransactionDraftState; value: unknown }
  | { type: "set-kind"; value: TransactionKind }
  | { type: "set-splits"; value: SplitDraft[] }
  | { type: "toggle-tag"; value: string }
  | { type: "reset"; value: TransactionDraftState };

export function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function localTimeValue(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function transactionDraftReducer(state: TransactionDraftState, action: TransactionDraftAction): TransactionDraftState {
  switch (action.type) {
    case "set-field":
      return {
        ...state,
        [action.field]: typeof action.value === "function"
          ? (action.value as (current: unknown) => unknown)(state[action.field])
          : action.value,
      } as TransactionDraftState;
    case "set-kind":
      return { ...state, kind: action.value, splits: action.value !== state.kind ? [] : state.splits };
    case "set-splits":
      return { ...state, splits: action.value };
    case "toggle-tag":
      return { ...state, tags: state.tags.includes(action.value) ? state.tags.filter((tag) => tag !== action.value) : [...state.tags, action.value] };
    case "reset":
      return action.value;
    default:
      return state;
  }
}

export function createTransactionDraftState(values: Partial<TransactionDraftState> & Pick<TransactionDraftState, "title" | "description" | "date" | "kind" | "amount">): TransactionDraftState {
  return {
    title: values.title,
    description: values.description,
    date: values.date,
    time: values.time ?? localTimeValue(),
    kind: values.kind,
    category: values.category ?? "",
    categoryId: values.categoryId ?? null,
    splits: values.splits ?? [],
    merchantName: values.merchantName ?? "",
    tags: values.tags ?? [],
    accountId: values.accountId ?? "",
    savingsInstrumentId: values.savingsInstrumentId ?? null,
    transferToAccountId: values.transferToAccountId ?? "",
    amount: values.amount,
    receiptImageUrl: values.receiptImageUrl ?? null,
    receiptFileKey: values.receiptFileKey ?? null,
  };
}
