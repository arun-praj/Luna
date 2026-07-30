"use client";

import Link from "next/link";
import { Eye, EyeOff, Fingerprint, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Your login flow is ready to connect to the backend.");
  }

  return (
    <div className="mt-5">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="sr-only">Email address</span>
          <span className="relative block">
            <Mail
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-foreground-subtle"
            />
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="Email address"
              className="min-h-12 w-full rounded-[13px] border border-border bg-card px-4 pl-11 text-[15px] outline-none transition-colors placeholder:text-foreground-subtle focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </span>
        </label>

        <label className="block">
          <span className="sr-only">Password</span>
          <span className="relative block">
            <LockKeyhole
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-foreground-subtle"
            />
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              required
              placeholder="Password"
              className="min-h-12 w-full rounded-[13px] border border-border bg-card px-12 text-[15px] outline-none transition-colors placeholder:text-foreground-subtle focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-[9px] text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" className="size-[18px]" />
              ) : (
                <Eye aria-hidden="true" className="size-[18px]" />
              )}
            </button>
          </span>
        </label>

        <div className="flex justify-end px-1">
          <Link
            href="#forgot-password"
            className="text-[13px] font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          className="min-h-12 w-full rounded-[13px] bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-[0_8px_18px_rgb(53_107_104_/_0.15)] transition-[background-color,transform,box-shadow] hover:bg-primary-hover hover:shadow-[0_10px_24px_rgb(53_107_104_/_0.2)] active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
        >
          Log in
        </button>

        <button
          type="button"
          onClick={() => setMessage("Passkey sign-in will be available after setup.")}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] border border-border bg-card px-5 text-[14px] font-semibold text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
        >
          <Fingerprint aria-hidden="true" className="size-[19px] text-primary" />
          Use a passkey
        </button>
      </form>

      <p aria-live="polite" className="mt-4 min-h-5 text-center text-xs text-muted-foreground">
        {message}
      </p>

      <p className="mt-4 text-center text-[13px] text-muted-foreground">
        New here?{" "}
        <Link
          href="/signup"
          className="font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
