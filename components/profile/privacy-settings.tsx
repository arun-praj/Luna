"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronDown, CircleHelp, ShieldCheck, Trash2, X } from "lucide-react";
import { authenticatedFetch, clearAccessToken } from "@/lib/auth-client";
import { DataPortability } from "@/components/profile/data-portability";

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "";
}

export function PrivacySettingsCard() {
  const router = useRouter();
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"immediate" | "after_30_days" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [helpTopic, setHelpTopic] = useState<"delete" | null>(null);

  useEffect(() => {
    void authenticatedFetch("/api/privacy/delete").then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as { scheduledDeletion?: { scheduledFor?: string | null } | null };
      setScheduledFor(result.scheduledDeletion?.scheduledFor ?? null);
    });
  }, []);

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
      router.replace("/signup");
      return;
    }
    setScheduledFor(result.scheduledFor ?? null); setDeleteMode(null); setConfirmation(""); setMessage("Deletion is scheduled. You can cancel it while it is pending."); setIsDeleting(false);
  }

  return <>
    <section aria-labelledby="privacy-heading" className={`mt-3 overflow-hidden rounded-[14px] border bg-card transition-colors ${isOpen ? "border-primary/30" : "border-border"}`}>
      <div className={`flex min-h-[76px] items-center gap-2 px-4 py-3 transition-colors ${isOpen ? "bg-primary-soft/70" : "hover:bg-surface-subtle"}`}>
        <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)} className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary"><ShieldCheck aria-hidden="true" className="size-[18px]" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">Data controls</span><span id="privacy-heading" className="mt-0.5 block text-[15px] font-semibold">Privacy & your data</span><span className="mt-0.5 block text-xs text-muted-foreground">Import, export or delete your data.</span></span>
          <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-foreground-subtle transition-transform ${isOpen ? "rotate-180 text-primary" : ""}`} />
        </button>
      </div>
      {isOpen ? <div className="border-t-2 border-primary/15 bg-surface-subtle/55">
        <DataPortability embedded />
        <section className="border-t border-border px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-expense-soft text-expense"><Trash2 aria-hidden="true" className="size-[18px]" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><h2 className="text-sm font-semibold">Delete account</h2><HelpButton label="About account deletion" onClick={() => setHelpTopic("delete")} /></div>
              {scheduledFor ? <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-expense"><CalendarClock aria-hidden="true" className="size-3.5" />Scheduled for {formatDate(scheduledFor)}</p> : null}
            </div>
            {scheduledFor ? <button type="button" onClick={() => void cancelDeletion()} className="min-h-10 shrink-0 rounded-[10px] border border-primary/20 bg-primary-soft px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15">Cancel</button> : <button type="button" onClick={() => setDeleteMode("after_30_days")} className="min-h-10 shrink-0 rounded-[10px] border border-expense/20 bg-expense-soft px-3 text-xs font-semibold text-expense transition-colors hover:bg-expense/15">Manage</button>}
          </div>
        </section>
        {message ? <p role="status" className="border-t border-border bg-primary-soft px-4 py-3 text-xs font-semibold text-primary">{message}</p> : null}
        {error ? <p role="alert" className="border-t border-border bg-expense-soft px-4 py-3 text-xs font-semibold text-expense">{error}</p> : null}
      </div> : null}
    </section>
    {deleteMode ? <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 px-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="delete-account-title" className="w-full max-w-[430px] rounded-[18px] border border-border bg-background p-5 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 id="delete-account-title" className="text-lg font-semibold">{deleteMode === "immediate" ? "Delete Luna now?" : "Schedule account deletion?"}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{deleteMode === "immediate" ? "This immediately deletes your account and all related data." : "Your account will be deleted automatically after 30 days. You can cancel before then."} <strong className="text-foreground">This cannot be recovered.</strong></p></div><button type="button" aria-label="Close" onClick={() => { setDeleteMode(null); setConfirmation(""); }} className="flex size-9 items-center justify-center rounded-full border border-border"><X aria-hidden="true" className="size-4" /></button></div><label className="mt-5 block"><span className="text-xs font-semibold text-muted-foreground">Type DELETE to confirm</span><input autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} className="mt-2 min-h-11 w-full rounded-[10px] border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-expense focus:ring-4 focus:ring-expense/10" /></label><div className="mt-5 flex gap-2"><button type="button" onClick={() => { setDeleteMode(null); setConfirmation(""); }} className="min-h-11 flex-1 rounded-[10px] border border-border text-sm font-semibold">Keep account</button><button type="button" onClick={() => void confirmDeletion()} disabled={isDeleting || confirmation !== "DELETE"} className="min-h-11 flex-1 rounded-[10px] bg-expense px-3 text-sm font-semibold text-white disabled:opacity-50">{isDeleting ? "Updating…" : deleteMode === "immediate" ? "Delete now" : "Schedule"}</button></div><button type="button" onClick={() => setDeleteMode("immediate")} className="mt-4 w-full text-xs font-semibold text-expense">Delete immediately instead</button></section></div> : null}
    {helpTopic ? <PrivacyHelpSheet topic={helpTopic} onClose={() => setHelpTopic(null)} /> : null}
  </>;
}

function HelpButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" aria-label={label} onClick={onClick} className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"><CircleHelp aria-hidden="true" className="size-[18px]" /></button>;
}

function PrivacyHelpSheet({ topic, onClose }: { topic: "delete"; onClose: () => void }) {
  void topic;
  const content = { title: "About account deletion", body: "Manage scheduled deletion of your Luna account and related data. A scheduled deletion can be cancelled before it runs; permanent deletion cannot be undone." };
  return <div className="fixed inset-0 z-[90] flex items-end bg-foreground/25" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="privacy-help-title" className="w-full rounded-t-[24px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)]" onPointerDown={(event) => event.stopPropagation()}><div aria-hidden="true" className="mx-auto h-1.5 w-12 rounded-full bg-foreground/20" /><header className="flex items-center justify-between gap-3 border-b border-border py-3"><h2 id="privacy-help-title" className="text-base font-semibold">{content.title}</h2><button type="button" aria-label="Close help" onClick={onClose} className="flex size-10 items-center justify-center rounded-[10px] border border-border bg-card"><X aria-hidden="true" className="size-4" /></button></header><p className="py-5 text-sm leading-6 text-muted-foreground">{content.body}</p><button type="button" onClick={onClose} className="flex min-h-12 w-full items-center justify-center rounded-[12px] bg-primary text-sm font-semibold text-primary-foreground">Got it</button></section></div>;
}
