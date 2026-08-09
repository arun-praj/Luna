import Link from "next/link";
import {
  ArrowLeft,
  ArrowLeftRight,
  CircleHelp,
  Landmark,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";

const featureItems = [
  {
    icon: WalletCards,
    title: "Track balances",
    description: "See the current balance for cash, bank, wallet, credit card, and other accounts.",
  },
  {
    icon: ReceiptText,
    title: "Record activity",
    description: "Every income, expense, adjustment, and transfer is tied to the account it affects.",
  },
  {
    icon: ArrowLeftRight,
    title: "Move money",
    description: "Transfers update both accounts so the movement is not counted as income or expense twice.",
  },
];

export default function AccountGuidePage() {
  return (
    <main className="page-route-enter min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-12 sm:px-5">
        <StickyPageHeader className="-mx-4 flex items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <Link
            href="/accounts"
            aria-label="Back to accounts"
            className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Accounts</p>
            <h1 className="truncate text-[26px] font-semibold tracking-[-0.04em]">Account guide</h1>
          </div>
        </StickyPageHeader>

        <section className="mt-7 rounded-[18px] border border-primary/15 bg-primary-soft/55 p-5 sm:p-6">
          <span className="flex size-11 items-center justify-center rounded-[12px] bg-card text-primary shadow-sm">
            <CircleHelp aria-hidden="true" className="size-6" />
          </span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Account guide</p>
          <h2 className="mt-1 text-[26px] font-semibold tracking-[-0.045em]">What is an account?</h2>
          <p className="mt-3 max-w-[58ch] text-sm leading-6 text-muted-foreground">
            An account is a place where money is held or tracked. Add each real-world place separately so Luna can show accurate balances and activity.
          </p>
        </section>

        <section aria-labelledby="account-features-heading" className="mt-8">
          <p className="px-1 text-xs font-medium text-muted-foreground">What you can do</p>
          <h2 id="account-features-heading" className="mt-1 px-1 text-[21px] font-semibold tracking-[-0.03em]">Account features</h2>
          <div className="mt-4 divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-card">
            {featureItems.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-3 px-4 py-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-primary-soft text-primary">
                  <Icon aria-hidden="true" className="size-[18px]" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="account-example-heading" className="mt-8">
          <p className="px-1 text-xs font-medium text-muted-foreground">Example</p>
          <h2 id="account-example-heading" className="mt-1 px-1 text-[21px] font-semibold tracking-[-0.03em]">Sample bank account</h2>
          <div className="mt-4 overflow-hidden rounded-[14px] border border-border bg-card">
            <div className="flex items-center gap-3 bg-primary-soft/55 px-4 py-4">
              <span className="flex size-10 items-center justify-center rounded-[11px] bg-card text-primary shadow-sm">
                <Landmark aria-hidden="true" className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Everyday account</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Bank account · NPR</p>
              </div>
              <p className="text-right text-sm font-semibold tabular-nums">NPR 13,000</p>
            </div>
            <div className="divide-y divide-border px-4">
              <div className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-muted-foreground">Opening balance</span><span className="font-semibold tabular-nums">NPR 10,000</span></div>
              <div className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-muted-foreground">Salary</span><span className="font-semibold tabular-nums text-income">+NPR 5,000</span></div>
              <div className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-muted-foreground">Groceries</span><span className="font-semibold tabular-nums text-expense">−NPR 2,000</span></div>
            </div>
          </div>
          <p className="mt-3 px-1 text-xs leading-5 text-muted-foreground">The current balance is calculated from the opening balance and account activity.</p>
        </section>

        <section aria-labelledby="account-types-heading" className="mt-8 rounded-[14px] border border-border bg-card p-4">
          <h2 id="account-types-heading" className="text-sm font-semibold">Common account types</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Use separate accounts for Cash, Bank accounts, Wallets, Credit cards, Savings, and Loans. Choose the type that best matches where the money is held or owed.</p>
        </section>
      </div>
    </main>
  );
}
