"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function StickyPageHeader({
  className,
  children,
}: React.ComponentProps<"header">) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header
      className={cn(
        "luna-sticky-page-header sticky top-0 z-20 w-[calc(100%+2rem)] self-start border-b bg-background/72 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl backdrop-saturate-150 transition-[background-color,border-color,box-shadow] supports-[backdrop-filter]:bg-background/68 sm:w-[calc(100%+2.5rem)] sm:pt-8",
        scrolled
          ? "border-border/70 bg-background/82 shadow-[0_8px_24px_rgb(23_32_29_/_0.06)] supports-[backdrop-filter]:bg-background/76"
          : "border-border/35 shadow-[0_1px_0_rgb(255_255_255_/_0.35)]",
        className,
      )}
    >
      {children}
    </header>
  );
}
