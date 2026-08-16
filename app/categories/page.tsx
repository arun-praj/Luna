"use client";

import Link from "next/link";
import { createElement, useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  Search,
  WalletCards,
} from "lucide-react";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { PageHeader } from "@/components/layout/page-header";
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

function categoryActivityLabel(usageFrequency: number) {
  return usageFrequency > 0
    ? `${usageFrequency} ${usageFrequency === 1 ? "transaction" : "transactions"}`
    : "No activity yet";
}

function CategoryRow({
  category,
  currentRoute,
}: {
  category: Category;
  currentRoute: string;
}) {
  const iconColor = categoryForeground(category.color);
  const Icon = getCategoryIcon(category.icon, category.name);

  return (
    <Link
      href={withReturnTo(`/categories/${category.id}`, currentRoute)}
      aria-label={`${category.name}, ${category.type} category, ${categoryActivityLabel(category.usageFrequency)}`}
      className="group flex min-h-[76px] min-w-0 items-start gap-3 rounded-[14px] border border-border bg-card px-3.5 py-3 transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-surface-subtle hover:shadow-[0_8px_22px_rgb(23_32_29_/_0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
    >
      <span
        style={{ color: iconColor }}
        className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-surface-subtle"
      >
        {createElement(Icon, {
          "aria-hidden": true,
          className: "size-[19px]",
          strokeWidth: 1.8,
        })}
      </span>
      <span className="min-w-0 flex-1 pt-0.5">
        <span className="block break-words text-[14px] font-semibold leading-5 text-foreground sm:text-[15px]">
          {category.name}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-4 text-muted-foreground sm:text-xs">
          <span className="capitalize">{category.type}</span>
          <span aria-hidden="true" className="text-border-strong">
            ·
          </span>
          <span>{categoryActivityLabel(category.usageFrequency)}</span>
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="mt-2 size-4 shrink-0 text-muted-foreground/70 transition-transform duration-200 group-hover:translate-x-0.5"
      />
    </Link>
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
  const sortedCategories = [...categories]
    .sort(
      (left, right) =>
        right.usageFrequency - left.usageFrequency ||
        left.type.localeCompare(right.type) ||
        left.name.localeCompare(right.name),
    );
  const filteredCategories = sortedCategories.filter((category) =>
    category.name.toLocaleLowerCase().includes(normalizedSearch),
  );
  const expenseCategories = filteredCategories.filter(
    (category) => category.type === "expense",
  );
  const incomeCategories = filteredCategories.filter(
    (category) => category.type === "income",
  );
  const totalExpenseCategories = categories.filter(
    (category) => category.type === "expense",
  ).length;
  const totalIncomeCategories = categories.filter(
    (category) => category.type === "income",
  ).length;
  const frequentlyUsed = normalizedSearch
    ? []
    : sortedCategories.filter((category) => category.usageFrequency > 0).slice(0, 4);

  function groupCount(visible: number, total: number) {
    return normalizedSearch
      ? `${visible} of ${total} categories`
      : `${total} ${total === 1 ? "category" : "categories"}`;
  }

  return (
    <main className="page-route-enter min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-12 sm:px-5">
        <StickyPageHeader className="-mx-4 px-4 pb-3 sm:-mx-5 sm:px-5">
          <PageHeader
            leading={<Link href={backHref} aria-label="Back" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><ArrowLeft aria-hidden="true" className="size-5" /></Link>}
            title={<div><p className="text-xs font-medium text-muted-foreground">Manage your money</p><h1 className="text-[26px] font-semibold tracking-[-0.04em] sm:text-[28px]">Categories</h1></div>}
            secondary={<GuideIcon href={withReturnTo("/categories/guide", currentRoute)} label="Categories" />}
            actions={<Link href={withReturnTo("/categories/new", currentRoute)} aria-label="Add category" className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><Plus aria-hidden="true" className="size-[19px]" /></Link>}
          />
        </StickyPageHeader>

        <section
          aria-label="Category overview"
          className="relative mt-8 overflow-hidden rounded-[18px] border border-primary/15 bg-primary px-5 py-5 text-primary-foreground sm:px-6 sm:py-6"
        >
          <div className="relative z-10 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white/75">
                Your spending is organized into
              </p>
              <p className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.05em]">
                {isLoading ? (
                  <Skeleton className="h-9 w-32 bg-white/20" />
                ) : (
                  `${categories.length} categories`
                )}
              </p>
            </div>
            <WalletCards
              aria-hidden="true"
              className="mb-1 size-10 text-white/35"
              strokeWidth={1.5}
            />
          </div>
          <div className="pointer-events-none absolute -right-6 -top-10 size-36 rounded-full border-[18px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-20 right-16 size-40 rounded-full border-[22px] border-white/[0.07]" />
        </section>

        <section aria-labelledby="category-list-heading" className="mt-9">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Keep every rupee in view
              </p>
              <h2
                id="category-list-heading"
                className="mt-1 text-[21px] font-semibold tracking-[-0.03em]"
              >
                All categories
              </h2>
            </div>
          </div>
          <div
            role="search"
            className="mt-4 flex min-h-11 min-w-0 items-center gap-2 rounded-[12px] border border-border bg-card px-3 text-muted-foreground shadow-sm focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10"
          >
            <Search aria-hidden="true" className="size-4 shrink-0" />
            <label htmlFor="category-search" className="sr-only">
              Search categories
            </label>
            <input
              id="category-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search categories"
              aria-label="Search categories"
              className="min-h-11 min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="min-h-9 shrink-0 rounded-[9px] px-2 text-xs font-semibold text-muted-foreground hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                Clear
              </button>
            ) : null}
          </div>
          {isLoading ? (
            <div className="route-data-reveal mt-6 grid grid-cols-1 gap-2.5 min-[520px]:grid-cols-2 min-[900px]:grid-cols-3 min-[520px]:gap-3">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton className="h-[76px] rounded-[14px]" key={index} />
              ))}
            </div>
          ) : error ? (
            <div
              role="alert"
              className="mt-4 rounded-[14px] border border-expense/25 bg-expense-soft p-4 text-sm text-expense"
            >
              {error}
            </div>
          ) : categories.length === 0 ? (
            <div className="mt-4 rounded-[14px] border border-dashed border-border-strong bg-card p-8 text-center">
              <p className="text-sm font-semibold">No categories yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a category to organize transactions.
              </p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="mt-4 rounded-[14px] border border-dashed border-border-strong bg-card p-8 text-center">
              <p className="text-sm font-semibold">No matching categories</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try a different search or create a new category.
              </p>
            </div>
          ) : (
            <div className="route-data-reveal mt-6 space-y-8">
              {!normalizedSearch && frequentlyUsed.length > 0 ? (
                <section aria-labelledby="frequently-used-heading">
                  <div className="flex items-baseline justify-between gap-3 px-1">
                    <h3
                      id="frequently-used-heading"
                      className="text-sm font-semibold tracking-[-0.01em]"
                    >
                      Frequently used
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {frequentlyUsed.length} of {categories.length} categories
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 min-[520px]:grid-cols-2 min-[900px]:grid-cols-3 min-[520px]:gap-3">
                    {frequentlyUsed.map((category) => (
                      <CategoryRow
                        category={category}
                        currentRoute={currentRoute}
                        key={`frequent-${category.id}`}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {expenseCategories.length > 0 ? (
                <section aria-labelledby="expense-categories-heading">
                  <div className="flex items-baseline justify-between gap-3 px-1">
                    <h3
                      id="expense-categories-heading"
                      className="text-sm font-semibold tracking-[-0.01em]"
                    >
                      Expense
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {groupCount(expenseCategories.length, totalExpenseCategories)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 min-[520px]:grid-cols-2 min-[900px]:grid-cols-3 min-[520px]:gap-3">
                    {expenseCategories.map((category) => (
                      <CategoryRow
                        category={category}
                        currentRoute={currentRoute}
                        key={category.id}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {incomeCategories.length > 0 ? (
                <section aria-labelledby="income-categories-heading">
                  <div className="flex items-baseline justify-between gap-3 px-1">
                    <h3
                      id="income-categories-heading"
                      className="text-sm font-semibold tracking-[-0.01em]"
                    >
                      Income
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {groupCount(incomeCategories.length, totalIncomeCategories)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 min-[520px]:grid-cols-2 min-[900px]:grid-cols-3 min-[520px]:gap-3">
                    {incomeCategories.map((category) => (
                      <CategoryRow
                        category={category}
                        currentRoute={currentRoute}
                        key={category.id}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
