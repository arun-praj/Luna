"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleDollarSign,
  ChevronDown,
  ImagePlus,
  Landmark,
  LoaderCircle,
  Palette,
  Search,
  Smartphone,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";

import { accountImages } from "@/lib/account-images";
import { getAccountBackgroundColor } from "@/lib/account-appearance";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { formatMoney, MoneyEditor } from "@/components/money/money-editor";
import { AuthenticatedImage } from "@/components/ui/authenticated-image";
import { authenticatedFetch } from "@/lib/auth-client";
import { navigateWithRouteExit } from "@/lib/route-motion";
import { getReturnTo } from "@/lib/navigation";

const accountTypes = [
  { value: "checking", label: "Bank", icon: Landmark },
  { value: "general", label: "Wallet", icon: Smartphone },
  { value: "credit_card", label: "Card", icon: WalletCards },
  { value: "cash", label: "Cash", icon: CircleDollarSign },
  { value: "savings", label: "Savings", icon: Landmark },
  { value: "investment", label: "Invest", icon: Palette },
  { value: "loan", label: "Loan", icon: WalletCards },
  { value: "other", label: "Other", icon: Smartphone },
] as const;

const colorOptions = [
  {
    name: "Sage",
    cardClassName: "border-[#c7dbd2] bg-[#e3eee9]",
    accentClassName: "text-primary",
  },
  {
    name: "Sky",
    cardClassName: "border-[#cadde9] bg-[#e3eff6]",
    accentClassName: "text-info",
  },
  {
    name: "Lavender",
    cardClassName: "border-[#d8cee7] bg-[#ece6f3]",
    accentClassName: "text-[#735b8f]",
  },
  {
    name: "Sand",
    cardClassName: "border-[#e3d2b6] bg-[#f3e8d4]",
    accentClassName: "text-warning",
  },
  {
    name: "Mint",
    cardClassName: "border-[#c7dbd2] bg-[#e5f3eb]",
    accentClassName: "text-income",
  },
  {
    name: "Blush",
    cardClassName: "border-[#e6c9c4] bg-[#f8e9e6]",
    accentClassName: "text-expense",
  },
  {
    name: "Peach",
    cardClassName: "border-[#efd0bf] bg-[#fbe8dc]",
    accentClassName: "text-[#b55d35]",
  },
  {
    name: "Lemon",
    cardClassName: "border-[#e9dda1] bg-[#f7f0c9]",
    accentClassName: "text-[#9b7b16]",
  },
  {
    name: "Seafoam",
    cardClassName: "border-[#c2dfd9] bg-[#dff1ed]",
    accentClassName: "text-[#277b72]",
  },
  {
    name: "Periwinkle",
    cardClassName: "border-[#cbd3ef] bg-[#e5e9f8]",
    accentClassName: "text-[#5368a5]",
  },
  {
    name: "Mauve",
    cardClassName: "border-[#dfc9da] bg-[#f0e3ec]",
    accentClassName: "text-[#905c80]",
  },
  {
    name: "Stone",
    cardClassName: "border-[#d8d5cb] bg-[#ebe9e3]",
    accentClassName: "text-[#706e65]",
  },
];

const imageOptions = [
  { name: "Bank", src: accountImages.primary },
  { name: "Digital", src: accountImages.esewa },
  { name: "Growth", src: accountImages.savings },
  { name: "Everyday", src: accountImages.cash },
];

const currencyCodes = typeof Intl.supportedValuesOf === "function"
  ? Intl.supportedValuesOf("currency")
  : ["NPR", "USD", "EUR", "INR"];

function currencySymbol(code: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0).find((part) => part.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}

function currencyName(code: string) {
  try {
    return new Intl.DisplayNames(undefined, { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function presetColorHex(className: string) {
  const match = className.match(/bg-\[#([0-9a-f]+)\]/i);
  return match ? `#${match[1]}` : null;
}

export type AccountEditorData = {
  id: string;
  name: string;
  type: "checking" | "cash" | "credit_card" | "general" | "savings" | "investment" | "loan" | "other";
  currency?: string;
  currentBalance?: number;
  balance?: string;
  includeInTotalBalance?: boolean;
  includeInTotal?: boolean;
  allowNegativeBalance?: boolean;
  backgroundColor?: string | null;
  icon?: string | null;
  colorIndex?: number;
  imageIndex?: number;
};

export function AccountEditor({
  account,
  accountId,
}: {
  account?: AccountEditorData;
  accountId?: string;
}) {
  const router = useRouter();
  const isNew = !account && !accountId;
  const [backHref, setBackHref] = useState("/accounts");
  const [loadedAccount, setLoadedAccount] = useState(account);
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountEditorData["type"] | "">(account?.type ?? "");
  const [currency, setCurrency] = useState(account?.currency ?? "NPR");
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const [balance, setBalance] = useState(account?.balance ?? String(account?.currentBalance ?? 0));
  const [includeInTotal, setIncludeInTotal] = useState(
    account?.includeInTotalBalance ?? account?.includeInTotal ?? true,
  );
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(
    account?.allowNegativeBalance ?? false,
  );
  const [balanceEditorOpen, setBalanceEditorOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<number | "custom">(
    account?.colorIndex ?? 0,
  );
  const [customColor, setCustomColor] = useState("#e3eee9");
  const [selectedImage, setSelectedImage] = useState<number | "custom">(
    account?.imageIndex ?? 0,
  );
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [customImageFile, setCustomImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState("");
  const [imageStatus, setImageStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [isLoading, setIsLoading] = useState(Boolean(accountId && !account));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const autoSaveReady = useRef(false);
  const autoSaveTimer = useRef<number | null>(null);
  const autoSaveInFlight = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setBackHref(getReturnTo("/accounts"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!accountId || account) return;
    void authenticatedFetch(`/api/accounts/${accountId}`).then(async (response) => {
      if (!response.ok) throw new Error("Account not found.");
      const result = await response.json() as { account: AccountEditorData };
      const loaded = result.account;
      setLoadedAccount(loaded); setName(loaded.name); setType(loaded.type); setCurrency(loaded.currency ?? "NPR"); setBalance(String(loaded.currentBalance ?? 0)); setIncludeInTotal(loaded.includeInTotalBalance ?? true); setAllowNegativeBalance(loaded.allowNegativeBalance ?? false);
      const imageIndex = loaded.icon ? imageOptions.findIndex((option) => option.name === loaded.icon) : -1; setSelectedImage(imageIndex >= 0 ? imageIndex : loaded.icon?.startsWith("/api/uploads/account-images/") ? "custom" : 0); if (loaded.icon?.startsWith("/api/uploads/account-images/")) { setCustomImage(loaded.icon); setImageStatus("success"); }
      const normalizedColor = getAccountBackgroundColor(loaded.backgroundColor, loaded.type); const colorIndex = normalizedColor ? colorOptions.findIndex((option) => option.cardClassName.includes(normalizedColor)) : -1; if (colorIndex >= 0) setSelectedColor(colorIndex); else if (loaded.backgroundColor) { setCustomColor(loaded.backgroundColor); setSelectedColor("custom"); }
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load account.")).finally(() => setIsLoading(false));
  }, [account, accountId]);

  async function deleteAccount() {
    const id = loadedAccount?.id ?? accountId;
    if (!id || !window.confirm("Delete this account? Transactions must be reassigned first.")) return;
    setIsDeleting(true); setError("");
    const response = await authenticatedFetch(`/api/accounts/${id}`, { method: "DELETE" }).catch(() => null);
    if (response?.ok) navigateWithRouteExit(() => router.push(backHref)); else { const result = await response?.json().catch(() => null) as { error?: string } | null; setError(result?.error ?? "Could not delete account."); }
    setIsDeleting(false);
  }

  const uploadImage = async (file: File | undefined) => {
    if (!file) return;
    if (!(new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])).has(file.type)) {
      setImageError("Use a JPG, PNG, WebP, or GIF image."); setImageStatus("error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("The image must be smaller than 5 MB."); setImageStatus("error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCustomImage(String(reader.result));
      setCustomImageFile(file);
      setSelectedImage("custom");
      setImageError("");
      setImageStatus("uploading");
    };
    reader.readAsDataURL(file);
    const formData = new FormData(); formData.set("file", file);
    const response = await authenticatedFetch("/api/uploads/account-images", { method: "POST", body: formData }).catch(() => null);
    if (!response?.ok) { const result = await response?.json().catch(() => null) as { error?: string } | null; setImageError(result?.error ?? "Upload failed. Try again."); setImageStatus("error"); return; }
    const result = await response.json() as { url: string };
    setCustomImage(result.url); setCustomImageFile(null); setImageStatus("success"); setImageError("");
  };

  const negativeBalanceError = Number(balance) < 0 && !allowNegativeBalance
    ? "Negative values are not allowed unless you enable Allow negative balance."
    : "";

  const canSave =
    name.trim().length >= 1 && name.trim().length <= 100 &&
    Boolean(type) &&
    /^[A-Za-z]{3}$/.test(currency.trim()) &&
    balance.trim() !== "" &&
    Number.isFinite(Number(balance)) &&
    !negativeBalanceError;

  const persistAccount = useCallback(async (redirect: boolean) => {
    if (!canSave) return false;
    if (imageStatus === "uploading") {
      if (redirect) setError("Wait for the image upload to finish.");
      return false;
    }
    if (redirect) {
      setIsSaving(true);
      setError("");
    }

    let imageValue = selectedImage === "custom" ? customImage ?? "Everyday" : imageOptions[selectedImage].name;
    if (customImageFile) {
      const formData = new FormData(); formData.set("file", customImageFile);
      const uploadResponse = await authenticatedFetch("/api/uploads/account-images", { method: "POST", body: formData }).catch(() => null);
      if (!uploadResponse?.ok) {
        const result = await uploadResponse?.json().catch(() => null) as { error?: string } | null;
        setError(result?.error ?? "Could not upload account image.");
        if (redirect) setIsSaving(false);
        return false;
      }
      const uploadResult = await uploadResponse.json() as { url: string };
      imageValue = uploadResult.url;
    }

    const backgroundColor = selectedColor === "custom" ? customColor : presetColorHex(colorOptions[selectedColor].cardClassName);
    const payload = { name: name.trim(), type, currency: currency.trim().toUpperCase(), openingBalance: Number(balance), includeInTotalBalance: includeInTotal, allowNegativeBalance, backgroundColor, icon: imageValue };
    const id = loadedAccount?.id ?? accountId;
    const response = await authenticatedFetch(isNew ? "/api/accounts" : `/api/accounts/${id}`, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    if (response?.ok) {
      if (redirect) navigateWithRouteExit(() => router.push(backHref));
      return true;
    }

    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setError(result?.error ?? "Could not save account.");
    if (redirect) setIsSaving(false);
    return false;
  }, [accountId, allowNegativeBalance, backHref, balance, canSave, customColor, customImage, customImageFile, currency, imageStatus, includeInTotal, isNew, loadedAccount?.id, name, router, selectedColor, selectedImage, type]);

  useEffect(() => {
    if (isNew || isLoading || !canSave || imageStatus === "uploading") return;
    if (!autoSaveReady.current) {
      autoSaveReady.current = true;
      return;
    }
    if (autoSaveTimer.current !== null) window.clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(() => {
      autoSaveTimer.current = null;
      if (autoSaveInFlight.current) return;
      autoSaveInFlight.current = true;
      void persistAccount(false).finally(() => {
        autoSaveInFlight.current = false;
      });
    }, 500);
    return () => {
      if (autoSaveTimer.current !== null) {
        window.clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
    };
  }, [allowNegativeBalance, balance, canSave, currency, customColor, customImage, imageStatus, includeInTotal, isLoading, isNew, name, persistAccount, selectedColor, selectedImage, type]);

  async function saveAccount() {
    if (autoSaveTimer.current !== null) {
      window.clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    await persistAccount(true);
  }

  const displayBalance = formatMoney(balance);
  const selectedCurrency = currency.toUpperCase();
  const filteredCurrencies = currencyCodes.filter((code) =>
    `${code} ${currencyName(code)} ${currencySymbol(code)}`
      .toLowerCase()
      .includes(currencySearch.toLowerCase()),
  );

  return (
    <main className="page-route-enter min-h-dvh overflow-x-clip bg-background">
      <div className="mx-auto w-full max-w-[560px] px-4 pb-12 sm:px-5">
        <StickyPageHeader className="-mx-4 grid grid-cols-[44px_1fr_44px] items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <Link
            href={backHref}
            aria-label={isNew ? "Cancel new account" : "Cancel editing account"}
            className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <X aria-hidden="true" className="size-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Accounts</p>
            <h1 className="truncate text-[26px] font-semibold tracking-[-0.04em]">
              {isNew ? "New account" : "Edit account"}
            </h1>
          </div>
          <button
            type="button"
            aria-label={isNew ? "Add account" : "Save account changes"}
            onClick={() => void saveAccount()}
            disabled={!canSave || isSaving || isLoading || imageStatus === "uploading"}
            className="flex size-11 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:border-border disabled:bg-surface-subtle disabled:text-foreground-subtle"
          >
            {isSaving ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <Check aria-hidden="true" className="size-5" />}
          </button>
        </StickyPageHeader>

        {error ? <p role="alert" className="mt-4 rounded-[10px] border border-expense/25 bg-expense-soft px-3 py-2 text-sm text-expense">{error}</p> : null}
        {isLoading ? <div className="mt-8 flex min-h-60 items-center justify-center text-sm text-muted-foreground">Loading account…</div> : null}

        {!isLoading ? <section aria-labelledby="account-balance-heading" className="mt-6 px-1 py-4 text-center sm:py-6">
          <p id="account-balance-heading" className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/75">Current balance</p>
          <button type="button" onClick={() => setBalanceEditorOpen(true)} className="mt-3 block w-full rounded-[12px] outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
            <span className="block text-[48px] font-semibold leading-none tracking-[-0.06em] tabular-nums text-foreground sm:text-[58px]">{displayBalance}</span>
            <span className="mt-2 block text-sm font-semibold uppercase tracking-[0.12em] text-primary">{currency.toUpperCase()}</span>
          </button>
          <p className="mt-4 text-xs text-muted-foreground">Tap the balance to edit</p>
          {negativeBalanceError ? <p role="alert" className="mx-auto mt-3 max-w-[360px] text-xs font-medium text-expense">{negativeBalanceError}</p> : null}
        </section> : null}

        <section className="mt-5 space-y-6 rounded-[16px] border border-border bg-card p-4 min-[390px]:p-5">
          <div>
            <label htmlFor="account-name" className="text-sm font-semibold">
              Account name
            </label>
            <input
              id="account-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Salary account"
              maxLength={36}
              aria-invalid={name.trim().length === 0}
              className="mt-2 h-12 w-full rounded-[10px] border border-input bg-background px-4 text-[15px] outline-none transition-colors placeholder:text-foreground-subtle focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

          <div>
            <label htmlFor="account-currency" className="text-sm font-semibold">Currency</label>
            <div className="relative mt-2">
              <button
                id="account-currency"
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isCurrencyOpen}
                onClick={() => setIsCurrencyOpen((open) => !open)}
                className="flex h-12 w-full items-center gap-3 rounded-[10px] border border-input bg-background px-3 text-left outline-none transition-colors hover:border-border-strong focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                  {currencySymbol(selectedCurrency)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{currencyName(selectedCurrency)}</span>
                  <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{selectedCurrency}</span>
                </span>
                <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-muted-foreground transition-transform ${isCurrencyOpen ? "rotate-180" : ""}`} />
              </button>

              {isCurrencyOpen ? (
                <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-[12px] border border-border bg-background p-2 shadow-[0_12px_30px_rgb(23_32_29_/_0.14)]">
                  <div className="flex items-center gap-2 rounded-[9px] border border-border bg-card px-3">
                    <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <input
                      aria-label="Search currencies"
                      autoFocus
                      value={currencySearch}
                      onChange={(event) => setCurrencySearch(event.target.value)}
                      placeholder="Search currency or code"
                      className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground-subtle"
                    />
                  </div>
                  <div role="listbox" aria-label="World currencies" className="mt-2 max-h-64 overflow-y-auto">
                    {filteredCurrencies.length === 0 ? (
                      <p className="px-3 py-5 text-center text-xs text-muted-foreground">No currencies found.</p>
                    ) : filteredCurrencies.map((code) => (
                      <button
                        key={code}
                        type="button"
                        role="option"
                        aria-selected={selectedCurrency === code}
                        onClick={() => { setCurrency(code); setIsCurrencyOpen(false); setCurrencySearch(""); }}
                        className={`flex min-h-11 w-full items-center gap-3 rounded-[9px] px-2 text-left transition-colors hover:bg-surface-subtle focus-visible:bg-primary-soft focus-visible:outline-none ${selectedCurrency === code ? "bg-primary-soft" : ""}`}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-xs font-semibold text-primary">{currencySymbol(code)}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{currencyName(code)}</span><span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{code}</span></span>
                        {selectedCurrency === code ? <Check aria-hidden="true" className="size-4 shrink-0 text-primary" /> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Choose the currency used by this account.</p>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">Account type</legend>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {accountTypes.map((option) => {
                const Icon = option.icon;
                const selected = type === option.value;

                return (
                  <button
                    type="button"
                    key={option.value}
                    aria-pressed={selected}
                    onClick={() => setType(option.value)}
                    className={`flex h-[62px] flex-col items-center justify-center gap-1.5 rounded-[10px] border text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                      selected
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-surface-subtle"
                    }`}
                  >
                    <Icon aria-hidden="true" className="size-[19px]" strokeWidth={1.8} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Include in total balance</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Turn off for accounts you want to track separately.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={includeInTotal}
              onClick={() => setIncludeInTotal((current) => !current)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                includeInTotal ? "bg-primary" : "bg-border-strong"
              }`}
            >
              <span
                className={`absolute left-0 top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${
                  includeInTotal ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-start justify-between gap-4 border-t border-border pt-5">
            <div>
              <p className="text-sm font-semibold">Allow negative balance</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Negative values are not allowed unless you enable this.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-label="Allow negative balance"
              aria-checked={allowNegativeBalance}
              onClick={() => { setAllowNegativeBalance((current) => !current); setError(""); }}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                allowNegativeBalance ? "bg-primary" : "bg-border-strong"
              }`}
            >
              <span
                className={`absolute left-0 top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${
                  allowNegativeBalance ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </section>

        <section className="mt-5 rounded-[16px] border border-border bg-card p-4 min-[390px]:p-5">
          <fieldset>
            <legend className="text-sm font-semibold">Account image</legend>
            <div className="mt-3 flex flex-wrap gap-3">
              {imageOptions.map((option, index) => (
                <button
                  type="button"
                  key={option.name}
                  aria-label={option.name}
                  aria-pressed={selectedImage === index}
                  onClick={() => setSelectedImage(index)}
                  className={`rounded-[12px] border p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                    selectedImage === index
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-background"
                  }`}
                >
                  <Image
                    src={option.src}
                    alt=""
                    width={44}
                    height={44}
                    unoptimized
                    className="size-11 rounded-[9px]"
                  />
                </button>
              ))}
              {customImage ? <button type="button" aria-label="Custom uploaded image" aria-pressed={selectedImage === "custom"} onClick={() => setSelectedImage("custom")} className={`rounded-[12px] border p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${selectedImage === "custom" ? "border-primary bg-primary-soft" : "border-border bg-background"}`}><AuthenticatedImage src={customImage} alt="" width={44} height={44} className="size-11 rounded-[9px] object-cover" /></button> : null}
              <label
                className={`flex h-[54px] min-w-[104px] cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-dashed px-3 text-xs font-semibold transition-colors focus-within:ring-2 focus-within:ring-primary/35 ${
                  selectedImage === "custom"
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border-strong bg-background text-muted-foreground hover:bg-surface-subtle"
                }`}
              >
                <span className="sr-only">Upload custom account image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => uploadImage(event.target.files?.[0])}
                />
                {imageStatus === "uploading" ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <ImagePlus aria-hidden="true" className="size-5" />}
                {imageStatus === "uploading" ? "Uploading…" : "Upload"}
              </label>
            </div>
            <p
              aria-live="polite"
              className={`mt-2 text-xs ${imageError ? "text-expense" : imageStatus === "success" ? "text-income" : "text-muted-foreground"}`}
            >
              {imageError || (imageStatus === "success" ? "Image uploaded successfully." : "Upload a custom image up to 5 MB.")}
            </p>
          </fieldset>

          <fieldset className="mt-6 min-w-0">
            <legend className="text-sm font-semibold">Account color</legend>
            <div className="mt-3 min-w-0 max-w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max min-w-max flex-nowrap gap-3 pb-1">
                {colorOptions.map((option, index) => (
                  <button
                    type="button"
                    key={option.name}
                    aria-label={option.name}
                    aria-pressed={selectedColor === index}
                    onClick={() => setSelectedColor(index)}
                    className={`flex size-11 shrink-0 snap-start items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 ${option.cardClassName} ${option.accentClassName}`}
                  >
                    {selectedColor === index ? (
                      <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
                    ) : null}
                  </button>
                ))}
                <label
                  className={`relative flex size-11 shrink-0 snap-start cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed bg-background text-muted-foreground transition-colors hover:bg-surface-subtle focus-within:ring-2 focus-within:ring-primary/35 focus-within:ring-offset-2 ${
                    selectedColor === "custom"
                      ? "border-primary"
                      : "border-border-strong"
                  }`}
                >
                  {selectedColor === "custom" ? (
                    <span
                      className="absolute inset-1 rounded-full"
                      style={{ backgroundColor: customColor }}
                    />
                  ) : null}
                  <Palette
                    aria-hidden="true"
                    className="relative z-10 size-4 rounded-full bg-card/75 p-0.5"
                  />
                  <span className="sr-only">Choose a custom account color</span>
                  <input
                    type="color"
                    value={customColor}
                    onChange={(event) => {
                      setCustomColor(event.target.value);
                      setSelectedColor("custom");
                    }}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Swipe to see more colors
            </p>
          </fieldset>
        </section>

        {!isNew ? (
          <section className="mt-8 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => void deleteAccount()}
              disabled={isDeleting || isLoading}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[11px] border border-expense/25 bg-expense-soft px-4 text-sm font-semibold text-expense transition-colors hover:border-expense/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-expense/30 disabled:opacity-60"
            >
              <Trash2 aria-hidden="true" className="size-[18px]" />
              {isDeleting ? "Deleting…" : "Delete account"}
            </button>
            <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">
              Transactions in this account will be assigned to another account.
            </p>
          </section>
        ) : null}
      </div>

      <MoneyEditor
        open={balanceEditorOpen}
        value={balance}
        title="Edit starting balance"
        onCancel={() => setBalanceEditorOpen(false)}
        onSet={(nextBalance) => {
          setBalance(nextBalance);
          setBalanceEditorOpen(false);
        }}
      />
    </main>
  );
}
