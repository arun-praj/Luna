import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CarFront,
  Gift,
  HeartPulse,
  House,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Utensils,
  WalletCards,
} from "lucide-react";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";

const categories = [
  {
    id: "housing",
    name: "Housing",
    description: "Rent, utilities, and home",
    amount: "12,400",
    icon: House,
    iconClassName: "bg-primary-soft text-primary",
    cardClassName: "border-[#c7dbd2] bg-[#e3eee9]",
  },
  {
    id: "dining",
    name: "Dining",
    description: "Restaurants and delivery",
    amount: "5,850",
    icon: Utensils,
    iconClassName: "bg-expense-soft text-expense",
    cardClassName: "border-[#e6c9c4] bg-[#f8e9e6]",
  },
  {
    id: "shopping",
    name: "Shopping",
    description: "Personal and household items",
    amount: "4,200",
    icon: ShoppingBag,
    iconClassName: "bg-warning-soft text-warning",
    cardClassName: "border-[#e3d2b6] bg-[#f3e8d4]",
  },
  {
    id: "transport",
    name: "Transport",
    description: "Travel and commuting",
    amount: "2,100",
    icon: CarFront,
    iconClassName: "bg-info-soft text-info",
    cardClassName: "border-[#cadde9] bg-[#e3eff6]",
  },
  {
    id: "health",
    name: "Health",
    description: "Medical and wellness",
    amount: "1,800",
    icon: HeartPulse,
    iconClassName: "bg-income-soft text-income",
    cardClassName: "border-[#c7dbd2] bg-[#e5f3eb]",
  },
  {
    id: "insurance",
    name: "Insurance",
    description: "Protection and coverage",
    amount: "1,250",
    icon: ShieldCheck,
    iconClassName: "bg-primary-soft text-primary",
    cardClassName: "border-[#d8cee7] bg-[#ece6f3]",
  },
  {
    id: "gifts",
    name: "Gifts",
    description: "Thoughtful moments",
    amount: "900",
    icon: Gift,
    iconClassName: "bg-expense-soft text-expense",
    cardClassName: "border-[#e6c9c4] bg-[#f8e9e6]",
  },
  {
    id: "income",
    name: "Income",
    description: "Salary and other earnings",
    amount: "48,500",
    icon: BriefcaseBusiness,
    iconClassName: "bg-income-soft text-income",
    cardClassName: "border-[#c7dbd2] bg-[#e5f3eb]",
  },
];

export default function CategoriesPage() {
  return (
    <main className="min-h-dvh animate-in fade-in-0 slide-in-from-right-4 bg-background duration-300 motion-reduce:animate-none">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-12 sm:px-5">
        <StickyPageHeader className="-mx-4 flex items-center justify-between gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              aria-label="Back to home"
              className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Link>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Manage your money</p>
              <h1 className="truncate text-[26px] font-semibold tracking-[-0.04em] sm:text-[28px]">
                Categories
              </h1>
            </div>
          </div>

          <Link
            href="/categories/new"
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
              <p className="text-sm font-medium text-white/75">Your spending is organized into</p>
              <p className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.05em]">
                {categories.length} categories
              </p>
            </div>
            <WalletCards aria-hidden="true" className="mb-1 size-10 text-white/35" strokeWidth={1.5} />
          </div>
          <div className="pointer-events-none absolute -right-6 -top-10 size-36 rounded-full border-[18px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-20 right-16 size-40 rounded-full border-[22px] border-white/[0.07]" />
        </section>

        <section aria-labelledby="category-list-heading" className="mt-9">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Keep every rupee in view</p>
              <h2 id="category-list-heading" className="mt-1 text-[21px] font-semibold tracking-[-0.03em]">
                All categories
              </h2>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Tap to view</p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 min-[520px]:gap-3">
            {categories.map((category) => {
              const Icon = category.icon;

              return (
                <Link
                  href={`/categories/${category.id}`}
                  key={category.name}
                  className={`group relative flex min-h-[128px] flex-col justify-between overflow-hidden rounded-[14px] border p-3 text-left transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgb(23_32_29_/_0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${category.cardClassName}`}
                >
                  <span className={`flex size-10 items-center justify-center rounded-[11px] ${category.iconClassName}`}>
                    <Icon aria-hidden="true" className="size-[19px]" strokeWidth={1.8} />
                  </span>
                  <span className="mt-3 block min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold min-[520px]:text-[15px]">{category.name}</span>
                    </span>
                    <span className="mt-1 block truncate text-[10px] text-muted-foreground min-[520px]:text-xs">{category.description}</span>
                    <span className="mt-2 block text-[12px] font-semibold tabular-nums text-foreground min-[520px]:text-[13px]">
                      <span className="mr-1 text-[10px] font-medium text-muted-foreground">NPR</span>
                      {category.amount}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
