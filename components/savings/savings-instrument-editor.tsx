"use client";

import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronDown, ImagePlus, LoaderCircle, Palette, Plus, Trash2, X } from "lucide-react";

import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { authenticatedFetch } from "@/lib/auth-client";
import { AuthenticatedImage } from "@/components/ui/authenticated-image";
import { navigateWithRouteExit } from "@/lib/route-motion";
import { getReturnTo } from "@/lib/navigation";
import { useAnimatedVisibility } from "@/lib/use-animated-visibility";
import { formatMoney, MoneyEditor } from "@/components/money/money-editor";
import { getSavingsIconSource, savingsColorOptions, savingsImageOptions } from "@/lib/savings-appearance";
import { Calendar } from "@/components/ui/calendar";
import { useUnsavedChangesGuard } from "@/components/ui/unsaved-changes-dialog";

type InstrumentType = { id: string; name: string; isDefault: boolean };
export type SavingsInstrumentEditorData = {
  id: string;
  typeId: string;
  typeName?: string;
  name: string;
  description: string;
  currentBalance: number;
  interestRate: number | null;
  icon: string;
  backgroundColor: string;
  maturityDate: string | null;
};

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMaturityDate(value: string) {
  return format(new Date(`${value}T12:00:00`), "dd/MM/yyyy");
}

export function SavingsInstrumentEditor({ instrumentId }: { instrumentId?: string }) {
  const router = useRouter();
  const isNew = !instrumentId;
  const [backHref, setBackHref] = useState("/savings-instruments");
  const [types, setTypes] = useState<InstrumentType[]>([]);
  const [currency, setCurrency] = useState("NPR");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [typeId, setTypeId] = useState("");
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [isSavingType, setIsSavingType] = useState(false);
  const [balance, setBalance] = useState("0");
  const [interestRate, setInterestRate] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("Growth");
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [customImageFile, setCustomImageFile] = useState<File | null>(null);
  const [selectedColor, setSelectedColor] = useState<number | "custom">(0);
  const [customColor, setCustomColor] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(instrumentId));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageStatus, setImageStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [error, setError] = useState("");
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setBackHref(getReturnTo("/savings-instruments"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const [balanceEditorOpen, setBalanceEditorOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [initialDraft, setInitialDraft] = useState<string | null>(null);
  const typeTransition = useAnimatedVisibility(isTypeOpen);
  const dateTransition = useAnimatedVisibility(dateOpen);

  const draftSnapshot = JSON.stringify({ currency, name, description, typeId, balance, interestRate, maturityDate, selectedIcon, customImage, selectedColor, customColor });
  const { requestDiscard, discardDialog } = useUnsavedChangesGuard(initialDraft !== null && draftSnapshot !== initialDraft);

  useEffect(() => {
    if (isLoading || initialDraft !== null) return;
    const frame = window.requestAnimationFrame(() => setInitialDraft(draftSnapshot));
    return () => window.cancelAnimationFrame(frame);
  }, [draftSnapshot, isLoading, initialDraft]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      authenticatedFetch("/api/savings/instrument-types"),
      authenticatedFetch("/api/auth/me"),
      instrumentId ? authenticatedFetch(`/api/savings/instruments/${instrumentId}`) : Promise.resolve(null),
    ]).then(async ([typesResponse, userResponse, instrumentResponse]) => {
      const typeResult = typesResponse.ok ? await typesResponse.json() as { instrumentTypes?: InstrumentType[] } : { instrumentTypes: [] };
      const userResult = userResponse.ok ? await userResponse.json() as { user?: { currency?: string } } : {};
      if (!active) return;
      const nextTypes = typeResult.instrumentTypes ?? [];
      setTypes(nextTypes);
      setCurrency(userResult.user?.currency ?? "NPR");
      if (instrumentResponse) {
        if (!instrumentResponse.ok) throw new Error("Savings instrument not found.");
        const result = await instrumentResponse.json() as { instrument: SavingsInstrumentEditorData };
        const instrument = result.instrument;
        setName(instrument.name);
        setDescription(instrument.description ?? "");
        setTypeId(instrument.typeId);
        setBalance(String(instrument.currentBalance ?? 0));
        setInterestRate(instrument.interestRate == null ? "" : String(instrument.interestRate));
        setMaturityDate(instrument.maturityDate ?? "");
        setSelectedIcon(instrument.icon ?? "Growth");
        if (instrument.icon?.startsWith("/api/uploads/savings-images/")) { setCustomImage(instrument.icon); setImageStatus("success"); }
        const colorIndex = savingsColorOptions.findIndex((option) => option.backgroundColor.toLowerCase() === instrument.backgroundColor?.toLowerCase());
        if (colorIndex >= 0) setSelectedColor(colorIndex);
        else if (instrument.backgroundColor) { setCustomColor(instrument.backgroundColor); setSelectedColor("custom"); }
      }
      if (!instrumentId && nextTypes[0]) setTypeId(nextTypes[0].id);
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load savings instrument."); }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [instrumentId]);

  const selectedBackground = selectedColor === "custom" ? customColor : savingsColorOptions[selectedColor]?.backgroundColor ?? savingsColorOptions[0].backgroundColor;
  const previewIcon = customImage ?? getSavingsIconSource(selectedIcon);
  const displayBalance = useMemo(() => formatMoney(balance), [balance]);
  const canSave = Boolean(name.trim() && typeId && parseNumber(balance) >= 0 && (interestRate.trim() === "" || parseNumber(interestRate) >= 0));

  function selectImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { setImageStatus("error"); setError("Choose a JPG, PNG, WebP, or GIF image under 5 MB."); return; }
    setCustomImageFile(file); setCustomImage(URL.createObjectURL(file)); setSelectedIcon("custom"); setImageStatus("idle"); setError("");
  }

  async function addInstrumentType() {
    const trimmedName = newTypeName.trim();
    if (!trimmedName || isSavingType) return;
    setIsSavingType(true);
    setError("");
    const response = await authenticatedFetch("/api/savings/instrument-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmedName }),
    }).catch(() => null);
    if (!response?.ok) {
      const result = await response?.json().catch(() => null) as { error?: string } | null;
      setError(result?.error ?? "Could not add savings instrument type.");
      setIsSavingType(false);
      return;
    }
    const result = await response.json() as { instrumentType: InstrumentType };
    setTypes((current) => [...current, result.instrumentType].sort((a, b) => a.name.localeCompare(b.name)));
    setTypeId(result.instrumentType.id);
    setNewTypeName("");
    setIsTypeOpen(false);
    setIsSavingType(false);
  }

  async function saveInstrument() {
    if (!canSave) { setError("Add a name, type, and valid amounts before saving."); return; }
    setIsSaving(true); setError("");
    let icon = selectedIcon === "custom" ? customImage : selectedIcon;
    if (customImageFile) {
      setImageStatus("uploading");
      const formData = new FormData(); formData.set("file", customImageFile);
      const uploadResponse = await authenticatedFetch("/api/uploads/savings-images", { method: "POST", body: formData }).catch(() => null);
      if (!uploadResponse?.ok) { setError("Could not upload the savings icon."); setImageStatus("error"); setIsSaving(false); return; }
      const uploadResult = await uploadResponse.json() as { url?: string };
      icon = uploadResult.url ?? icon;
      setImageStatus("success");
    }
    const payload = { typeId, name: name.trim(), description: description.trim(), currentBalance: parseNumber(balance), interestRate: interestRate.trim() ? parseNumber(interestRate) : null, icon: icon ?? "Growth", backgroundColor: selectedBackground, maturityDate: maturityDate || null };
    const response = await authenticatedFetch(isNew ? "/api/savings/instruments" : `/api/savings/instruments/${instrumentId}`, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) { const result = await response.json().catch(() => null) as { error?: string } | null; setError(result?.error ?? "Could not save savings instrument."); setIsSaving(false); return; }
    navigateWithRouteExit(() => router.push(backHref));
  }

  async function deleteInstrument() {
    if (!instrumentId) return;
    setIsDeleting(true);
    const response = await authenticatedFetch(`/api/savings/instruments/${instrumentId}`, { method: "DELETE" });
    if (response.ok) {
      // The editor may have been opened from the deleted detail route. Always
      // land on the collection page after deletion instead of replaying that
      // stale URL through returnTo/browser history.
      navigateWithRouteExit(() => router.push("/savings-instruments"));
    } else {
      setError("Could not delete savings instrument.");
      setIsDeleting(false);
    }
  }

  return (
    <main className="page-route-enter min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-12 sm:px-5">
        <StickyPageHeader className="-mx-4 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <Link href={backHref} aria-label={isNew ? "Cancel new savings instrument" : "Cancel editing savings instrument"} onClick={(event) => { event.preventDefault(); requestDiscard(() => navigateWithRouteExit(() => router.push(backHref))); }} className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card text-foreground"><X aria-hidden="true" className="size-5" /></Link>
          <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Saving Instruments</p><h1 className="truncate text-[25px] font-semibold tracking-[-0.04em]">{isNew ? "New instrument" : "Edit instrument"}</h1></div>
          <button type="button" aria-label={isNew ? "Add savings instrument" : "Save savings instrument changes"} onClick={() => void saveInstrument()} disabled={!canSave || isSaving || isLoading || imageStatus === "uploading"} className="flex size-11 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary disabled:pointer-events-none disabled:border-border disabled:bg-surface-subtle disabled:text-foreground-subtle"><Check aria-hidden="true" className="size-5" /></button>
        </StickyPageHeader>
        {error ? <p role="alert" className="mt-4 rounded-[10px] border border-expense/25 bg-expense-soft px-3 py-2 text-sm text-expense">{error}</p> : null}
        {isLoading ? <div className="mt-10 flex min-h-60 items-center justify-center text-sm text-muted-foreground">Loading instrument…</div> : <>
          <section className="mt-6 border-y border-border py-6 text-center">
            <div className="mx-auto flex size-16 items-center justify-center overflow-hidden rounded-[18px] border border-border" style={{ backgroundColor: selectedBackground }}><AuthenticatedImage src={previewIcon} alt="" width={64} height={64} className="size-full object-cover" unoptimized /></div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current balance</p>
            <button type="button" onClick={() => setBalanceEditorOpen(true)} className="mt-2 block w-full text-[46px] font-semibold leading-none tracking-[-0.06em] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">{displayBalance}<span className="ml-2 text-sm font-semibold tracking-normal text-primary">{currency}</span></button>
            <p className="mt-3 text-xs text-muted-foreground">Tap the balance to edit</p>
          </section>
          <section className="mt-5 space-y-6 rounded-[16px] border border-border bg-card p-4 min-[390px]:p-5">
            <div><label htmlFor="savings-name" className="text-sm font-semibold">Instrument name</label><input id="savings-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Company Pension" className="mt-2 h-12 w-full rounded-[10px] border border-input bg-background px-4 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></div>
            <div><label htmlFor="savings-type" className="text-sm font-semibold">Saving instrument type</label><div className="mt-2"><button id="savings-type" type="button" aria-haspopup="dialog" aria-expanded={isTypeOpen} onClick={() => setIsTypeOpen(true)} className={`flex h-12 w-full items-center gap-3 rounded-[10px] border bg-background px-3 text-left text-sm font-semibold outline-none transition-colors hover:border-border-strong focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 ${isTypeOpen ? "border-primary" : "border-input"}`}><span className="min-w-0 flex-1">{types.find((type) => type.id === typeId)?.name ?? "Choose a type"}</span><ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></button></div></div>
            <div><label htmlFor="savings-description" className="text-sm font-semibold">Description</label><textarea id="savings-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="What is this instrument for?" className="mt-2 block w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></div>
            <div className="grid grid-cols-2 gap-3"><div><label htmlFor="savings-interest" className="text-sm font-semibold">Interest rate <span className="text-xs font-medium text-muted-foreground">(optional)</span></label><div className="relative mt-2"><input id="savings-interest" inputMode="decimal" value={interestRate} onChange={(event) => setInterestRate(event.target.value)} placeholder="Optional" className="h-12 w-full rounded-[10px] border border-input bg-background px-3 pr-8 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span></div></div><div><label htmlFor="savings-maturity" className="text-sm font-semibold">Maturity date <span className="text-xs font-medium text-muted-foreground">(optional)</span></label><button id="savings-maturity" type="button" onClick={() => setDateOpen(true)} className="mt-2 flex h-12 w-full items-center gap-2 rounded-[10px] border border-input bg-background px-3 text-left text-sm outline-none transition-colors hover:border-border-strong focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"><CalendarDays aria-hidden="true" className="size-4 shrink-0 text-foreground" /><span className={maturityDate ? "font-medium" : "text-muted-foreground"}>{maturityDate ? formatMaturityDate(maturityDate) : "dd / mm / yyyy"}</span></button></div></div>
          </section>
          <section className="mt-5 rounded-[16px] border border-border bg-card p-4 min-[390px]:p-5"><fieldset><legend className="text-sm font-semibold">Instrument icon</legend><div className="mt-3 flex flex-wrap gap-3">{savingsImageOptions.map((option) => <button type="button" key={option.name} aria-label={option.name} aria-pressed={selectedIcon === option.name} onClick={() => { setSelectedIcon(option.name); setCustomImageFile(null); }} className={`rounded-[12px] border p-1 ${selectedIcon === option.name ? "border-primary bg-primary-soft" : "border-border bg-background"}`}><Image src={option.src} alt="" width={44} height={44} unoptimized className="size-11 rounded-[9px]" /></button>)}{customImage ? <button type="button" aria-label="Custom uploaded image" aria-pressed={selectedIcon === "custom"} onClick={() => setSelectedIcon("custom")} className={`rounded-[12px] border p-1 ${selectedIcon === "custom" ? "border-primary bg-primary-soft" : "border-border bg-background"}`}><AuthenticatedImage src={customImage} alt="" width={44} height={44} className="size-11 rounded-[9px] object-cover" /></button> : null}<label className="flex h-[54px] min-w-[104px] cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-dashed border-border-strong px-3 text-xs font-semibold text-muted-foreground"><span className="sr-only">Upload custom savings icon</span><input type="file" accept="image/*" className="sr-only" onChange={(event) => selectImage(event.target.files?.[0])} />{imageStatus === "uploading" ? <LoaderCircle className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}{imageStatus === "uploading" ? "Uploading…" : "Upload"}</label></div><p className="mt-2 text-xs text-muted-foreground">Use a preset or upload a custom image up to 5 MB.</p></fieldset><fieldset className="mt-6 min-w-0"><legend className="text-sm font-semibold">Instrument color</legend><div className="mt-3 min-w-0 max-w-full overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="flex w-max min-w-max gap-3">{savingsColorOptions.map((option, index) => <button type="button" key={option.name} aria-label={option.name} aria-pressed={selectedColor === index} onClick={() => setSelectedColor(index)} className={`flex size-11 shrink-0 items-center justify-center rounded-full border ${option.cardClassName} ${option.accentClassName}`}>{selectedColor === index ? <Check className="size-4" strokeWidth={2.5} /> : null}</button>)}<label className="relative flex size-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-border-strong bg-background text-muted-foreground"><Palette className="relative z-10 size-4" /><span className="sr-only">Choose custom instrument color</span><input type="color" value={customColor || savingsColorOptions[0].backgroundColor} onChange={(event) => { setCustomColor(event.target.value); setSelectedColor("custom"); }} className="absolute inset-0 size-full cursor-pointer opacity-0" /></label></div></div><p className="mt-1 text-xs text-muted-foreground">Swipe to see more colors.</p></fieldset></section>
          {!isNew ? <section className="mt-8 border-t border-border pt-6"><button type="button" onClick={() => void deleteInstrument()} disabled={isDeleting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[11px] border border-expense/25 bg-expense-soft px-4 text-sm font-semibold text-expense disabled:opacity-60"><Trash2 className="size-[18px]" />{isDeleting ? "Deleting…" : "Delete instrument"}</button><p className="mt-2 text-center text-xs text-muted-foreground">Existing contribution history will remain available.</p></section> : null}
        </>}
      </div>
      <MoneyEditor open={balanceEditorOpen} value={balance} title="Edit current balance" previousLabel="Previous balance" onCancel={() => setBalanceEditorOpen(false)} onSet={(nextBalance) => { setBalance(nextBalance); setBalanceEditorOpen(false); }} />
      {typeTransition.mounted ? (
        <div role="dialog" aria-modal="true" aria-labelledby="savings-type-title" className={`fixed inset-0 z-[70] flex items-end bg-foreground/25 ${typeTransition.closing ? "drawer-scrim-exit" : "drawer-scrim-enter"}`}>
          <div className={`${typeTransition.closing ? "drawer-exit" : "drawer-enter"} flex max-h-[88dvh] w-full flex-col rounded-t-[24px] border-t border-border bg-background shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)]`}>
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-foreground/20" aria-hidden="true" />
            <header className="flex shrink-0 items-center justify-between border-b border-border px-4 pb-3 pt-3">
              <button type="button" aria-label="Close savings instrument type picker" onClick={() => setIsTypeOpen(false)} className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card"><X aria-hidden="true" className="size-5" /></button>
              <h2 id="savings-type-title" className="text-base font-semibold">Choose a type</h2>
              <button type="button" onClick={() => setIsTypeOpen(false)} className="rounded-[10px] bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">Done</button>
            </header>
            <div className="min-h-0 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div role="listbox" aria-label="Saving instrument types" className="py-3">
                {types.map((type) => <button key={type.id} type="button" role="option" aria-selected={typeId === type.id} onClick={() => { setTypeId(type.id); setIsTypeOpen(false); }} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-[10px] px-3 text-left text-sm font-semibold transition-colors hover:bg-surface-subtle focus-visible:bg-primary-soft focus-visible:outline-none ${typeId === type.id ? "bg-primary-soft text-primary" : ""}`}><span>{type.name}</span>{typeId === type.id ? <Check aria-hidden="true" className="size-4 shrink-0" /> : null}</button>)}
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-sm font-semibold">Add your own type</p>
                <p className="mt-1 text-xs text-muted-foreground">Create a type for this account, such as Employee Provident Fund.</p>
                <div className="mt-3 flex gap-2">
                  <input id="new-savings-type" value={newTypeName} onChange={(event) => setNewTypeName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addInstrumentType(); }} placeholder="e.g. Employee Provident Fund" className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                  <button type="button" onClick={() => void addInstrumentType()} disabled={!newTypeName.trim() || isSavingType} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-[10px] bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Plus aria-hidden="true" className="size-4" />{isSavingType ? "Adding…" : "Add"}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {discardDialog}
      {dateTransition.mounted ? (
        <div role="dialog" aria-modal="true" aria-labelledby="savings-maturity-title" className={`fixed inset-0 z-[70] flex items-end bg-foreground/25 ${dateTransition.closing ? "drawer-scrim-exit" : "drawer-scrim-enter"}`}>
          <div className={`${dateTransition.closing ? "drawer-exit" : "drawer-enter"} flex max-h-[88dvh] w-full flex-col rounded-t-[24px] border-t border-border bg-background shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)]`}>
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-foreground/20" aria-hidden="true" />
            <header className="flex shrink-0 items-center justify-between border-b border-border px-4 pb-3 pt-3">
              <button type="button" aria-label="Close maturity date picker" onClick={() => setDateOpen(false)} className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card"><X aria-hidden="true" className="size-5" /></button>
              <h2 id="savings-maturity-title" className="text-base font-semibold">Choose maturity date</h2>
              <button type="button" onClick={() => setDateOpen(false)} className="rounded-[10px] bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">Done</button>
            </header>
            <div className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <div className="w-full max-w-[420px] space-y-3">
                <Calendar mode="single" selected={maturityDate ? new Date(`${maturityDate}T12:00:00`) : undefined} onSelect={(selected) => { if (selected) setMaturityDate(format(selected, "yyyy-MM-dd")); }} className="w-full rounded-[18px] border border-border bg-card p-4 shadow-[0_18px_50px_rgb(23_32_29_/_0.10)] [--cell-size:2.5rem] min-[420px]:[--cell-size:2.75rem]" />
                <div className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground">Optional. Leave it empty if this instrument has no maturity date.</p>
                  {maturityDate ? <button type="button" onClick={() => setMaturityDate("")} className="shrink-0 text-xs font-semibold text-primary">Clear</button> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
