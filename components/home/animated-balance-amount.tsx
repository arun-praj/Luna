"use client";

import Link from "next/link";

import { TextMorph } from "@/components/shadcn-space/animated-text/animated-text-07";
import { cn } from "@/lib/utils";

type AnimatedBalanceAmountProps = {
  amount: string;
  hideTotalBalance: boolean;
  balanceRevealed: boolean;
  onReveal: () => void;
  href?: string;
  className?: string;
};

export function AnimatedBalanceAmount({
  amount,
  hideTotalBalance,
  balanceRevealed,
  onReveal,
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
      {isMasked ? (
        <button
          type="button"
          onClick={onReveal}
          aria-label="Reveal total balance for 5 seconds"
          className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        />
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
