"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Fingerprint, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { authenticatedFetch } from "@/lib/auth-client";
import { biometricErrorMessage, disableBiometricLock, enableBiometricLock, isBiometricLockEnabled, isBiometricPlatformAvailable } from "@/lib/biometric-lock";

type Status = { enabled: boolean; backupCodesRemaining: number };
type Setup = { secret: string; qrCodeDataUrl: string };

export function SecuritySettingsCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(() => typeof window !== "undefined" && isBiometricLockEnabled());
  const [isBiometricSupported, setIsBiometricSupported] = useState<boolean | null>(null);
  const [isBiometricBusy, setIsBiometricBusy] = useState(false);
  const [biometricMessage, setBiometricMessage] = useState("");

  useEffect(() => {
    let active = true;
    void isBiometricPlatformAvailable().then((available) => {
      if (active) setIsBiometricSupported(available);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isOpen || status) return;
    void authenticatedFetch("/api/auth/2fa").then(async (response) => {
      if (response.ok) setStatus((await response.json()) as Status);
    });
  }, [isOpen, status]);

  async function startSetup() {
    setIsBusy(true);
    setMessage("");
    const response = await authenticatedFetch("/api/auth/2fa", { method: "POST" });
    const result = (await response.json().catch(() => ({}))) as Setup & { error?: string };
    if (response.ok) setSetup(result);
    else setMessage(result.error ?? "Could not start authenticator setup");
    setIsBusy(false);
  }

  async function verifySetup() {
    setIsBusy(true);
    setMessage("");
    const response = await authenticatedFetch("/api/auth/2fa", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const result = (await response.json().catch(() => ({}))) as { error?: string; backupCodes?: string[] };
    if (response.ok) {
      setStatus({ enabled: true, backupCodesRemaining: result.backupCodes?.length ?? 0 });
      setBackupCodes(result.backupCodes ?? []);
      setSetup(null);
      setCode("");
    } else setMessage(result.error ?? "That code could not be verified");
    setIsBusy(false);
  }

  async function disableTwoFactor() {
    setIsBusy(true);
    setMessage("");
    const response = await authenticatedFetch("/api/auth/2fa", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.ok) {
      setStatus({ enabled: false, backupCodesRemaining: 0 });
      setCode("");
    } else setMessage(result.error ?? "Could not disable authenticator protection");
    setIsBusy(false);
  }

  async function registerBiometrics() {
    const response = await authenticatedFetch("/api/auth/me");
    if (!response.ok) throw new Error("Your session has expired. Please sign in again.");
    const result = (await response.json()) as { user: { id: string; name: string; email: string } };
    await enableBiometricLock(result.user);
  }

  async function enableBiometrics() {
    setIsBiometricBusy(true);
    setBiometricMessage("");
    try {
      await registerBiometrics();
      setIsBiometricEnabled(true);
    } catch (error) {
      setBiometricMessage(biometricErrorMessage(error));
    } finally {
      setIsBiometricBusy(false);
    }
  }

  async function resetBiometrics() {
    setIsBiometricBusy(true);
    setBiometricMessage("");
    disableBiometricLock();
    setIsBiometricEnabled(false);
    try {
      await registerBiometrics();
      setIsBiometricEnabled(true);
    } catch (error) {
      setBiometricMessage(biometricErrorMessage(error));
    } finally {
      setIsBiometricBusy(false);
    }
  }

  function disableBiometrics() {
    disableBiometricLock();
    setIsBiometricEnabled(false);
    setBiometricMessage("");
  }

  return (
    <section aria-labelledby="security-heading" className="mt-6 overflow-hidden rounded-[14px] border border-border bg-card">
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen((value) => !value)} className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary"><ShieldCheck aria-hidden="true" className="size-[18px]" /></span>
        <span className="min-w-0 flex-1"><span id="security-heading" className="block text-[15px] font-semibold">Security</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">Password and authenticator protection</span></span>
        <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-foreground-subtle transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen ? (
        <div className="border-t border-border px-4 py-5">
          <div className="rounded-[12px] border border-border bg-background p-4">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] ${isBiometricEnabled ? "bg-primary-soft text-primary" : "bg-surface-subtle text-primary"}`}>
                {isBiometricEnabled ? <CheckCircle2 aria-hidden="true" className="size-[18px]" /> : <Fingerprint aria-hidden="true" className="size-[18px]" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Fingerprint or device unlock</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Ask for fingerprint, Face ID, or your screen lock each time Luna opens.</p>
                <p className={`mt-2 text-xs font-semibold ${isBiometricEnabled ? "text-primary" : "text-muted-foreground"}`}>{isBiometricEnabled ? "Biometric unlock is on" : "Not enabled on this device"}</p>
              </div>
            </div>
            {isBiometricEnabled ? (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                <button type="button" onClick={() => void resetBiometrics()} disabled={isBiometricBusy} className="inline-flex min-h-9 items-center gap-1.5 rounded-[9px] border border-border px-3 text-xs font-semibold text-foreground hover:bg-surface-subtle disabled:opacity-50">
                  {isBiometricBusy ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : null}
                  Reset biometric
                </button>
                <button type="button" onClick={disableBiometrics} disabled={isBiometricBusy} className="min-h-9 rounded-[9px] border border-expense/25 px-3 text-xs font-semibold text-expense hover:bg-expense-soft disabled:opacity-50">Turn off</button>
              </div>
            ) : (
              <button type="button" onClick={() => void enableBiometrics()} disabled={isBiometricBusy || isBiometricSupported !== true} className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-primary px-3.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                {isBiometricBusy ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : null}
                {isBiometricBusy ? "Preparing…" : isBiometricSupported === null ? "Checking…" : "Turn on biometric unlock"}
              </button>
            )}
            {isBiometricSupported === false && !isBiometricEnabled ? <p className="mt-3 rounded-[10px] bg-surface-subtle px-3 py-2 text-xs leading-5 text-muted-foreground">Fingerprint or device biometric unlock is not available in this browser or device context. Try HTTPS or localhost in a full browser.</p> : null}
            {biometricMessage ? <p role="alert" className="mt-3 text-xs leading-5 text-expense">{biometricMessage}</p> : null}
          </div>
          <div className="mt-6 border-t border-border pt-5">
            <div className="flex items-start gap-3">
              <KeyRound aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Password</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Send a secure reset link to your email address.</p></div>
              <Link href="/forgot-password?returnTo=%2Fprofile" className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-[9px] px-2 text-xs font-semibold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">Reset password <ChevronRight aria-hidden="true" className="size-3.5" /></Link>
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-sm font-semibold">Authenticator app</p>
            <p className="mt-1 text-xs text-muted-foreground">Use Google Authenticator, Microsoft Authenticator, or another TOTP app.</p>
            {backupCodes.length ? (
              <div className="mt-3 rounded-[12px] border border-primary/25 bg-primary-soft p-3"><p className="text-xs font-semibold text-primary">Save these backup codes now. Each works once if you lose access to your authenticator.</p><div className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs text-foreground">{backupCodes.map((backupCode) => <span key={backupCode}>{backupCode}</span>)}</div><button type="button" onClick={() => setBackupCodes([])} className="mt-3 text-xs font-semibold text-primary underline underline-offset-2">I saved my backup codes</button></div>
            ) : status?.enabled ? (
              <div className="mt-3 space-y-3">
                <p className="rounded-[10px] bg-primary-soft px-3 py-2 text-xs font-medium text-primary">Authenticator protection is on. {status.backupCodesRemaining} backup codes remain.</p>
                <label className="block text-xs font-medium text-muted-foreground">Enter a current authenticator or backup code to turn it off<input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456 or XXXXX-XXXXX" className="mt-1 min-h-11 w-full rounded-[10px] border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
                <button type="button" onClick={() => void disableTwoFactor()} disabled={isBusy || code.length < 6} className="min-h-10 rounded-[10px] border border-expense/25 px-3 text-xs font-semibold text-expense disabled:opacity-50">{isBusy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : "Turn off authenticator"}</button>
              </div>
            ) : setup ? (
              <div className="mt-3 space-y-3 rounded-[12px] bg-surface-subtle p-3">
                <p className="text-xs font-medium">1. Scan this QR code in your authenticator app.</p>
                <Image src={setup.qrCodeDataUrl} alt="Authenticator setup QR code" width={180} height={180} unoptimized className="mx-auto rounded-[8px] bg-white p-2" />
                <p className="text-center text-[11px] text-muted-foreground">Can’t scan? Enter this key manually: <span className="font-mono font-semibold text-foreground">{setup.secret}</span></p>
                <label className="block text-xs font-medium text-muted-foreground">2. Enter the six-digit code<input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6} className="mt-1 min-h-11 w-full rounded-[10px] border border-border bg-background px-3 text-sm tracking-[0.25em] text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
                <button type="button" onClick={() => void verifySetup()} disabled={isBusy || code.length !== 6} className="min-h-10 w-full rounded-[10px] bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">{isBusy ? <LoaderCircle aria-hidden="true" className="mx-auto size-4 animate-spin" /> : "Verify and enable"}</button>
              </div>
            ) : (
              <button type="button" onClick={() => void startSetup()} disabled={isBusy} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">{isBusy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}{isBusy ? "Preparing…" : "Set up authenticator"}</button>
            )}
            {message ? <p role="alert" className="mt-2 text-xs font-semibold text-expense">{message}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
