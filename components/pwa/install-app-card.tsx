"use client";

import { Download, ExternalLink, Smartphone, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  canInstallPwa,
  getPwaInstallInstructions,
  isPwaInstalled,
  promptPwaInstall,
  subscribeToInstallPrompt,
} from "@/lib/pwa";
import { authenticatedFetch } from "@/lib/auth-client";

export function InstallAppCard() {
  const canInstall = useSyncExternalStore(subscribeToInstallPrompt, canInstallPwa, () => false);
  const installed = useSyncExternalStore(subscribeToInstallPrompt, isPwaInstalled, () => false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoadingDismissal, setIsLoadingDismissal] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void authenticatedFetch("/api/pwa/install").then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as { dismissedAt?: string | null };
      if (active) setIsDismissed(Boolean(result.dismissedAt));
    }).finally(() => {
      if (active) setIsLoadingDismissal(false);
    });
    return () => { active = false; };
  }, []);

  async function dismiss() {
    setIsDismissed(true);
    const response = await authenticatedFetch("/api/pwa/install", { method: "POST" });
    if (!response.ok) setIsDismissed(false);
  }

  async function install() {
    if (installed) return;
    if (!canInstall) {
      setMessage(getPwaInstallInstructions());
      return;
    }
    const result = await promptPwaInstall();
    if (result === "accepted") setMessage("Luna was added to your apps.");
    if (result === "dismissed") setMessage("Installation cancelled. You can install Luna from your browser menu anytime.");
    window.setTimeout(() => setMessage(""), 4200);
  }

  if (isLoadingDismissal || isDismissed || installed) return null;

  return (
    <section aria-labelledby="install-app-heading" className="mt-6 overflow-hidden rounded-[14px] border border-primary/15 bg-primary-soft/40">
      <div className="flex items-start gap-3 px-4 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
          <Smartphone aria-hidden="true" className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="install-app-heading" className="text-[15px] font-semibold">Take Luna with you</h2>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Install Luna for a faster, app-like way to check your money.</p>
          {message ? <p role="status" className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />{message}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => void install()} className="inline-flex min-h-9 items-center gap-1.5 rounded-[9px] bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
            <Download aria-hidden="true" className="size-3.5" /> {canInstall ? "Install" : "How to install"}
          </button>
          <button type="button" onClick={() => void dismiss()} aria-label="Dismiss install suggestion" className="flex size-9 items-center justify-center rounded-[9px] text-muted-foreground transition-colors hover:bg-primary-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
