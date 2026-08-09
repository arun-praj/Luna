"use client";

import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Info, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicUserProfile } from "@/backend/auth/profile";
import { authenticatedFetch, clearApiCache, primeApiCache, safeReturnPath, setAccessToken } from "@/lib/auth-client";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "info" | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [returnPath] = useState(() => typeof window === "undefined" ? "/" : safeReturnPath(new URLSearchParams(window.location.search).get("next")));
  const sessionCheckAbort = useRef<AbortController | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    sessionCheckAbort.current = controller;
    void authenticatedFetch("/api/auth/me", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const result = (await response.json()) as { user?: { onboardingCompleted?: boolean; emailVerifiedAt?: string | null } };
        if (active) router.replace(result.user?.emailVerifiedAt ? (result.user?.onboardingCompleted ? returnPath : "/onboarding") : `/verify-email?next=${encodeURIComponent(returnPath)}`);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      controller.abort();
      if (sessionCheckAbort.current === controller) sessionCheckAbort.current = null;
    };
  }, [returnPath, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setMessageTone("");
    // Do not let the initial session probe finish after login and clear the
    // access token that was just issued.
    sessionCheckAbort.current?.abort();
    sessionCheckAbort.current = null;
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(challengeToken ? "/api/auth/login/2fa" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(challengeToken ? { challengeToken, code: form.get("code") } : { email: form.get("email"), password: form.get("password") }),
          deviceLabel: "Web browser",
        }),
      });
      const responseText = await response.text();
      let result: { accessToken?: string; error?: string; twoFactorRequired?: boolean; challengeToken?: string; user?: PublicUserProfile } = {};
      try {
        result = responseText.trim()
            ? (JSON.parse(responseText) as {
              accessToken?: string;
              error?: string;
              user?: PublicUserProfile;
            })
          : {};
      } catch {
        throw new Error(
          response.ok
            ? "Unable to read the login response."
            : `Unable to log in (HTTP ${response.status}).`,
        );
      }
      if (!response.ok) throw new Error(result.error ?? "Unable to log in");
      if (result.twoFactorRequired && result.challengeToken) {
        setChallengeToken(result.challengeToken);
        setMessage("Enter the code from your authenticator app, or use a backup code.");
        setMessageTone("info");
        return;
      }
      if (!result.accessToken)
        throw new Error("Login response was missing an access token.");
      clearApiCache();
      if (result.user) primeApiCache("/api/auth/me", { user: result.user });
      setAccessToken(result.accessToken);
      router.push(
        result.user?.emailVerifiedAt ? (result.user?.onboardingCompleted ? returnPath : "/onboarding") : `/verify-email?next=${encodeURIComponent(returnPath)}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to log in");
      setMessageTone("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-5">
      <form onSubmit={handleSubmit} className="space-y-3">
        {challengeToken ? (
          <label className="block">
            <span className="sr-only">Authenticator code</span>
            <input type="text" name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus required minLength={6} maxLength={20} placeholder="Authenticator or backup code" className="min-h-12 w-full rounded-[13px] border border-border bg-card px-4 text-[15px] tracking-[0.12em] outline-none transition-colors placeholder:tracking-normal placeholder:text-foreground-subtle focus:border-primary focus:ring-4 focus:ring-primary/10" />
          </label>
        ) : <>
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
            href="/forgot-password?returnTo=%2Flogin"
            className="text-[13px] font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            Forgot password?
          </Link>
        </div>
        </>}

        {message ? (
          <p
            role={messageTone === "error" ? "alert" : "status"}
            aria-live={messageTone === "error" ? "assertive" : "polite"}
            className={`flex items-center gap-2 rounded-[11px] border px-3 py-2.5 text-left text-sm font-semibold ${
              messageTone === "error"
                ? "border-expense/30 bg-expense-soft text-expense"
                : "border-primary/20 bg-primary-soft text-primary"
            }`}
          >
            {messageTone === "error" ? (
              <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <Info aria-hidden="true" className="size-4 shrink-0" />
            )}
            <span>{message}</span>
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-12 w-full rounded-[13px] bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-[0_8px_18px_rgb(53_107_104_/_0.15)] transition-[background-color,transform,box-shadow] hover:bg-primary-hover hover:shadow-[0_10px_24px_rgb(53_107_104_/_0.2)] active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
        >
          {isSubmitting ? <LoaderCircle aria-hidden="true" className="mx-auto size-5 animate-spin" /> : challengeToken ? "Verify code" : "Log in"}
        </button>
        {challengeToken ? <button type="button" onClick={() => { setChallengeToken(""); setMessage(""); setMessageTone(""); }} className="min-h-10 w-full rounded-[13px] border border-border text-sm font-semibold text-muted-foreground">Back to login</button> : null}

      </form>

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
