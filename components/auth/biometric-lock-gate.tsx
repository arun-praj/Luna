"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Fingerprint, LoaderCircle, LogOut, ShieldAlert } from "lucide-react";
import { getAccessTokenSubject, signOut } from "@/lib/auth-client";
import { canUseBiometricLock, clearBiometricLockForDifferentUser, disableBiometricLock, isBiometricLockEnabled, unlockWithBiometric } from "@/lib/biometric-lock";

const publicPaths = new Set(["/login", "/signup", "/forgot-password", "/reset-password", "/onboarding"]);

export function BiometricLockGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pathnameRef = useRef(pathname);
  const previousPathnameRef = useRef(pathname);
  const currentUserIdRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);
  const wasHiddenRef = useRef(false);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    pathnameRef.current = pathname;
    previousPathnameRef.current = pathname;
    if (publicPaths.has(previousPathname) && !publicPaths.has(pathname)) {
      const timer = window.setTimeout(() => {
        const userId = getAccessTokenSubject();
        if (!userId) return;
        clearBiometricLockForDifferentUser(userId);
        currentUserIdRef.current = userId;
        setIsLocked(isBiometricLockEnabled(userId));
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [pathname]);

  useEffect(() => {
    const evaluateLock = () => {
      if (publicPaths.has(pathnameRef.current)) {
        currentUserIdRef.current = null;
        setIsReady(true);
        setIsLocked(false);
        return;
      }
      const userId = getAccessTokenSubject();
      if (!userId) {
        currentUserIdRef.current = null;
        setIsReady(true);
        setIsLocked(false);
        return;
      }
      clearBiometricLockForDifferentUser(userId);
      const userChanged = currentUserIdRef.current !== userId;
      currentUserIdRef.current = userId;
      if (!hasInitializedRef.current || userChanged) {
        setIsLocked(isBiometricLockEnabled(userId));
      }
      setIsReady(true);
      hasInitializedRef.current = true;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        wasHiddenRef.current = true;
        return;
      }
      if (!wasHiddenRef.current || document.visibilityState !== "visible") return;
      wasHiddenRef.current = false;
      if (publicPaths.has(pathnameRef.current)) return;
      const userId = getAccessTokenSubject();
      if (!userId) {
        setIsLocked(false);
        return;
      }
      clearBiometricLockForDifferentUser(userId);
      currentUserIdRef.current = userId;
      setIsLocked(isBiometricLockEnabled(userId));
    };

    const timer = window.setTimeout(evaluateLock, 0);
    window.addEventListener("cocomelon:auth-changed", evaluateLock);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("cocomelon:auth-changed", evaluateLock);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

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
    disableBiometricLock();
    await signOut();
    router.replace("/login");
  }

  if (!isReady) return <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading Luna…</main>;
  if (!isLocked) return <>{children}</>;

  return (
    <div className="relative min-h-screen bg-background">
      <div aria-hidden="true" className="pointer-events-none select-none blur-md">{children}</div>
      <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 px-5 backdrop-blur-sm">
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
