"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, LoaderCircle, Mail, LockKeyhole } from "lucide-react";
import { authenticatedFetch } from "@/lib/auth-client";

function Notice({ message, success = false }: { message: string; success?: boolean }) {
  return message ? <p role={success ? "status" : "alert"} className={`flex items-center gap-2 rounded-[11px] border px-3 py-2.5 text-sm font-semibold ${success ? "border-primary/20 bg-primary-soft text-primary" : "border-expense/30 bg-expense-soft text-expense"}`}>{success ? <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" /> : <AlertCircle aria-hidden="true" className="size-4 shrink-0" />}{message}</p> : null;
}

export function ForgotPasswordForm({ returnTo = "/login", accountOnly = false }: { returnTo?: string; accountOnly?: boolean }) {
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    void authenticatedFetch("/api/auth/me").then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as { user?: { email?: string } };
      if (active && result.user?.email) {
        setEmail(result.user.email);
        setIsSignedIn(true);
      }
    }).finally(() => {
      if (active) setIsCheckingSession(false);
    });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setSuccess(false);
    const response = await ((isSignedIn || accountOnly) ? authenticatedFetch("/api/auth/password-reset/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(accountOnly ? {} : { email }) }) : fetch("/api/auth/password-reset/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }));
    const result = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    setMessage(response.ok ? (result.message ?? "Check your inbox for the reset link.") : (result.error ?? "Could not send a reset link."));
    setSuccess(response.ok);
    setIsSubmitting(false);
  }

  return <div className="mt-6 space-y-4"><form onSubmit={submit} className="space-y-3"><label className="block"><span className="sr-only">Email address</span><span className="relative block"><Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-foreground-subtle" /><input type="email" name="email" autoComplete="email" required={!accountOnly} placeholder={isCheckingSession ? "Checking signed-in account…" : accountOnly ? "Signed-in account email" : "Email address"} value={email} onChange={(event) => setEmail(event.target.value)} readOnly={isSignedIn || accountOnly} disabled={isCheckingSession} className="min-h-12 w-full rounded-[13px] border border-border bg-card px-4 pl-11 text-[15px] outline-none placeholder:text-foreground-subtle focus:border-primary focus:ring-4 focus:ring-primary/10 read-only:bg-surface-subtle disabled:opacity-70" /></span></label>{isSignedIn || accountOnly ? <p className="text-xs leading-5 text-muted-foreground">{isSignedIn ? "You’re signed in, so the reset link can only be sent to this account." : "This reset request is locked to the signed-in account. No other email can be entered."}</p> : null}<Notice message={message} success={success} /><button type="submit" disabled={isSubmitting || isCheckingSession || (!accountOnly && !email)} className="flex min-h-12 w-full items-center justify-center rounded-[13px] bg-primary px-5 text-[15px] font-semibold text-primary-foreground disabled:opacity-60">{isSubmitting ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : "Send reset link"}</button></form><Link href={returnTo} className="flex items-center justify-center gap-2 text-sm font-semibold text-primary"><ArrowLeft aria-hidden="true" className="size-4" /> Back</Link></div>;
}

function ResetPasswordFormInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setSuccess(false);
    const form = new FormData(event.currentTarget);
    if (!token) { setMessage("This password reset link is missing its token."); setIsSubmitting(false); return; }
    if (form.get("password") !== form.get("confirmPassword")) { setMessage("Passwords do not match."); setIsSubmitting(false); return; }
    const response = await fetch("/api/auth/password-reset/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: form.get("password") }) });
    const result = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    setMessage(response.ok ? (result.message ?? "Password updated.") : (result.error ?? "Could not update your password."));
    setSuccess(response.ok);
    setIsSubmitting(false);
  }

  return <div className="mt-6 space-y-4"><form onSubmit={submit} className="space-y-3"><label className="block"><span className="sr-only">New password</span><span className="relative block"><LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-foreground-subtle" /><input type="password" name="password" minLength={8} maxLength={128} autoComplete="new-password" required placeholder="New password" className="min-h-12 w-full rounded-[13px] border border-border bg-card px-4 pl-11 text-[15px] outline-none placeholder:text-foreground-subtle focus:border-primary focus:ring-4 focus:ring-primary/10" /></span></label><label className="block"><span className="sr-only">Confirm new password</span><input type="password" name="confirmPassword" minLength={8} maxLength={128} autoComplete="new-password" required placeholder="Confirm new password" className="min-h-12 w-full rounded-[13px] border border-border bg-card px-4 text-[15px] outline-none placeholder:text-foreground-subtle focus:border-primary focus:ring-4 focus:ring-primary/10" /></label><Notice message={message} success={success} /><button type="submit" disabled={isSubmitting || !token} className="flex min-h-12 w-full items-center justify-center rounded-[13px] bg-primary px-5 text-[15px] font-semibold text-primary-foreground disabled:opacity-60">{isSubmitting ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : "Update password"}</button></form><Link href="/login" className="flex items-center justify-center gap-2 text-sm font-semibold text-primary"><ArrowLeft aria-hidden="true" className="size-4" /> Back to login</Link></div>;
}

export function ResetPasswordForm() {
  return <Suspense fallback={<p className="mt-6 text-sm text-muted-foreground">Loading reset link…</p>}><ResetPasswordFormInner /></Suspense>;
}
