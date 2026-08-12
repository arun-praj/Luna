"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { categoryIconOptions } from "@/lib/category-appearance";

export function CategoryIconPicker({
  selected,
  onSelect,
  autoFocus = false,
  compact = false,
}: {
  selected: string | null | undefined;
  onSelect: (label: string) => void;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return normalizedQuery
      ? categoryIconOptions.filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery))
      : categoryIconOptions;
  }, [query]);

  return (
    <div className="space-y-3">
      <label className="flex min-h-11 items-center gap-2 rounded-[12px] border border-border bg-card px-3 text-muted-foreground focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
        <Search aria-hidden="true" className="size-4 shrink-0" />
        <span className="sr-only">Search category icons</span>
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search icons"
          aria-label="Search category icons"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      {filteredOptions.length ? (
        <div className={`grid ${compact ? "max-h-[180px] grid-cols-4 min-[380px]:grid-cols-5" : "grid-cols-3 min-[360px]:grid-cols-4"} gap-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]`} role="listbox" aria-label="Category icons">
          {filteredOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = selected === option.label;
            return (
              <button
                type="button"
                key={option.label}
                role="option"
                aria-label={option.label}
                aria-selected={isSelected}
                onClick={() => onSelect(option.label)}
                className={`relative flex ${compact ? "min-h-11" : "min-h-[76px]"} flex-col items-center justify-center gap-1.5 rounded-[11px] border px-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${isSelected ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/35 hover:bg-surface-subtle hover:text-foreground"}`}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
                <span className="max-w-full truncate text-[10px] font-medium">{option.label}</span>
                {isSelected ? <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" /> : null}
              </button>
            );
          })}
        </div>
      ) : <p className="rounded-[12px] border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">No matching icons.</p>}
    </div>
  );
}
