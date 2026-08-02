"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch, safeReturnPath, signOut } from "@/lib/auth-client";

export function EmailVerificationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeReturnPath(searchParams.get("next"), "/onboarding");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("We’ll keep the code valid for 10 minutes.");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    void authenticatedFetch("/api/auth/me").then(async (response) => {
      if (!response.ok) router.replace(`/login?next=${encodeURIComponent(next)}`);
      else {
        const result = (await response.json()) as { user?: { emailVerifiedAt?: string | null } };
        if (result.user?.emailVerifiedAt) router.replace(next);
      }
    });
  }, [next, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    const response = await authenticatedFetch("/api/auth/email-verification/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) setError(result.error ?? "Could not verify that code");
    else router.replace(next);
    setIsSubmitting(false);
  }

  async function resend() {
    setIsResending(true);
    setError("");
    const response = await authenticatedFetch("/api/auth/email-verification/request", { method: "POST" });
    const result = await response.json().catch(() => ({})) as { message?: string; error?: string };
    if (response.ok) setMessage(result.message ?? "A new code is on its way.");
    else setError(result.error ?? "Could not send a new code");
    setIsResending(false);
  }

  return <form onSubmit={submit} className="mt-6 space-y-3"><label className="block"><span className="sr-only">Verification code</span><input autoFocus required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" className="min-h-14 w-full rounded-[13px] border border-border bg-card px-4 text-center text-2xl font-bold tracking-[0.35em] outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>{error ? <p role="alert" className="rounded-[11px] bg-expense-soft px-3 py-2.5 text-sm font-semibold text-expense">{error}</p> : <p className="text-center text-xs text-muted-foreground">{message}</p>}<button type="submit" disabled={isSubmitting || code.length !== 6} className="min-h-12 w-full rounded-[13px] bg-primary px-5 text-[15px] font-semibold text-primary-foreground disabled:opacity-60">{isSubmitting ? "Checking…" : "Verify email"}</button><button type="button" onClick={() => void resend()} disabled={isResending} className="min-h-10 w-full rounded-[13px] border border-border text-sm font-semibold text-primary">{isResending ? "Sending…" : "Send a new code"}</button><button type="button" onClick={() => void signOut().then(() => router.replace("/login"))} className="w-full pt-2 text-xs font-semibold text-muted-foreground">Use a different account</button></form>;
}
