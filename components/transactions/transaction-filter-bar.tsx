"use client";

import { createElement, useEffect, useMemo, useState } from "react";
import {
  Check,
  Layers3,
  Search,
  Store,
  Tag,
  Tags,
  X,
  type LucideIcon,
} from "lucide-react";

import { getCategoryForeground, getCategoryIcon } from "@/lib/category-appearance";
import { authenticatedFetch } from "@/lib/auth-client";

export type TransactionFilterState = {
  categoryId: string;
  tag: string;
  merchant: string;
};

export const EMPTY_TRANSACTION_FILTERS: TransactionFilterState = {
  categoryId: "",
  tag: "",
  merchant: "",
};

export function hasTransactionFilters(value: TransactionFilterState) {
  return Boolean(value.categoryId || value.tag || value.merchant);
}

export function transactionFiltersFromSearchParams(searchParams: { get(name: string): string | null }): TransactionFilterState {
  return {
    categoryId: searchParams.get("categoryId") ?? "",
    tag: searchParams.get("tag") ?? "",
    merchant: searchParams.get("merchant") ?? "",
  };
}

export function transactionFiltersQuery(value: TransactionFilterState) {
  const params = new URLSearchParams();
  if (value.categoryId) params.set("categoryId", value.categoryId);
  if (value.tag) params.set("tag", value.tag);
  if (value.merchant) params.set("merchant", value.merchant);
  return params.toString();
}

type CategoryOption = {
  id: string;
  name: string;
  icon: string | null;
  color: string;
};

type MerchantOption = {
  name: string;
};

type FilterKey = keyof TransactionFilterState;
type PickerKey = "categoryId" | "tag" | "merchant";

function uniqueByName<T extends { name: string }>(options: T[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = option.name.trim().toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function useTransactionFilterOptions() {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      authenticatedFetch("/api/categories"),
      authenticatedFetch("/api/tags"),
      authenticatedFetch("/api/merchants"),
    ])
      .then(async ([categoryResponse, tagResponse, merchantResponse]) => {
        const [categoryResult, tagResult, merchantResult] = await Promise.all([
          categoryResponse.ok ? categoryResponse.json() as Promise<{ categories?: CategoryOption[] }> : Promise.resolve({ categories: [] }),
          tagResponse.ok ? tagResponse.json() as Promise<{ tags?: Array<{ name: string }> }> : Promise.resolve({ tags: [] }),
          merchantResponse.ok ? merchantResponse.json() as Promise<{ merchants?: MerchantOption[] }> : Promise.resolve({ merchants: [] }),
        ]);
        if (!active) return;
        setCategories(uniqueByName(categoryResult.categories ?? []));
        setTags(uniqueByName((tagResult.tags ?? []).map((tag) => ({ name: tag.name }))).map((tag) => tag.name));
        setMerchants(uniqueByName(merchantResult.merchants ?? []));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return { categories, tags, merchants };
}

function FilterChip({
  label,
  active,
  icon: Icon,
  onClick,
  onClear,
  color,
  categoryIcon,
}: {
  label: string;
  active: boolean;
  icon: LucideIcon;
  onClick: () => void;
  onClear?: () => void;
  color?: string;
  categoryIcon?: string | null;
}) {
  const ChipIcon = categoryIcon ? getCategoryIcon(categoryIcon, label) : Icon;
  const style = color
    ? {
        backgroundColor: `${color}44`,
        borderColor: `${color}99`,
        color: getCategoryForeground(color),
      }
    : undefined;

  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        style={style}
        className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
          color
            ? ""
            : active
              ? "border-primary/35 bg-primary-soft text-primary"
              : "border-border bg-card text-foreground hover:bg-surface-subtle"
        }`}
      >
        {createElement(ChipIcon, { "aria-hidden": true, className: "size-4 shrink-0" })}
        <span className="max-w-36 truncate">{label}</span>
      </button>
      {onClear ? (
        <button
          type="button"
          aria-label={`Clear ${label} filter`}
          onClick={onClear}
          className="-ml-3 flex size-6 items-center justify-center rounded-full border border-background bg-foreground text-background shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function TransactionFilterBar({
  value,
  onChange,
}: {
  value: TransactionFilterState;
  onChange: (next: TransactionFilterState) => void;
}) {
  const { categories, tags, merchants } = useTransactionFilterOptions();
  const [picker, setPicker] = useState<PickerKey | null>(null);
  const [search, setSearch] = useState("");

  const selectedCategory = categories.find((category) => category.id === value.categoryId);
  const activeFilterCount = [value.categoryId, value.tag, value.merchant].filter(Boolean).length;
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const options = useMemo(() => {
    if (picker === "categoryId") return categories.filter((category) => category.name.toLocaleLowerCase().includes(normalizedSearch));
    if (picker === "tag") return tags.filter((tag) => tag.toLocaleLowerCase().includes(normalizedSearch));
    return merchants.filter((merchant) => merchant.name.toLocaleLowerCase().includes(normalizedSearch));
  }, [categories, merchants, normalizedSearch, picker, tags]);

  const openPicker = (nextPicker: PickerKey) => {
    setSearch("");
    setPicker(nextPicker);
  };

  const closePicker = () => {
    setSearch("");
    setPicker(null);
  };

  const choose = (nextValue: string) => {
    if (!picker) return;
    onChange({ ...value, [picker]: nextValue });
    closePicker();
  };

  const clear = (key: FilterKey) => onChange({ ...value, [key]: "" });

  return (
    <>
      <div
        aria-label="Filter transactions"
        className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <FilterChip
          label={selectedCategory?.name ?? "Category"}
          active={Boolean(value.categoryId)}
          icon={Layers3}
          categoryIcon={selectedCategory?.icon}
          color={selectedCategory?.color}
          onClick={() => openPicker("categoryId")}
          onClear={value.categoryId ? () => clear("categoryId") : undefined}
        />
        <FilterChip
          label={value.tag || "Tag"}
          active={Boolean(value.tag)}
          icon={Tags}
          onClick={() => openPicker("tag")}
          onClear={value.tag ? () => clear("tag") : undefined}
        />
        <FilterChip
          label={value.merchant || "Merchant"}
          active={Boolean(value.merchant)}
          icon={Store}
          onClick={() => openPicker("merchant")}
          onClear={value.merchant ? () => clear("merchant") : undefined}
        />
        {activeFilterCount > 0 ? (
          <button
            type="button"
            onClick={() => onChange(EMPTY_TRANSACTION_FILTERS)}
            className="min-h-10 shrink-0 rounded-full px-2.5 text-xs font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {picker ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="transaction-filter-title"
          className="fixed inset-0 z-[80] flex items-end bg-foreground/25"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closePicker();
          }}
        >
          <section
            className="drawer-enter flex max-h-[82dvh] w-full flex-col rounded-t-[24px] border-t border-border bg-background shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)]"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-foreground/20" aria-hidden="true" />
            <header className="flex shrink-0 items-center justify-between border-b border-border px-4 pb-3 pt-3 sm:px-5">
              <button
                type="button"
                aria-label="Close transaction filter"
                onClick={closePicker}
                className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
              <h2 id="transaction-filter-title" className="text-base font-semibold">
                Filter by {picker === "categoryId" ? "category" : picker}
              </h2>
              <span className="size-11" aria-hidden="true" />
            </header>
            <div className="min-h-0 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
              <label className="flex min-h-11 items-center gap-2 rounded-[11px] border border-border bg-card px-3 shadow-[0_1px_2px_rgb(23_32_29_/_0.03)] focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/15">
                <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <span className="sr-only">Search {picker === "categoryId" ? "categories" : picker === "tag" ? "tags" : "merchants"}</span>
                <input
                  autoFocus
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${picker === "categoryId" ? "categories" : picker === "tag" ? "tags" : "merchants"}`}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
                />
              </label>
              <div className={`mt-3 ${picker === "categoryId" ? "grid grid-cols-2 content-start gap-2" : "space-y-2"}`}>
                <button
                  type="button"
                  aria-pressed={!value[picker]}
                  onClick={() => choose("")}
                  className={`flex min-h-11 w-full items-center justify-between border px-3.5 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${picker === "categoryId" ? "col-span-2 rounded-full" : "rounded-[11px]"} ${!value[picker] ? "border-primary bg-primary-soft text-primary" : "border-border bg-card hover:bg-surface-subtle"}`}
                >
                  All {picker === "categoryId" ? "categories" : picker === "tag" ? "tags" : "merchants"}
                  {!value[picker] ? <Check aria-hidden="true" className="size-4" /> : null}
                </button>
                {options.map((option) => {
                  const categoryOption = picker === "categoryId" && typeof option !== "string" ? option as CategoryOption : null;
                  const optionName = typeof option === "string" ? option : option.name;
                  const selected = value[picker] === (categoryOption?.id ?? optionName);
                  const OptionIcon = categoryOption ? getCategoryIcon(categoryOption.icon, categoryOption.name) : picker === "tag" ? Tag : Store;
                  const optionColor = categoryOption?.color;
                  return (
                    <button
                      type="button"
                      key={categoryOption?.id ?? optionName}
                      aria-pressed={selected}
                      onClick={() => choose(categoryOption?.id ?? optionName)}
                      style={!selected && optionColor ? { backgroundColor: optionColor } : undefined}
                      className={`flex min-h-11 w-full items-center gap-2 border px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${categoryOption ? "relative isolate overflow-visible rounded-full" : "rounded-[12px]"} ${selected ? "border-primary bg-primary text-primary-foreground" : categoryOption ? "border-border hover:border-primary/50" : "border-border bg-card hover:bg-surface-subtle"}`}
                    >
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${categoryOption ? (selected ? "bg-white/20" : "bg-white/65") : "bg-surface-subtle"}`}
                        style={categoryOption && !selected ? { color: getCategoryForeground(optionColor ?? "#dcece7") } : undefined}
                      >
                        {createElement(OptionIcon, { "aria-hidden": true, className: categoryOption ? "size-[17px]" : "size-4", strokeWidth: categoryOption ? 1.9 : undefined })}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{optionName}</span>
                      {selected ? <Check aria-hidden="true" className="size-4 shrink-0" /> : null}
                    </button>
                  );
                })}
                {!options.length ? <p className="rounded-[12px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No matching options.</p> : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ActiveFilterChip({
  label,
  icon: Icon,
  color,
  onClear,
}: {
  label: string;
  icon: LucideIcon;
  color?: string;
  onClear: () => void;
}) {
  const style = color
    ? {
        backgroundColor: `${color}44`,
        borderColor: `${color}99`,
        color: getCategoryForeground(color),
      }
    : undefined;

  return (
    <div style={style} className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-sm font-semibold ${color ? "" : "border-border bg-card text-foreground"}`}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="max-w-40 truncate">{label}</span>
      <button
        type="button"
        aria-label={`Clear ${label} filter`}
        onClick={onClear}
        className="flex size-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

export function ActiveTransactionFilters({
  value,
  onChange,
}: {
  value: TransactionFilterState;
  onChange: (next: TransactionFilterState) => void;
}) {
  const { categories } = useTransactionFilterOptions();
  const selectedCategory = categories.find((category) => category.id === value.categoryId);
  if (!hasTransactionFilters(value)) return null;

  return (
    <div aria-label="Active transaction filters" className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {value.categoryId ? (
        <ActiveFilterChip
          label={selectedCategory?.name ?? "Category"}
          icon={selectedCategory ? getCategoryIcon(selectedCategory.icon, selectedCategory.name) : Layers3}
          color={selectedCategory?.color}
          onClear={() => onChange({ ...value, categoryId: "" })}
        />
      ) : null}
      {value.tag ? <ActiveFilterChip label={value.tag} icon={Tag} onClear={() => onChange({ ...value, tag: "" })} /> : null}
      {value.merchant ? <ActiveFilterChip label={value.merchant} icon={Store} onClear={() => onChange({ ...value, merchant: "" })} /> : null}
    </div>
  );
}
