"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  WalletCards,
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

const colorClasses = [
  "border-[#c7dbd2] bg-[#e3eee9]",
  "border-[#e6c9c4] bg-[#f8e9e6]",
  "border-[#e3d2b6] bg-[#f3e8d4]",
  "border-[#cadde9] bg-[#e3eff6]",
  "border-[#c7dbd2] bg-[#e5f3eb]",
  "border-[#d8cee7] bg-[#ece6f3]",
];
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

  const filteredCategories = [...categories]
    .sort(
      (left, right) =>
        right.usageFrequency - left.usageFrequency ||
        left.type.localeCompare(right.type) ||
        left.name.localeCompare(right.name),
    )
    .filter((category) =>
      category.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
    );

  return (
    <main className="page-route-enter min-h-dvh bg-background">
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
            <GuideIcon href={withReturnTo("/categories/guide", currentRoute)} label="Categories" />
          </div>
          <Link
            href={withReturnTo("/categories/new", currentRoute)}
            aria-label="Add category"
            className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <Plus aria-hidden="true" className="size-[19px]" />
          </Link>
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
            <label className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-muted-foreground shadow-sm focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
              <Search aria-hidden="true" className="size-4 shrink-0" />
              <span className="sr-only">Search categories</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                aria-label="Search categories"
                className="w-20 min-w-0 bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground sm:w-28"
              />
            </label>
          </div>
          {isLoading ? (
            <div className="route-data-reveal mt-4 grid grid-cols-3 gap-2 min-[520px]:gap-3">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton className="h-32 rounded-[14px]" key={index} />
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
            <div className="route-data-reveal mt-4 grid grid-cols-3 gap-2 min-[520px]:gap-3">
              {filteredCategories.map((category, index) => {
                const iconColor = categoryForeground(category.color);
                const Icon = getCategoryIcon(category.icon, category.name);
                return (
                  <Link
                    href={withReturnTo(`/categories/${category.id}`, currentRoute)}
                    key={category.id}
                    style={
                      category.color
                        ? { backgroundColor: category.color }
                        : undefined
                    }
                    className={`group relative flex min-h-[128px] flex-col justify-between overflow-hidden rounded-[14px] border p-3 text-left transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgb(23_32_29_/_0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${colorClasses[index % colorClasses.length]}`}
                  >
                    <span
                      style={{ color: iconColor }}
                      className="flex size-10 items-center justify-center rounded-[11px] bg-white/60"
                    >
                      <Icon
                        aria-hidden="true"
                        className="size-[19px]"
                        strokeWidth={1.8}
                      />
                    </span>
                    <span className="mt-3 block min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold min-[520px]:text-[15px]">
                          {category.name}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-[10px] capitalize text-muted-foreground min-[520px]:text-xs">
                        {category.type} category
                      </span>
                      <span className="mt-2 block text-[12px] font-semibold tabular-nums text-muted-foreground min-[520px]:text-[13px]">
                        {category.usageFrequency > 0
                          ? `${category.usageFrequency} ${category.usageFrequency === 1 ? "transaction" : "transactions"}`
                          : "No activity yet"}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
