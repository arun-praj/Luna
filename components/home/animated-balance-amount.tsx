"use client";

import Link from "next/link";
import { EyeOff } from "lucide-react";

import { TextMorph } from "@/components/shadcn-space/animated-text/animated-text-07";
import { cn } from "@/lib/utils";

type AnimatedBalanceAmountProps = {
  amount: string;
  hideTotalBalance: boolean;
  balanceRevealed: boolean;
  revealSecondsRemaining: number;
  onToggleVisibility: () => void;
  href?: string;
  className?: string;
};

export function AnimatedBalanceAmount({
  amount,
  hideTotalBalance,
  balanceRevealed,
  revealSecondsRemaining,
  onToggleVisibility,
  href,
  className,
}: AnimatedBalanceAmountProps) {
  const isMasked = hideTotalBalance && !balanceRevealed;
  const words = hideTotalBalance ? ["****", amount] : [amount];
  const activeIndex = isMasked ? 0 : hideTotalBalance ? 1 : 0;

  const balanceText = (
    <span aria-hidden="true">
      <TextMorph
        words={words}
        activeIndex={activeIndex}
        className={cn("inline-flex items-baseline font-bold tabular-nums", isMasked ? "text-foreground" : className)}
      />
    </span>
  );

  return (
    <span className="relative inline-flex max-w-full items-baseline align-baseline">
      {hideTotalBalance ? (
        <button
          type="button"
          onClick={onToggleVisibility}
          aria-label={isMasked ? "Show total balance" : `Hide total balance, ${revealSecondsRemaining} seconds remaining`}
          className="relative z-10 inline-flex max-w-full cursor-pointer items-baseline bg-transparent text-left text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          {balanceText}
          <span className="ml-2 flex size-7 shrink-0 items-center justify-center">
            {isMasked ? <EyeOff aria-hidden="true" className="size-4" /> : <span role="timer" aria-live="polite" className="text-[10px] font-bold tabular-nums">{revealSecondsRemaining}s</span>}
          </span>
        </button>
      ) : href ? (
        <Link
          href={href}
          aria-label="View accounts"
          className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          {balanceText}
        </Link>
      ) : balanceText}
    </span>
  );
}
