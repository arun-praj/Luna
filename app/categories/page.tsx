"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpLeft,
  Plus,
  Search,
  X,
} from "lucide-react";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { GuideIcon } from "@/components/guides/feature-guide";
import { authenticatedFetch } from "@/lib/auth-client";
import { getCategoryIcon } from "@/lib/category-appearance";
import { getCurrentRoute, getReturnTo, withReturnTo } from "@/lib/navigation";
import { Skeleton } from "@/components/ui/data-skeleton";

type Category = {
  id: string;
  name: string;
  type: "expense" | "income";
  icon: string | null;
  color: string | null;
  usageFrequency: number;
};

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

function sortCategories(categories: Category[]) {
  return [...categories].sort(
    (left, right) =>
      right.usageFrequency - left.usageFrequency ||
      left.name.localeCompare(right.name),
  );
}

function CategorySection({
  categories,
  currentRoute,
  heading,
  icon: SectionIcon,
  tone,
}: {
  categories: Category[];
  currentRoute: string;
  heading: "Expenses" | "Income";
  icon: typeof ArrowDownLeft;
  tone: "expense" | "income";
}) {
  const transactionCount = categories.reduce(
    (total, category) => total + category.usageFrequency,
    0,
  );
  const Icon = SectionIcon;

  return (
    <section aria-labelledby={`${tone}-categories-heading`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <Icon
            aria-hidden="true"
            className={`size-[18px] shrink-0 ${tone === "expense" ? "text-expense" : "text-income"}`}
            strokeWidth={1.9}
          />
          <h3
            id={`${tone}-categories-heading`}
            className="text-[18px] font-semibold tracking-[-0.025em]"
          >
            {heading}
          </h3>
          <span className="text-sm tabular-nums text-muted-foreground">
            {categories.length}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {transactionCount > 0
            ? `${transactionCount.toLocaleString()} ${transactionCount === 1 ? "transaction" : "transactions"}`
            : "No activity yet"}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 min-[600px]:grid-cols-2">
        {categories.map((category) => {
          const CategoryIcon = getCategoryIcon(category.icon, category.name);
          const iconColor = categoryForeground(category.color);
          const usageLabel =
            category.usageFrequency > 0
              ? `${category.usageFrequency.toLocaleString()} ${category.usageFrequency === 1 ? "use" : "uses"}`
              : "No activity";

          return (
            <Link
              href={withReturnTo(`/categories/${category.id}`, currentRoute)}
              key={category.id}
              className="group flex min-h-[72px] min-w-0 items-center gap-3 rounded-[12px] border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface-subtle active:bg-surface-subtle focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <span
                aria-hidden="true"
                style={
                  category.color
                    ? { backgroundColor: category.color, color: iconColor }
                    : { color: iconColor }
                }
                className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-subtle"
              >
                <CategoryIcon className="size-[19px]" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[15px] font-semibold leading-5 text-foreground">
                  {category.name}
                </span>
                <span className="mt-1 block text-[13px] leading-4 text-muted-foreground">
                  {category.type === "expense" ? "Expense" : "Income"} category
                </span>
              </span>
              <span className="shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
                {usageLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function CategoryListSkeleton() {
  return (
    <div
      aria-label="Loading categories"
      className="mt-5 grid grid-cols-1 gap-2 min-[600px]:grid-cols-2"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          className="flex min-h-[72px] items-center gap-3 rounded-[12px] border border-border bg-card px-3"
          key={index}
        >
          <Skeleton className="size-10 shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-14 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export default function CategoriesPage() {
  const [backHref, setBackHref] = useState("/");
  const [currentRoute, setCurrentRoute] = useState("/");
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setBackHref(getReturnTo("/"));
      setCurrentRoute(getCurrentRoute());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    void authenticatedFetch("/api/categories")
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? "Please sign in to view categories."
              : "Could not load categories.",
          );
        const result = (await response.json()) as { categories: Category[] };
        if (active) setCategories(result.categories);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load categories.",
          );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredCategories = useMemo(
    () =>
      sortCategories(categories).filter((category) =>
        category.name.toLocaleLowerCase().includes(normalizedSearch),
      ),
    [categories, normalizedSearch],
  );
  const expenseCategories = filteredCategories.filter(
    (category) => category.type === "expense",
  );
  const incomeCategories = filteredCategories.filter(
    (category) => category.type === "income",
  );
  const totalUsage = categories.reduce(
    (total, category) => total + category.usageFrequency,
    0,
  );

  return (
    <main className="page-route-enter min-h-dvh overflow-x-clip bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-12 sm:px-5">
        <StickyPageHeader className="-mx-4 flex items-center justify-between gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={backHref}
              aria-label="Back"
              className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Link>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Manage your money
              </p>
              <h1 className="truncate text-[26px] font-semibold tracking-[-0.04em] sm:text-[28px]">
                Categories
              </h1>
            </div>
            <GuideIcon
              href={withReturnTo("/categories/guide", currentRoute)}
              label="Categories"
            />
          </div>
          <Link
            href={withReturnTo("/categories/new", currentRoute)}
            aria-label="Add category"
            className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <Plus aria-hidden="true" className="size-[19px]" />
          </Link>
        </StickyPageHeader>

        <div className="sticky top-[68px] z-10 -mx-4 mt-3 bg-background/90 px-4 py-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/78 sm:top-[88px] sm:-mx-5 sm:px-5 sm:py-3">
          <label className="flex min-h-12 items-center gap-2 rounded-[12px] border border-border bg-card px-3 text-muted-foreground shadow-sm focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/15 sm:min-h-[52px]">
            <Search aria-hidden="true" className="size-[18px] shrink-0" />
            <span className="sr-only">Search categories</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search categories"
              aria-label="Search categories"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear category search"
                className="flex size-11 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            ) : null}
          </label>
        </div>

        <section
          aria-label="Category summary"
          className="mt-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-1"
        >
          <div>
            <h2 className="text-[21px] font-semibold tracking-[-0.03em]">
              All categories
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Grouped by type for a quicker scan.
            </p>
          </div>
          <p
            aria-live="polite"
            className="text-sm font-semibold tabular-nums text-primary"
          >
            {isLoading
              ? "Loading"
              : `${filteredCategories.length} of ${categories.length}`}
          </p>
        </section>

        {isLoading ? (
          <CategoryListSkeleton />
        ) : error ? (
          <div
            role="alert"
            className="mt-5 rounded-[12px] border border-expense/25 bg-expense-soft p-4 text-sm text-expense"
          >
            {error}
          </div>
        ) : categories.length === 0 ? (
          <div className="mt-5 rounded-[14px] border border-dashed border-border-strong bg-card p-8 text-center">
            <p className="text-sm font-semibold">No categories yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a category to organize transactions.
            </p>
            <Link
              href={withReturnTo("/categories/new", currentRoute)}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-primary/25 bg-primary-soft px-4 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <Plus aria-hidden="true" className="size-4" />
              Add category
            </Link>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="mt-5 rounded-[14px] border border-dashed border-border-strong bg-card p-8 text-center">
            <p className="text-sm font-semibold">No matching categories</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search or clear the current query.
            </p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-5 inline-flex min-h-11 items-center rounded-[10px] border border-primary/25 bg-primary-soft px-4 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="route-data-reveal mt-8 space-y-8">
            {expenseCategories.length > 0 ? (
              <CategorySection
                categories={expenseCategories}
                currentRoute={currentRoute}
                heading="Expenses"
                icon={ArrowDownLeft}
                tone="expense"
              />
            ) : null}
            {incomeCategories.length > 0 ? (
              <CategorySection
                categories={incomeCategories}
                currentRoute={currentRoute}
                heading="Income"
                icon={ArrowUpLeft}
                tone="income"
              />
            ) : null}
          </div>
        )}

        {!isLoading && !error && categories.length > 0 ? (
          <p className="mt-8 px-1 text-xs text-muted-foreground">
            {totalUsage > 0
              ? `${totalUsage.toLocaleString()} transactions are represented across these categories.`
              : "Usage will appear here as you add transactions."}
          </p>
        ) : null}
      </div>
    </main>
  );
}
