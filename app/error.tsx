"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Luna route failed", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-12 text-foreground">
      <section className="w-full max-w-md rounded-[24px] border border-border bg-card p-7 shadow-[0_18px_55px_rgb(21_47_45_/_0.10)]">
        <span className="flex size-12 items-center justify-center rounded-[14px] bg-primary-soft text-2xl" aria-hidden="true">
          ☾
        </span>
        <p className="mt-6 text-sm font-semibold text-primary">Luna is still here</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">This page hit a snag</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your data was not changed. Try loading the page again, or return home.
        </p>
        <div className="mt-7 grid grid-cols-2 gap-3">
          <Link className="flex h-12 items-center justify-center rounded-[13px] border border-border font-semibold" href="/">
            Go home
          </Link>
          <button className="h-12 rounded-[13px] bg-primary font-semibold text-primary-foreground" type="button" onClick={reset}>
            Try again
          </button>
        </div>
      </section>
    </main>
  );
}
