"use client";

import { ArrowLeft } from "lucide-react";
import { type ClipboardEvent, type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch, clearPendingRegistrationToken, getPendingRegistrationToken, safeReturnPath, setAccessToken, signOut } from "@/lib/auth-client";

const CODE_LENGTH = 6;

export function BackToLoginButton() {
  const router = useRouter();
  const [isLeaving, setIsLeaving] = useState(false);

  async function leaveVerification() {
    setIsLeaving(true);
    await signOut();
    router.replace("/login");
  }

  return <button type="button" aria-label="Back to login" disabled={isLeaving} onClick={() => void leaveVerification()} className="flex size-11 items-center justify-center rounded-[10px] border border-border bg-card text-foreground disabled:opacity-60"><ArrowLeft aria-hidden="true" className="size-5" /></button>;
}

export function EmailVerificationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeReturnPath(searchParams.get("next"), "/onboarding");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("We’ll keep the code valid for 10 minutes.");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [pendingToken] = useState(() => getPendingRegistrationToken());
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (pendingToken) return;
    void authenticatedFetch("/api/auth/me").then(async (response) => {
      if (!response.ok) router.replace(`/login?next=${encodeURIComponent(next)}`);
      else {
        const result = (await response.json()) as { user?: { emailVerifiedAt?: string | null } };
        if (result.user?.emailVerifiedAt) router.replace(next);
      }
    });
  }, [next, pendingToken, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    const response = await (pendingToken ? fetch("/api/auth/email-verification/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, pendingToken }) }) : authenticatedFetch("/api/auth/email-verification/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }));
    const result = await response.json().catch(() => ({})) as { error?: string; accessToken?: string };
    if (!response.ok) setError(result.error ?? "Could not verify that code");
    else {
      if (result.accessToken) setAccessToken(result.accessToken);
      clearPendingRegistrationToken();
      router.replace(next);
    }
    setIsSubmitting(false);
  }

  async function resend() {
    setIsResending(true);
    setError("");
    const response = await (pendingToken ? fetch("/api/auth/email-verification/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pendingToken }) }) : authenticatedFetch("/api/auth/email-verification/request", { method: "POST" }));
    const result = await response.json().catch(() => ({})) as { message?: string; error?: string };
    if (response.ok) setMessage(result.message ?? "A new code is on its way.");
    else setError(result.error ?? "Could not send a new code");
    setIsResending(false);
  }

  function updateCode(index: number, input: string) {
    const digits = input.replace(/\D/g, "");
    if (!digits) {
      setCode((current) => `${current.slice(0, index)}${current.slice(index + 1)}`);
      return;
    }
    const next = Array.from({ length: CODE_LENGTH }, (_, position) => code[position] ?? "");
    digits.slice(0, CODE_LENGTH - index).split("").forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    const nextCode = next.join("").slice(0, CODE_LENGTH);
    setCode(nextCode);
    inputRefs.current[Math.min(index + digits.length, CODE_LENGTH - 1)]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      event.preventDefault();
      setCode((current) => `${current.slice(0, index - 1)}${current.slice(index)}`);
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!digits) return;
    setCode(digits);
    inputRefs.current[Math.min(digits.length, CODE_LENGTH - 1)]?.focus();
  }

  return <form onSubmit={submit} className="mt-6 space-y-3"><div role="group" aria-label="Verification code" className="grid grid-cols-6 gap-2"><span className="sr-only">Enter the six-digit verification code</span>{Array.from({ length: CODE_LENGTH }, (_, index) => <input key={index} ref={(element) => { inputRefs.current[index] = element; }} type="text" inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} pattern="[0-9]" maxLength={1} value={code[index] ?? ""} onChange={(event) => updateCode(index, event.target.value)} onKeyDown={(event) => handleKeyDown(index, event)} onPaste={handlePaste} autoFocus={index === 0} aria-label={`Verification code digit ${index + 1} of ${CODE_LENGTH}`} className="size-full min-h-14 rounded-[13px] border border-border bg-card text-center text-2xl font-bold tabular-nums outline-none transition-colors focus:border-primary focus:ring-4 focus:ring-primary/10" />)}</div>{error ? <p role="alert" className="rounded-[11px] bg-expense-soft px-3 py-2.5 text-sm font-semibold text-expense">{error}</p> : <p className="text-center text-xs text-muted-foreground">{message}</p>}<button type="submit" disabled={isSubmitting || code.length !== CODE_LENGTH} className="min-h-12 w-full rounded-[13px] bg-primary px-5 text-[15px] font-semibold text-primary-foreground disabled:opacity-60">{isSubmitting ? "Checking…" : "Verify email"}</button><button type="button" onClick={() => void resend()} disabled={isResending} className="min-h-10 w-full rounded-[13px] border border-border text-sm font-semibold text-primary">{isResending ? "Sending…" : "Send a new code"}</button><button type="button" onClick={() => void signOut().then(() => router.replace("/login"))} className="w-full pt-2 text-xs font-semibold text-muted-foreground">Use a different account</button></form>;
}
