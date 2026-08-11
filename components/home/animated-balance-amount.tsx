"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

import { TextMorph } from "@/components/shadcn-space/animated-text/animated-text-07";
import { cn } from "@/lib/utils";

type AnimatedBalanceAmountProps = {
  amount: string;
  hideTotalBalance: boolean;
  balanceRevealed: boolean;
  onToggleVisibility: () => void;
  href?: string;
  className?: string;
};

export function AnimatedBalanceAmount({
  amount,
  hideTotalBalance,
  balanceRevealed,
  onToggleVisibility,
  href,
  className,
}: AnimatedBalanceAmountProps) {
  const isMasked = hideTotalBalance && !balanceRevealed;
  const words = hideTotalBalance ? ["****", amount] : [amount];
  const activeIndex = isMasked ? 0 : hideTotalBalance ? 1 : 0;

  return (
    <span className="relative inline-flex max-w-full items-baseline align-baseline">
      <span aria-hidden="true">
        <TextMorph
          words={words}
          activeIndex={activeIndex}
          className={cn("inline-flex items-baseline font-bold tabular-nums", isMasked ? "text-foreground" : className)}
        />
      </span>
      {hideTotalBalance ? (
        <button
          type="button"
          onClick={onToggleVisibility}
          aria-label={isMasked ? "Show total balance" : "Hide total balance"}
          className="relative z-10 ml-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          {isMasked ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        </button>
      ) : href ? (
        <Link
          href={href}
          aria-label="View accounts"
          className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        />
      ) : null}
    </span>
  );
}
