import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  ListFilter,
  Plus,
} from "lucide-react";
import { accountImages } from "@/lib/account-images";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";

const accounts = [
  {
    id: "primary-account",
    name: "Primary account",
    type: "Bank account",
    balance: "12,600.01",
    income: "40,000",
    expenses: "27,399.99",
    image: accountImages.primary,
    cardClassName: "border-[#c7dbd2] bg-[#e3eee9]",
    detailsClassName: "border-[#c7dbd2] bg-white/45",
  },
  {
    id: "esewa",
    name: "eSewa",
    type: "Digital wallet",
    balance: "1,900",
    income: "1,900",
    expenses: "0",
    image: accountImages.esewa,
    cardClassName: "border-[#cadde9] bg-[#e3eff6]",
    detailsClassName: "border-[#cadde9] bg-white/45",
  },
  {
    id: "savings",
    name: "Savings",
    type: "Savings account",
    balance: "5,000",
    income: "5,000",
    expenses: "0",
    image: accountImages.savings,
    cardClassName: "border-[#d8cee7] bg-[#ece6f3]",
    detailsClassName: "border-[#d8cee7] bg-white/45",
  },
  {
    id: "cash",
    name: "Cash",
    type: "Cash account",
    balance: "500",
    income: "0",
    expenses: "220",
    image: accountImages.cash,
    cardClassName: "border-[#e3d2b6] bg-[#f3e8d4]",
    detailsClassName: "border-[#e3d2b6] bg-white/45",
  },
];

export default function AccountsPage() {
  return (
    <main className="min-h-dvh animate-in fade-in-0 slide-in-from-right-4 bg-background duration-300 motion-reduce:animate-none">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-10 sm:px-5">
        <StickyPageHeader className="-mx-4 flex items-center justify-between gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              aria-label="Back to home"
              className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Link>
            <h1 className="text-[28px] font-semibold tracking-[-0.04em]">
              Accounts
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Sort and organize accounts"
              className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <ListFilter aria-hidden="true" className="size-[19px]" />
            </button>
            <Link
              href="/accounts/new"
              aria-label="Add new account"
              className="flex size-11 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary transition-colors hover:border-primary/40 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <Plus aria-hidden="true" className="size-5" />
            </Link>
          </div>
        </StickyPageHeader>

        <section
          aria-label="Account balance summary"
          className="mt-8 grid grid-cols-2 divide-x divide-border rounded-[14px] border border-border bg-card"
        >
          <div className="min-w-0 px-4 py-4">
            <p className="text-xs font-semibold text-muted-foreground">
              Total balance
            </p>
            <p className="mt-2 truncate text-[22px] font-semibold tracking-[-0.035em] tabular-nums text-foreground">
              <span className="mr-1 text-xs tracking-normal text-muted-foreground">
                NPR
              </span>
              20,000.01
            </p>
          </div>
          <div className="min-w-0 px-4 py-4">
            <p className="text-xs font-semibold text-muted-foreground">
              Excluded from total
            </p>
            <p className="mt-2 truncate text-[22px] font-semibold tracking-[-0.035em] tabular-nums text-foreground">
              <span className="mr-1 text-xs tracking-normal text-muted-foreground">
                NPR
              </span>
              5,000
            </p>
          </div>
        </section>

        <section aria-labelledby="account-list-heading" className="mt-8">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Your money
              </p>
              <h2
                id="account-list-heading"
                className="mt-1 text-[20px] font-semibold tracking-[-0.03em]"
              >
                All accounts
              </h2>
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              {accounts.length} accounts
            </p>
          </div>

          <div className="mt-3 space-y-3">
            {accounts.map((account) => {
              return (
                <Link
                  href={`/accounts/${account.id}`}
                  key={account.name}
                  className={`group block w-full overflow-hidden rounded-[14px] border text-left transition-[filter,transform] hover:brightness-[0.985] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${account.cardClassName}`}
                >
                  <span className="flex min-h-[72px] items-center gap-3 px-4 py-3">
                    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-white/80 bg-white/45 shadow-[0_1px_2px_rgba(23,32,29,0.06)]">
                      <Image
                        src={account.image}
                        alt=""
                        aria-hidden="true"
                        width={44}
                        height={44}
                        className="size-full object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">
                        {account.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {account.type}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[17px] font-semibold tracking-[-0.025em] tabular-nums">
                        {account.balance}
                      </span>
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        NPR
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-foreground-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    />
                  </span>

                  <span
                    className={`grid grid-cols-2 divide-x divide-current/10 border-t ${account.detailsClassName}`}
                  >
                    <span className="px-4 py-2.5">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Income this month
                      </span>
                      <span className="mt-0.5 block text-[13px] font-semibold tabular-nums text-income">
                        +NPR {account.income}
                      </span>
                    </span>
                    <span className="px-4 py-2.5">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Expenses this month
                      </span>
                      <span className="mt-0.5 block text-[13px] font-semibold tabular-nums text-expense">
                        −NPR {account.expenses}
                      </span>
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
