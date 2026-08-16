import * as React from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  leading?: React.ReactNode;
  title: React.ReactNode;
  secondary?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

/**
 * The structural row used inside a StickyPageHeader.
 *
 * Keep the three columns explicit: navigation is always 44px, the title owns
 * every remaining pixel, and actions keep their usable touch size. The title
 * column is allowed to wrap so the action rail never becomes page overflow on
 * narrow phones.
 */
export function PageHeader({
  leading,
  title,
  secondary,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3",
        className,
      )}
    >
      <div className="flex size-11 min-w-0 shrink-0 items-center">
        {leading}
      </div>
      <div className="min-w-0 [overflow-wrap:anywhere]">{title}</div>
      <div className="flex min-w-0 max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5">
        {secondary ? <div className="max-[359px]:hidden">{secondary}</div> : null}
        {actions}
      </div>
    </div>
  );
}
