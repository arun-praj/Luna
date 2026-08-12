"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Fingerprint, LoaderCircle, LogOut, ShieldAlert } from "lucide-react";
import { getAccessTokenSubject, signOut } from "@/lib/auth-client";
import { canUseBiometricLock, clearBiometricLockForDifferentUser, disableBiometricLock, isBiometricLockEnabled, unlockWithBiometric } from "@/lib/biometric-lock";
import { shouldEvaluateBiometricLockForEntry } from "@/lib/biometric-lock-policy";
import { LunaLoader } from "@/components/ui/luna-loader";

const publicPaths = new Set(["/login", "/signup", "/forgot-password", "/reset-password", "/onboarding"]);

export function BiometricLockGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const initializedUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    let evaluationVersion = 0;
    let pendingUserId: string | null = null;

    const evaluateLock = async () => {
      if (publicPaths.has(pathname)) {
        evaluationVersion += 1;
        initializedUserIdRef.current = null;
        if (!active) return;
        setIsReady(true);
        setIsLocked(false);
        return;
      }
      const userId = getAccessTokenSubject();
      if (!userId) {
        evaluationVersion += 1;
        initializedUserIdRef.current = null;
        if (!active) return;
        setIsReady(true);
        setIsLocked(false);
        return;
      }
      if (!shouldEvaluateBiometricLockForEntry({ isPublicPath: false, userId, initializedUserId: initializedUserIdRef.current })) {
        if (pendingUserId === userId) return;
        if (active) setIsReady(true);
        return;
      }
      const version = ++evaluationVersion;
      initializedUserIdRef.current = userId;
      pendingUserId = userId;
      await clearBiometricLockForDifferentUser(userId);
      const enabled = await isBiometricLockEnabled(userId);
      pendingUserId = null;
      if (!active || version !== evaluationVersion || getAccessTokenSubject() !== userId) return;
      setIsLocked(enabled);
      setIsReady(true);
    };

    const timer = window.setTimeout(() => void evaluateLock(), 0);
    const handleAuthChange = () => void evaluateLock();
    window.addEventListener("cocomelon:auth-changed", handleAuthChange);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener("cocomelon:auth-changed", handleAuthChange);
    };
  }, [pathname]);

  async function unlock() {
    setIsBusy(true);
    setMessage("");
    try {
      if (await unlockWithBiometric()) setIsLocked(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Fingerprint verification was cancelled.");
    } finally {
      setIsBusy(false);
    }
  }

  async function recover() {
    setIsBusy(true);
    try {
      await disableBiometricLock();
      await signOut();
      router.replace("/login");
    } finally {
      setIsBusy(false);
    }
  }

  if (!isReady) return <LunaLoader />;
  if (!isLocked) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen place-items-center px-5">
        <section aria-labelledby="biometric-lock-heading" className="w-full max-w-[360px] text-center">
          <div className="mx-auto grid size-20 place-items-center rounded-[24px] bg-primary-soft text-primary"><Fingerprint aria-hidden="true" className="size-10" /></div>
          <p className="mt-7 text-sm font-semibold text-primary">Luna</p>
          <h1 id="biometric-lock-heading" className="mt-2 text-[28px] font-semibold tracking-[-0.04em]">Unlock Luna</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Use your fingerprint, Face ID, or device screen lock to continue.</p>
          <button type="button" onClick={() => void unlock()} disabled={isBusy || !canUseBiometricLock()} className="mt-8 flex min-h-12 w-full items-center justify-center gap-2 rounded-[13px] bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_rgb(53_107_104_/_0.15)] hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">
            {isBusy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Fingerprint aria-hidden="true" className="size-4" />}
            {isBusy ? "Checking…" : "Unlock with biometrics"}
          </button>
          {!canUseBiometricLock() ? <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-expense"><ShieldAlert aria-hidden="true" className="size-3.5" />Biometric unlock is unavailable here.</p> : null}
          {message ? <p role="alert" className="mt-3 text-xs text-expense">{message}</p> : null}
          <button type="button" onClick={() => void recover()} disabled={isBusy} className="mt-7 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"><LogOut aria-hidden="true" className="size-3.5" />Sign out and disable on this device</button>
        </section>
      </div>
    </div>
  );
}
