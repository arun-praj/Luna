export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-md bg-foreground/[0.08] ${className}`}
    />
  );
}

export function PageDataSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <main aria-label={label} className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-12 sm:px-5">
        <div className="flex items-center gap-3 border-b border-border px-0 pb-3 pt-4 sm:pt-10">
          <Skeleton className="size-11 rounded-[11px]" />
          <Skeleton className="h-7 w-36" />
        </div>
        <Skeleton className="mt-8 h-28 w-full rounded-[18px]" />
        <Skeleton className="mt-8 h-8 w-40" />
        <div className="mt-4 grid grid-cols-2 gap-3 min-[420px]:grid-cols-3">
          <Skeleton className="h-32 rounded-[14px]" />
          <Skeleton className="h-32 rounded-[14px]" />
          <Skeleton className="h-32 rounded-[14px]" />
        </div>
      </div>
    </main>
  );
}

export function ListDataSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-label="Loading data" className="mt-4 space-y-2">
      {Array.from({ length: rows }, (_, index) => (
        <div
          className="flex min-h-20 items-center gap-3 rounded-[14px] border border-border bg-card px-4"
          key={index}
        >
          <Skeleton className="size-10 rounded-[11px]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
