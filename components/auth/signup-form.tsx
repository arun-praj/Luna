"use client";

import Link from "next/link";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Phone } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { clearApiCache, emailVerificationPath, setPendingRegistrationToken } from "@/lib/auth-client";
import { waitForRegistrationHandoff } from "@/lib/auth-flow";

export function SignupForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const handoffStartedAt = Date.now();
    setIsSubmitting(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone") || undefined,
          password: form.get("password"),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        pendingToken?: string;
        verificationToken?: string;
        emailVerificationRequired?: boolean;
        verificationEmailDelivery?: "sent" | "queued" | "failed" | "unavailable";
        user?: {
          emailVerifiedAt?: string | null;
          onboardingCompleted?: boolean;
        };
      };
      if (!response.ok) throw new Error(result.error ?? "Unable to create account");
      const verificationToken = result.pendingToken ?? result.verificationToken;
      if (!verificationToken) throw new Error("Unable to start email verification");
      clearApiCache();
      if (!setPendingRegistrationToken(verificationToken)) {
        throw new Error("Unable to keep the verification step ready");
      }
      await waitForRegistrationHandoff(handoffStartedAt);
      router.replace(emailVerificationPath("/onboarding", result.verificationEmailDelivery));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to create account",
      );
    } finally {
      setIsSubmitting(false);
    }
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
          <span className="sr-only">Phone number optional</span>
          <span className="relative block">
            <Phone
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-foreground-subtle"
            />
            <input
              type="tel"
              name="phone"
              autoComplete="tel"
              placeholder="Phone number (optional)"
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
              autoComplete="new-password"
              minLength={8}
              required
              placeholder="Password (8+ characters)"
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
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-12 w-full rounded-[13px] bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-[0_8px_18px_rgb(53_107_104_/_0.15)] transition-[background-color,transform,box-shadow] hover:bg-primary-hover hover:shadow-[0_10px_24px_rgb(53_107_104_/_0.2)] active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-wait disabled:opacity-70"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2" role="status">
              <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
              <span>Creating account…</span>
            </span>
          ) : "Create account"}
        </button>
      </form>
      <p
        aria-live="polite"
        className="mt-3 min-h-5 text-center text-xs text-muted-foreground"
      >
        {message}
      </p>
      <p className="mt-2 text-center text-[13px] text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
