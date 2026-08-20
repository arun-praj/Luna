export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading Luna"
      className="grid min-h-dvh place-items-center bg-background px-5"
    >
      <div className="w-full max-w-[720px] space-y-4" aria-hidden="true">
        <div className="h-11 w-full animate-pulse rounded-[14px] bg-surface-subtle" />
        <div className="h-28 w-full animate-pulse rounded-[18px] bg-surface-subtle" />
        <div className="h-44 w-full animate-pulse rounded-[18px] bg-surface-subtle" />
      </div>
    </main>
  );
}
