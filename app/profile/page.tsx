import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  CircleDollarSign,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { arunAvatar } from "@/lib/avatar";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";

const profileSections = [
  {
    label: "Personal information",
    description: "Name, email, and profile image",
    icon: UserRound,
  },
  {
    label: "Currency and region",
    description: "NPR · Nepal",
    icon: CircleDollarSign,
  },
  {
    label: "Notifications",
    description: "Budget alerts and reminders",
    icon: Bell,
  },
  {
    label: "Security",
    description: "Password and connected devices",
    icon: ShieldCheck,
  },
];

export default function ProfilePage() {
  return (
    <main className="min-h-screen animate-in fade-in-0 slide-in-from-right-4 duration-300 motion-reduce:animate-none bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-12 sm:px-5">
        <StickyPageHeader className="-mx-4 flex items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <Link
            href="/"
            aria-label="Back to home"
            className="flex size-11 items-center justify-center rounded-[10px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
          </Link>
          <h1 className="text-[24px] font-semibold tracking-[-0.035em]">
            Profile
          </h1>
        </StickyPageHeader>

        <section className="mt-10 flex flex-col items-center text-center">
          <Image
            src={arunAvatar}
            alt="Arun's Fun Emoji avatar"
            width={88}
            height={88}
            unoptimized
            priority
            className="size-[88px] rounded-[18px] border border-border bg-primary-soft"
          />
          <h2 className="mt-4 text-[22px] font-semibold tracking-[-0.03em]">
            Arun
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            arun@example.com
          </p>
        </section>

        <section aria-label="Profile settings" className="mt-10">
          <div className="overflow-hidden rounded-[14px] border border-border bg-card">
            {profileSections.map((item, index) => {
              const Icon = item.icon;

              return (
                <button
                  type="button"
                  className={`flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 ${
                    index > 0 ? "border-t border-border" : ""
                  }`}
                  key={item.label}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                    <Icon aria-hidden="true" className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-5 shrink-0 text-foreground-subtle"
                  />
                </button>
              );
            })}
          </div>
        </section>

        <button
          type="button"
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] border border-expense/25 bg-expense-soft px-4 text-sm font-semibold text-expense transition-colors hover:bg-expense/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-expense/25"
        >
          <LogOut aria-hidden="true" className="size-[18px]" />
          Sign out
        </button>
      </div>
    </main>
  );
}
