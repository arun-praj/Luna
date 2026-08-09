"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CircleHelp, DatabaseBackup, Download, FileUp, LoaderCircle, Upload, X } from "lucide-react";
import { authenticatedFetch, notifyTransactionsChanged } from "@/lib/auth-client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Stats = { exports: number; imports: number };
type ImportResult = { itemCount: number; counts: { accounts: number; transactions: number; loans: number; goals: number; recurringTemplates: number; savingsInstruments: number } };

function downloadResponse(blob: Blob, disposition: string | null) {
  const filename = disposition?.match(/filename="([^"]+)"/)?.[1] ?? `luna-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataPortability({ embedded = false }: { embedded?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<Stats>({ exports: 0, imports: 0 });
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [helpTopic, setHelpTopic] = useState<"backup" | "import" | null>(null);

  async function loadStats() {
    const response = await authenticatedFetch("/api/privacy/portability-stats");
    if (response.ok) setStats(await response.json() as Stats);
  }

  // The request resolves asynchronously; the effect only starts the external synchronization.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadStats(); }, []);

  async function exportBackup() {
    setBusy("export"); setError(""); setResult(null);
    try {
      const response = await authenticatedFetch("/api/privacy/export", { method: "POST" });
      if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error ?? "Could not create backup");
      downloadResponse(await response.blob(), response.headers.get("content-disposition"));
      await loadStats();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create backup"); }
    finally { setBusy(null); }
  }

  function requestImport(file: File) {
    if (!file.name.toLocaleLowerCase().endsWith(".json")) { setError("Choose a Luna JSON backup"); return; }
    if (file.size > 25 * 1024 * 1024) { setError("The backup must be smaller than 25 MB"); return; }
    setError("");
    setImportFile(file);
  }

  async function importBackup() {
    if (!importFile) return;
    setBusy("import"); setError(""); setResult(null);
    try {
      const response = await authenticatedFetch("/api/privacy/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: await importFile.text() });
      const payload = await response.json().catch(() => null) as (ImportResult & { error?: string }) | null;
      if (!response.ok || !payload) throw new Error(payload?.error ?? "Could not import backup");
      setResult(payload); notifyTransactionsChanged(); await loadStats();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not import backup"); }
    finally { setBusy(null); setImportFile(null); if (inputRef.current) inputRef.current.value = ""; }
  }

  const sectionClass = embedded ? "px-4 py-3" : "rounded-[16px] border border-border bg-card p-4";
  return <div className={embedded ? "divide-y divide-border" : "space-y-4"}>
    <section className={sectionClass}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary"><DatabaseBackup aria-hidden="true" className="size-5" /></span>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <h2 className="min-w-0 font-semibold">Back up your data</h2>
          <HelpButton label="About data backups" onClick={() => setHelpTopic("backup")} />
        </div>
        <button type="button" disabled={busy !== null} onClick={exportBackup} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-primary/20 bg-primary-soft px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50">
          {busy === "export" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Download aria-hidden="true" className="size-4" />}
          Export
        </button>
      </div>
    </section>
    <section className={sectionClass}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary"><FileUp aria-hidden="true" className="size-5" /></span>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <h2 className="min-w-0 font-semibold">Import data</h2>
          <HelpButton label="About importing backups" onClick={() => setHelpTopic("import")} />
        </div>
        <button type="button" disabled={busy !== null} onClick={() => inputRef.current?.click()} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-primary/20 bg-primary-soft px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50">
          {busy === "import" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Upload aria-hidden="true" className="size-4" />}
          Import
        </button>
      </div>
      <input ref={inputRef} type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) requestImport(file); }} />
    </section>
    {error ? <p role="alert" className={`${embedded ? "mx-4 my-3" : ""} rounded-[12px] bg-expense-soft p-3 text-sm font-medium text-expense`}>{error}</p> : null}
    {result ? <section className={`${embedded ? "m-4" : ""} rounded-[14px] border border-income/25 bg-income-soft p-4 text-sm text-income`}><p className="flex items-center gap-2 font-semibold"><Check aria-hidden="true" className="size-4" />Imported {result.itemCount.toLocaleString()} records</p><p className="mt-1 opacity-80">{result.counts.transactions} transactions · {result.counts.accounts} accounts · {result.counts.loans} loans</p></section> : null}
    <section className={`${embedded ? "px-4 py-4" : ""} grid grid-cols-2 gap-2`}>
      <div className="rounded-[13px] border border-border bg-card p-3.5"><p className="text-xs text-muted-foreground">Exports</p><p className="mt-1 text-2xl font-semibold tabular-nums">{stats.exports}</p></div>
      <div className="rounded-[13px] border border-border bg-card p-3.5"><p className="text-xs text-muted-foreground">Imports</p><p className="mt-1 text-2xl font-semibold tabular-nums">{stats.imports}</p></div>
    </section>
    {importFile ? <ConfirmDialog
      open
      title="Import this backup?"
      description="Its data will be added to your existing Luna data. Nothing will be replaced."
      confirmLabel="Import backup"
      busy={busy === "import"}
      onCancel={() => {
        if (busy === "import") return;
        setImportFile(null);
        if (inputRef.current) inputRef.current.value = "";
      }}
      onConfirm={importBackup}
    /> : null}
    {helpTopic ? <DataHelpSheet topic={helpTopic} onClose={() => setHelpTopic(null)} /> : null}
  </div>;
}

function HelpButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" aria-label={label} onClick={onClick} className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"><CircleHelp aria-hidden="true" className="size-[18px]" /></button>;
}

function DataHelpSheet({ topic, onClose }: { topic: "backup" | "import"; onClose: () => void }) {
  const content = topic === "backup"
    ? { title: "About backups", body: "Your backup includes accounts, transactions, categories, tags, goals, loans, saving instruments, budgets, recurring items, and their history. Login details and notification settings are never included." }
    : { title: "About importing", body: "Import a Luna JSON backup from any account. Records are added beside your current data with new identifiers, so existing records are not replaced." };
  return <div className="fixed inset-0 z-[90] flex items-end bg-foreground/25" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="data-help-title" className="w-full rounded-t-[24px] border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)]" onPointerDown={(event) => event.stopPropagation()}><div aria-hidden="true" className="mx-auto h-1.5 w-12 rounded-full bg-foreground/20" /><header className="flex items-center justify-between gap-3 border-b border-border py-3"><h2 id="data-help-title" className="text-base font-semibold">{content.title}</h2><button type="button" aria-label="Close help" onClick={onClose} className="flex size-10 items-center justify-center rounded-[10px] border border-border bg-card"><X aria-hidden="true" className="size-4" /></button></header><p className="py-5 text-sm leading-6 text-muted-foreground">{content.body}</p><button type="button" onClick={onClose} className="flex min-h-12 w-full items-center justify-center rounded-[12px] bg-primary text-sm font-semibold text-primary-foreground">Got it</button></section></div>;
}
