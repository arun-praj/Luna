"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ChevronDown, Download, ShieldCheck, Trash2, X } from "lucide-react";
import { authenticatedFetch, clearAccessToken } from "@/lib/auth-client";

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "";
}

export function PrivacySettingsCard() {
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"immediate" | "after_30_days" | null>(null);
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    void authenticatedFetch("/api/privacy/delete").then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as { scheduledDeletion?: { scheduledFor?: string | null } | null };
      setScheduledFor(result.scheduledDeletion?.scheduledFor ?? null);
    });
  }, []);

  async function exportData() {
    setIsExporting(true); setMessage(""); setError("");
    const response = await authenticatedFetch("/api/privacy/export", { method: "POST" });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      setError(result.error ?? "Could not prepare your export.");
      setIsExporting(false);
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `luna-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Your Luna data export has downloaded.");
    setIsExporting(false);
  }

  async function cancelDeletion() {
    const response = await authenticatedFetch("/api/privacy/delete", { method: "DELETE" });
    if (response.ok) { setScheduledFor(null); setMessage("Scheduled deletion cancelled."); }
  }

  async function confirmDeletion() {
    if (!deleteMode || confirmation !== "DELETE") return;
    setIsDeleting(true); setError("");
    const response = await authenticatedFetch("/api/privacy/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: deleteMode }) });
    const result = await response.json().catch(() => ({})) as { error?: string; scheduledFor?: string; deleted?: boolean };
    if (!response.ok) { setError(result.error ?? "Could not update account deletion."); setIsDeleting(false); return; }
    if (result.deleted) {
      clearAccessToken();
      window.location.assign("/signup");
      return;
    }
    setScheduledFor(result.scheduledFor ?? null); setDeleteMode(null); setConfirmation(""); setMessage("Your account is scheduled for deletion in 30 days. You can cancel it while it is pending."); setIsDeleting(false);
  }

  return <>
    <section aria-labelledby="privacy-heading" className="mt-6 overflow-hidden rounded-[14px] border border-border bg-card">
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)} className="flex min-h-[78px] w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35"><span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary"><ShieldCheck aria-hidden="true" className="size-[18px]" /></span><span className="min-w-0 flex-1"><span id="privacy-heading" className="block text-[15px] font-semibold">Privacy & your data</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Export a copy or permanently remove your Luna account.</span></span><ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-foreground-subtle transition-transform ${isOpen ? "rotate-180" : ""}`} /></button>
      {isOpen ? <div className="border-t border-border divide-y divide-border">
        <div className="px-4 py-4"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"><Download aria-hidden="true" className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Export your data</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Download your profile, accounts, categories, transactions, and settings as JSON. Luna records that an export happened, not the exported file.</p></div><button type="button" onClick={() => void exportData()} disabled={isExporting} className="shrink-0 rounded-[9px] border border-primary/25 bg-primary-soft px-3 py-2 text-xs font-semibold text-primary disabled:opacity-60">{isExporting ? "Preparing…" : "Export"}</button></div></div>
        <div className="px-4 py-4"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-expense-soft text-expense"><Trash2 aria-hidden="true" className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Delete account</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Deletion removes all related Luna data and cannot be recovered.</p>{scheduledFor ? <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-expense"><CalendarClock aria-hidden="true" className="size-3.5" /> Scheduled for {formatDate(scheduledFor)}</p> : null}</div>{scheduledFor ? <button type="button" onClick={() => void cancelDeletion()} className="shrink-0 rounded-[9px] border border-border px-3 py-2 text-xs font-semibold text-primary">Cancel</button> : <button type="button" onClick={() => setDeleteMode("after_30_days")} className="shrink-0 rounded-[9px] border border-expense/25 bg-expense-soft px-3 py-2 text-xs font-semibold text-expense">Manage</button>}</div></div>
      </div> : null}
      {isOpen ? <>
        {message ? <p role="status" className="border-t border-border bg-primary-soft px-4 py-3 text-xs font-semibold text-primary">{message}</p> : null}
        {error ? <p role="alert" className="border-t border-border bg-expense-soft px-4 py-3 text-xs font-semibold text-expense">{error}</p> : null}
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Need help? <a className="font-semibold text-primary" href="mailto:support@luna.app">Contact Luna support</a>.</p>
      </> : null}
    </section>
    {deleteMode ? <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 px-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="delete-account-title" className="w-full max-w-[430px] rounded-[18px] border border-border bg-background p-5 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 id="delete-account-title" className="text-lg font-semibold">{deleteMode === "immediate" ? "Delete Luna now?" : "Schedule account deletion?"}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{deleteMode === "immediate" ? "This immediately deletes your account and all related data." : "Your account will be deleted automatically after 30 days. You can cancel before then."} <strong className="text-foreground">This cannot be recovered.</strong></p></div><button type="button" aria-label="Close" onClick={() => { setDeleteMode(null); setConfirmation(""); }} className="flex size-9 items-center justify-center rounded-full border border-border"><X aria-hidden="true" className="size-4" /></button></div><label className="mt-5 block"><span className="text-xs font-semibold text-muted-foreground">Type DELETE to confirm</span><input autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} className="mt-2 min-h-11 w-full rounded-[10px] border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-expense focus:ring-4 focus:ring-expense/10" /></label><div className="mt-5 flex gap-2"><button type="button" onClick={() => { setDeleteMode(null); setConfirmation(""); }} className="min-h-11 flex-1 rounded-[10px] border border-border text-sm font-semibold">Keep account</button><button type="button" onClick={() => void confirmDeletion()} disabled={isDeleting || confirmation !== "DELETE"} className="min-h-11 flex-1 rounded-[10px] bg-expense px-3 text-sm font-semibold text-white disabled:opacity-50">{isDeleting ? "Updating…" : deleteMode === "immediate" ? "Delete now" : "Schedule"}</button></div><button type="button" onClick={() => setDeleteMode("immediate")} className="mt-4 w-full text-xs font-semibold text-expense">Delete immediately instead</button></section></div> : null}
  </>;
}
