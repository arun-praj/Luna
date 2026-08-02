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
        "sticky top-0 z-20 w-[calc(100%+2rem)] self-start border-b bg-background/95 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur transition-[border-color,box-shadow] sm:w-[calc(100%+2.5rem)] sm:pt-8",
        scrolled
          ? "border-border/80 shadow-[0_1px_0_rgb(23_32_29_/_0.02)]"
          : "border-transparent",
        className,
      )}
    >
      {children}
    </header>
  );
}
