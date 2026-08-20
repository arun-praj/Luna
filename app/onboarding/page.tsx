"use client";

import { createElement, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowRight, BadgeDollarSign, Check, ChevronDown, ChevronLeft, Landmark, Plus, ReceiptText,
  ShieldCheck, Sparkles, Sprout, TrendingUp, WalletCards, X,
} from "lucide-react";
import { authenticatedFetch, loginPathFor } from "@/lib/auth-client";
import { getCategoryIcon } from "@/lib/category-appearance";
import { AVATAR_PRESETS, avatarForPreset, randomAvatarPreset } from "@/lib/avatar";
import { useAnimatedVisibility } from "@/lib/use-animated-visibility";

type AccountChoice = { name: string; type: "cash" | "savings" | "credit_card" | "checking" | "investment" | "loan" | "general"; color: string };
type CategoryChoice = { name: string; type: "expense" | "income"; icon: string; color: string };

const CURRENCY_CODES = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("currency") : ["NPR", "USD", "EUR", "INR"];

function currencySymbol(code: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((part) => part.type === "currency")?.value ?? code;
  } catch { return code; }
}

function currencyName(code: string) {
  try { return new Intl.DisplayNames(undefined, { type: "currency" }).of(code) ?? code; }
  catch { return code; }
}

const ACCOUNT_SUGGESTIONS: AccountChoice[] = [
  { name: "Cash", type: "cash", color: "#f3e8d4" },
  { name: "Savings", type: "savings", color: "#e5f3eb" },
  { name: "Credit Card", type: "credit_card", color: "#ece6f3" },
  { name: "Bank account", type: "checking", color: "#e3eff6" },
  { name: "Investments", type: "investment", color: "#ece6f3" },
];

const CATEGORY_SUGGESTIONS: CategoryChoice[] = [
  ["Plants", "Plants", "#e3eee9"], ["Housing", "Home", "#f8e9e6"], ["Education", "Education", "#ece6f3"],
  ["Transport & Vehicles", "Travel", "#e3eff6"], ["Salary", "Cash", "#e5f3eb", "income"], ["Freelancing", "Work", "#ece6f3", "income"],
  ["Online Shopping", "Online Shopping", "#fbe8dc"], ["Shopping", "Shopping Cart", "#f3e8d4"], ["Food & Drinks", "Food", "#f3e8d4"],
  ["Groceries", "Groceries", "#e5f3eb"], ["Gifts", "Gifts", "#f8e9e6"], ["Health & Fitness", "Fitness", "#f8e9e6"],
  ["Investments", "Wallet", "#e3eee9"], ["FD", "Wallet", "#e3eff6"], ["SSF", "Wallet", "#f3e8d4"],
  ["Loans", "Wallet", "#fbe8dc"], ["Work", "Work", "#ece6f3"], ["Car", "Travel", "#e3eff6"],
  ["Family", "Home", "#f8e9e6"], ["Travel", "Flights", "#e3eff6"], ["Fitness & Sports", "Fitness", "#e5f3eb"],
  ["Pet", "Pets", "#f3e8d4"], ["Entertainment & Movies", "Movies", "#ece6f3"],
  ["Electronics", "Electronics", "#e3eff6"], ["Gadgets", "Gadgets", "#ece6f3"],
  ["Electricity", "Electricity", "#f7f0c9"], ["Maintenance", "Maintenance", "#f3e8d4"],
  ["Kitchen", "Kitchen", "#f8e9e6"], ["Television", "Television", "#e3eff6"],
  ["Camping", "Camping", "#e3eee9"], ["Hiking", "Hiking", "#e3eff6"],
  ["Trekking", "Trekking", "#e5f3eb"], ["Battery", "Battery", "#f7f0c9"],
  ["Cutlery", "Cutlery", "#f3e8d4"], ["Lighting", "Lighting", "#f7f0c9"],
  ["Headphones", "Headphones", "#ece6f3"], ["School", "School", "#e3eff6"],
  ["Degree", "Degree", "#ece6f3"], ["Temperature", "Temperature", "#f8e9e6"],
  ["Building", "Building", "#e3eee9"], ["Office", "Office", "#e3eff6"],
].map(([name, icon, color, type]) => ({ name, icon, color, type: type === "income" ? "income" : "expense" })) as CategoryChoice[];

function Icon({ name }: { name: string }) {
  const Component = getCategoryIcon(name);
  return createElement(Component, { "aria-hidden": true, className: "size-5" });
}

function MagneticContinueButton({ children, disabled = false, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [transform, setTransform] = useState("translate3d(0px, 0px, 0) scale(1)");
  const [isPointerInside, setIsPointerInside] = useState(false);

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled || event.pointerType === "touch") return;
    const bounds = buttonRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const offsetX = (event.clientX - (bounds.left + bounds.width / 2)) * 0.12;
    const offsetY = (event.clientY - (bounds.top + bounds.height / 2)) * 0.12;
    setIsPointerInside(true);
    setTransform(`translate3d(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px, 0) scale(1.025)`);
  }

  function resetMagnet() {
    setIsPointerInside(false);
    setTransform("translate3d(0px, 0px, 0) scale(1)");
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      onClick={onClick}
      onPointerEnter={() => setIsPointerInside(true)}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetMagnet}
      style={{
        transform,
        transition: isPointerInside ? "transform 140ms cubic-bezier(0.22, 1, 0.36, 1)" : "transform 360ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      className="group relative isolate flex min-h-12 items-center justify-center gap-2 overflow-hidden rounded-[14px] bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_rgb(53_107_104_/_0.15)] transition-[background-color,box-shadow] duration-300 hover:bg-primary-hover hover:shadow-[0_12px_26px_rgb(53_107_104_/_0.23)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/15 transition-transform duration-700 group-hover:translate-x-[420%]" />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}

function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="onboarding-page-enter h-[100dvh] min-h-0 overflow-hidden bg-background">
      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[1120px] flex-col px-5 py-3 sm:px-10 sm:py-5">
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-24 size-64 rounded-full bg-[#D7A34E]/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-20 size-80 rounded-full bg-primary/10 blur-3xl" />

        <header className="relative z-10 flex shrink-0 items-center justify-between">
          <span className="text-sm font-bold tracking-[-0.03em] text-primary">Luna</span>
        </header>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-start gap-6 overflow-x-hidden overflow-y-auto overscroll-contain pt-4 pb-6 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:justify-center lg:gap-12 lg:overflow-visible lg:py-4">
          <section className="max-w-[510px]">
            <h1 className="max-w-[500px] text-[40px] font-semibold leading-[0.96] tracking-[-0.065em] sm:text-[62px]">Give every rupee a job.</h1>
            <p className="mt-4 max-w-[455px] text-[15px] leading-6 text-muted-foreground sm:mt-6 sm:text-lg sm:leading-7">Track spending, plan ahead, and understand your money — online or offline.</p>
            <div className="mt-5 flex flex-wrap gap-2 sm:mt-8 sm:gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2.5 text-sm font-semibold shadow-sm"><TrendingUp aria-hidden="true" className="size-4 text-income" /> See your flow</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2.5 text-sm font-semibold shadow-sm"><Sprout aria-hidden="true" className="size-4 text-primary" /> Build good habits</span>
            </div>
          </section>

          <div className="relative mx-auto h-[220px] w-full max-w-[500px] sm:h-[330px]" aria-label="Illustration of a calm personal budget" role="img">
            <div aria-hidden="true" className="onboarding-float-slow absolute left-[12%] top-[12%] size-20 rotate-[-12deg] rounded-[27px] border border-white/70 bg-[#D98E64] shadow-[0_20px_35px_rgb(217_142_100_/_0.28)] sm:size-24" />
            <div aria-hidden="true" className="onboarding-float absolute right-[8%] top-[2%] grid size-14 rotate-[12deg] place-items-center rounded-2xl border border-white/80 bg-[#7D8DC4] text-white shadow-[0_17px_30px_rgb(125_141_196_/_0.3)] sm:size-16"><BadgeDollarSign className="size-7" /></div>
            <div aria-hidden="true" className="absolute left-[17%] top-[29%] size-36 rounded-full bg-primary-soft/80 blur-2xl sm:size-52" />

            <div className="absolute left-[12%] top-[23%] w-[76%] rotate-[-7deg] rounded-[30px] border border-border bg-card/80 p-4 shadow-[0_26px_60px_rgb(23_32_29_/_0.12)] backdrop-blur-sm sm:left-[15%] sm:top-[20%] sm:w-[70%] sm:p-5">
              <div className="flex items-start justify-between">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">This month</p><p className="mt-1 text-2xl font-semibold tracking-[-0.05em] sm:text-3xl">NPR 48,500</p></div>
                <span className="grid size-10 place-items-center rounded-2xl bg-income-soft text-income"><TrendingUp aria-hidden="true" className="size-5" /></span>
              </div>
              <div className="mt-5 flex h-20 items-end gap-2 sm:h-24">{[34, 48, 42, 66, 56, 78, 70, 92].map((height, index) => <span key={index} className={`flex-1 rounded-t-full ${index > 5 ? "bg-primary" : "bg-primary-soft"}`} style={{ height: `${height}%` }} />)}</div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs font-semibold"><span className="text-muted-foreground">Cash flow</span><span className="text-income">+12.8% <ArrowRight aria-hidden="true" className="ml-1 inline size-3" /></span></div>
            </div>

            <div className="onboarding-float-slow absolute bottom-[8%] left-[2%] flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 text-xs font-bold shadow-[0_16px_30px_rgb(23_32_29_/_0.1)] sm:left-[4%]"><span className="grid size-8 place-items-center rounded-xl bg-income-soft text-income"><ReceiptText aria-hidden="true" className="size-4" /></span>Income tracked</div>
            <div className="onboarding-float absolute bottom-[2%] right-[2%] flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 text-xs font-bold shadow-[0_16px_30px_rgb(23_32_29_/_0.1)] sm:right-[5%]"><span className="grid size-8 place-items-center rounded-xl bg-primary-soft text-primary"><ShieldCheck aria-hidden="true" className="size-4" /></span>Offline ready</div>
            <div aria-hidden="true" className="onboarding-float absolute bottom-[22%] right-[11%] grid size-9 place-items-center rounded-full bg-[#D7A34E] text-white shadow-lg sm:right-[15%]"><Sparkles className="size-4" /></div>
          </div>
        </div>

        <footer className="relative z-10 flex shrink-0 flex-col gap-2 border-t border-border bg-background/95 pt-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-5">
          <p className="text-xs leading-5 text-muted-foreground">A simple start for a more intentional money life.</p>
          <MagneticContinueButton onClick={onContinue}>Continue Onboarding<ArrowRight aria-hidden="true" className="size-4" /></MagneticContinueButton>
        </footer>
      </div>
    </main>
  );
}

function CategoryPicker({ categories, categorySelected, onToggle, onToggleAll, customCategory, onCustomCategoryChange, onAddCustomCategory }: { categories: CategoryChoice[]; categorySelected: (name: string) => boolean; onToggle: (category: CategoryChoice) => void; onToggleAll: () => void; customCategory: string; onCustomCategoryChange: (value: string) => void; onAddCustomCategory: () => void }) {
  const allSelected = CATEGORY_SUGGESTIONS.every((category) => categorySelected(category.name));

  return (
    <>
      <div className="mt-8 flex items-center justify-end gap-3"><span className="text-xs font-medium text-muted-foreground">{categories.length} selected</span><button type="button" onClick={onToggleAll} className="rounded-md px-2 py-1 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">{allSelected ? "Clear all" : "Select all"}</button></div>
      <div className="mt-3 flex max-h-[370px] flex-wrap gap-2.5 overflow-y-auto pr-1">{CATEGORY_SUGGESTIONS.map((category) => { const isSelected = categorySelected(category.name); return <button key={category.name} type="button" aria-pressed={isSelected} onClick={() => onToggle(category)} className={isSelected ? "flex items-center gap-2 rounded-full border border-primary bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all" : "flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2.5 text-sm font-semibold transition-all hover:border-primary/50"}><span className={isSelected ? "grid size-7 place-items-center rounded-full bg-white/20" : "grid size-7 place-items-center rounded-full bg-surface-subtle text-primary"}><Icon name={category.icon} /></span>{category.name}{isSelected && <Check aria-hidden="true" className="size-4 text-white" strokeWidth={2.5} />}</button>; })}</div>
      <div className="mt-6 flex gap-2"><input value={customCategory} onChange={(event) => onCustomCategoryChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onAddCustomCategory(); }} placeholder="Add your own category" className="min-h-12 min-w-0 flex-1 rounded-[13px] border border-border bg-card px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /><button type="button" onClick={onAddCustomCategory} className="flex size-12 shrink-0 items-center justify-center rounded-[13px] bg-surface-subtle text-primary hover:bg-primary-soft" aria-label="Add category"><Plus className="size-5" /></button></div>{categories.length > 0 && <p className="mt-4 text-sm text-muted-foreground">{categories.length} categor{categories.length === 1 ? "y" : "ies"} selected</p>}
    </>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("NPR");
  const [isCurrencyPickerOpen, setIsCurrencyPickerOpen] = useState(false);
  const currencyPickerTransition = useAnimatedVisibility(isCurrencyPickerOpen);
  const [currencySearch, setCurrencySearch] = useState("");
  const [avatarPreset, setAvatarPreset] = useState("sunrise");
  const [accounts, setAccounts] = useState<AccountChoice[]>([]);
  const [categories, setCategories] = useState<CategoryChoice[]>(() => [...CATEGORY_SUGGESTIONS]);
  const [customAccount, setCustomAccount] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void authenticatedFetch("/api/auth/me").then(async (response) => {
      if (!response.ok) { router.replace(loginPathFor("/onboarding")); return; }
      const result = (await response.json()) as { user: { name: string; currency?: string; avatarPreset?: string; onboardingCompleted: boolean } };
      if (result.user.onboardingCompleted) router.replace("/");
      setName(result.user.name);
      setCurrency(result.user.currency ?? "NPR");
      setAvatarPreset(result.user.avatarPreset ?? "sunrise");
    });
  }, [router]);

  const progressStep = step;
  const accountSelected = (nameToFind: string) => accounts.some((account) => account.name === nameToFind);
  const categorySelected = (nameToFind: string) => categories.some((category) => category.name === nameToFind);

  function toggleAccount(account: AccountChoice) {
    setAccounts((current) => current.some((item) => item.name === account.name) ? current.filter((item) => item.name !== account.name) : [...current, account]);
  }

  function toggleCategory(category: CategoryChoice) {
    setCategories((current) => current.some((item) => item.name === category.name) ? current.filter((item) => item.name !== category.name) : [...current, category]);
  }

  function toggleAllCategories() {
    setCategories((current) => {
      const suggestedNames = new Set(CATEGORY_SUGGESTIONS.map((category) => category.name));
      const customCategories = current.filter((category) => !suggestedNames.has(category.name));
      const allSelected = CATEGORY_SUGGESTIONS.every((category) => current.some((item) => item.name === category.name));
      return allSelected ? customCategories : [...customCategories, ...CATEGORY_SUGGESTIONS];
    });
  }

  function addCustomAccount() {
    const value = customAccount.trim();
    if (!value || accountSelected(value)) return;
    setAccounts((current) => [...current, { name: value, type: "general", color: "#ebe9e3" }]);
    setCustomAccount("");
  }

  function addCustomCategory() {
    const value = customCategory.trim();
    if (!value || categorySelected(value)) return;
    setCategories((current) => [...current, { name: value, type: "expense", icon: "Wallet", color: "#e3eee9" }]);
    setCustomCategory("");
  }

  function next() {
    setMessage("");
    if (step === 1 && !name.trim()) { setMessage("Tell us your name to continue."); return; }
    if (step === 2 && accounts.length === 0) { setMessage("Choose at least one account to continue."); return; }
    setStep((current) => current + 1);
  }

  async function finish() {
    if (!name.trim()) { setMessage("Please add your name before finishing setup."); return; }
    if (accounts.length === 0) { setMessage("Please choose at least one account."); return; }
    if (accounts.length > 12) { setMessage("Please choose no more than 12 accounts."); return; }
    if (new Set(accounts.map((account) => account.name.trim().toLocaleLowerCase())).size !== accounts.length) {
      setMessage("Please use a different name for each account.");
      return;
    }
    if (categories.length === 0) { setMessage("Choose at least one category to continue."); return; }
    if (categories.length > 50) { setMessage("Please choose no more than 50 categories."); return; }
    setIsSaving(true); setMessage("");
    try {
      const response = await authenticatedFetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), currency, avatarPreset, accounts, categories }) });
      if (response.ok) {
        router.replace("/");
        return;
      }
      const result = await response.json().catch(() => ({})) as { error?: string };
      setMessage(result.error ?? "Could not finish setup. Please try again.");
    } catch {
      setMessage("Could not reach Luna. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (step === 0) return <WelcomeScreen onContinue={() => setStep(1)} />;

  return (
    <main className="onboarding-page-enter h-[100dvh] min-h-0 overflow-hidden bg-background px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[520px] flex-col">
        <header>
          <div className="flex items-center justify-between text-sm font-semibold"><span className="text-primary">Luna</span><span className="text-muted-foreground">{progressStep} of 3</span></div>
          <div className="mt-5 grid grid-cols-3 gap-2" role="progressbar" aria-label={`Onboarding step ${progressStep} of 3`} aria-valuemin={1} aria-valuemax={3} aria-valuenow={progressStep}>{[1, 2, 3].map((segment) => <span key={segment} className={`h-1.5 rounded-full transition-colors duration-300 ${segment <= progressStep ? "bg-primary" : "bg-primary-soft"}`} />)}</div>
        </header>

        <section className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pt-8 pb-4 sm:pt-10 sm:pb-6">
          <div key={step} className="onboarding-step-enter">
            {step === 3 && <><p className="text-sm font-semibold text-primary">A little personal touch</p><h1 className="mt-3 text-[34px] font-semibold leading-[1.05] tracking-[-0.05em]">What do you spend on?</h1><p className="mt-4 text-[15px] leading-6 text-muted-foreground">Choose a few to get started. We’ll keep suggesting ideas as your budget grows.</p><CategoryPicker categories={categories} categorySelected={categorySelected} onToggle={toggleCategory} onToggleAll={toggleAllCategories} customCategory={customCategory} onCustomCategoryChange={setCustomCategory} onAddCustomCategory={addCustomCategory} /></>}
            {step === 0 && <div className="text-center">
              <div className="relative mx-auto mb-8 grid size-28 place-items-center rounded-[32px] bg-primary-soft shadow-[0_18px_45px_rgb(53_107_104_/_0.14)]">
                <span className="absolute -right-3 top-3 grid size-10 place-items-center rounded-2xl bg-[#D98E64] text-white shadow-sm"><TrendingUp aria-hidden="true" className="size-5" /></span>
                <span className="absolute -bottom-3 -left-3 grid size-10 place-items-center rounded-2xl bg-[#7D8DC4] text-white shadow-sm"><WalletCards aria-hidden="true" className="size-5" /></span>
                <WalletCards aria-hidden="true" className="size-14 text-primary" strokeWidth={1.6} />
              </div>
              <p className="text-sm font-semibold text-primary">A calmer way to manage money</p>
              <h1 className="mx-auto mt-3 max-w-[430px] text-[36px] font-semibold leading-[1.02] tracking-[-0.055em] sm:text-[42px]">Make every rupee feel intentional.</h1>
              <p className="mx-auto mt-5 max-w-[390px] text-[15px] leading-6 text-muted-foreground">Luna helps you track spending, plan ahead, and understand your money clearly — even when you are offline.</p>
              <div className="mt-9 grid grid-cols-3 gap-2 text-left">
                {[{ icon: TrendingUp, label: "Track", text: "See your flow" }, { icon: Landmark, label: "Plan", text: "Set your goals" }, { icon: Sprout, label: "Grow", text: "Build good habits" }].map(({ icon: FeatureIcon, label, text }) => <div key={label} className="rounded-2xl border border-border bg-card p-3"><span className="grid size-8 place-items-center rounded-xl bg-primary-soft text-primary"><FeatureIcon aria-hidden="true" className="size-4" /></span><p className="mt-3 text-sm font-semibold">{label}</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{text}</p></div>)}
              </div>
            </div>}

            {step === 1 && <>
              <p className="text-sm font-semibold text-primary">Let’s make this yours</p>
              <h1 className="mt-3 text-[34px] font-semibold leading-[1.05] tracking-[-0.05em]">What should we call you?</h1>
              <p className="mt-4 text-[15px] leading-6 text-muted-foreground">Your name will appear in your budget and on your profile.</p>
              <input autoFocus value={name} onChange={(event) => { setName(event.target.value); setMessage(""); }} onKeyDown={(event) => { if (event.key === "Enter") next(); }} aria-invalid={step === 1 && Boolean(message)} placeholder="Your full name" className={`mt-7 min-h-14 w-full rounded-[15px] border bg-card px-4 text-base outline-none transition-colors focus:ring-4 focus:ring-primary/10 ${message ? "border-expense text-expense placeholder:text-expense/60 focus:border-expense focus:ring-expense/10" : "border-border focus:border-primary"}`} />
              {message ? <p role="alert" className="mt-2 text-sm font-semibold text-expense motion-safe:animate-[title-error-nudge_260ms_ease-out]">{message}</p> : null}

              <label className="mt-5 block text-sm font-semibold">What currency do you use?</label>
              <button type="button" onClick={() => setIsCurrencyPickerOpen(true)} aria-label="Choose your currency" className="mt-2 flex min-h-14 w-full items-center gap-2.5 rounded-[13px] border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-primary-soft text-sm text-primary">{currencySymbol(currency)}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{currencyName(currency)}</span><span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{currency}</span></span>
                <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-foreground-subtle" />
              </button>
              <div className="my-5 border-t border-border" aria-hidden="true" />

              <div className="rounded-[16px] border border-border bg-card p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-sm font-semibold">Choose your profile icon</p><p className="mt-1 text-xs text-muted-foreground">Pick a fun emoji or let us surprise you.</p></div>
                  <Image src={avatarForPreset(avatarPreset)} alt="Selected profile icon" width={72} height={72} unoptimized className="size-16 shrink-0 rounded-[16px] border border-border bg-primary-soft sm:size-[72px]" />
                </div>
                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {AVATAR_PRESETS.map((preset) => <button key={preset.id} type="button" onClick={() => { setAvatarPreset(preset.id); setMessage(""); }} aria-label={`Choose ${preset.label} profile icon`} className={`flex min-w-0 flex-col items-center rounded-[12px] p-1 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${avatarPreset === preset.id ? "bg-primary/15 ring-2 ring-primary" : ""}`}><Image src={avatarForPreset(preset.id)} alt="" width={48} height={48} unoptimized className="size-12 rounded-[10px]" /><span className="mt-1 block max-w-full truncate text-[10px] text-muted-foreground">{preset.label}</span></button>)}
                </div>
                <button type="button" onClick={() => { setAvatarPreset(randomAvatarPreset()); setMessage(""); }} className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-primary/25 bg-primary-soft px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"><Sparkles aria-hidden="true" className="size-4" /> Surprise me with a fun emoji</button>
              </div>
            </>}

            {step === 1 && currencyPickerTransition.mounted ? createPortal(
              <div className={`fixed inset-0 z-50 flex items-end bg-foreground/25 ${currencyPickerTransition.closing ? "drawer-scrim-exit" : "drawer-scrim-enter"}`} role="presentation" onMouseDown={() => setIsCurrencyPickerOpen(false)}>
                <section role="dialog" aria-modal="true" aria-labelledby="onboarding-currency-picker-title" className={`${currencyPickerTransition.closing ? "drawer-exit" : "drawer-enter"} flex max-h-[88dvh] w-full flex-col rounded-t-[24px] border-t border-border bg-background pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)]`} onMouseDown={(event) => event.stopPropagation()}>
                  <div aria-hidden="true" className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-foreground/20" />
                  <div className="flex items-start justify-between gap-4 px-5 pb-1 pt-4">
                    <div><h2 id="onboarding-currency-picker-title" className="text-lg font-semibold">Choose your currency</h2><p className="mt-1 text-xs text-muted-foreground">Browse all currencies supported by your device.</p></div>
                    <button type="button" onClick={() => { setIsCurrencyPickerOpen(false); setCurrencySearch(""); }} className="text-sm font-semibold text-muted-foreground">Close</button>
                  </div>
                  <div className="px-5">
                    <input autoFocus value={currencySearch} onChange={(event) => setCurrencySearch(event.target.value)} placeholder="Search currency or code" className="mt-4 min-h-11 w-full rounded-[10px] border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
                  </div>
                  <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto px-5">
                    {CURRENCY_CODES.filter((code) => `${code} ${currencyName(code)}`.toLowerCase().includes(currencySearch.toLowerCase())).map((code) => <button key={code} type="button" onClick={() => { setCurrency(code); setIsCurrencyPickerOpen(false); setCurrencySearch(""); }} className={`flex min-h-12 w-full items-center gap-3 rounded-[10px] px-2 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${currency === code ? "bg-primary-soft" : ""}`}><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{currencySymbol(code)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{currencyName(code)}</span><span className="block text-xs text-muted-foreground">{code}</span></span>{currency === code ? <Check aria-hidden="true" className="size-4 text-primary" /> : null}</button>)}
                  </div>
                </section>
              </div>,
              document.body,
            ) : null}

            {step === 2 && <><p className="text-sm font-semibold text-primary">Your money, your way</p><h1 className="mt-3 text-[34px] font-semibold leading-[1.05] tracking-[-0.05em]">Where do you keep your money?</h1><p className="mt-4 text-[15px] leading-6 text-muted-foreground">Tap to add an account. You can add as many as you need.</p><div className="mt-8 flex flex-wrap gap-2.5">{ACCOUNT_SUGGESTIONS.map((account) => <button key={account.name} type="button" onClick={() => toggleAccount(account)} className={`flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition-all ${accountSelected(account.name) ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card hover:border-primary/50"}`}><span className="grid size-7 place-items-center rounded-full" style={{ backgroundColor: account.color }}><WalletCards aria-hidden="true" className="size-4 text-white" /></span>{account.name}{accountSelected(account.name) && <Check aria-hidden="true" className="size-4" />}</button>)}</div>{accounts.filter((account) => !ACCOUNT_SUGGESTIONS.some((suggestion) => suggestion.name === account.name)).length > 0 && <div aria-label="Added accounts" className="mt-4 flex flex-wrap gap-2">{accounts.filter((account) => !ACCOUNT_SUGGESTIONS.some((suggestion) => suggestion.name === account.name)).map((account) => <button key={account.name} type="button" onClick={() => toggleAccount(account)} className="flex items-center gap-2 rounded-full border border-primary bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm"><span className="grid size-7 place-items-center rounded-full" style={{ backgroundColor: account.color }}><WalletCards aria-hidden="true" className="size-4 text-white" /></span>{account.name}<X aria-hidden="true" className="size-4" /></button>)}</div>}<div className="mt-8 flex gap-2"><input value={customAccount} onChange={(event) => setCustomAccount(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCustomAccount(); }} placeholder="Add another account" className="min-h-12 min-w-0 flex-1 rounded-[13px] border border-border bg-card px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /><button type="button" onClick={addCustomAccount} className="flex size-12 shrink-0 items-center justify-center rounded-[13px] bg-surface-subtle text-primary hover:bg-primary-soft" aria-label="Add account"><Plus className="size-5" /></button></div>{accounts.length > 0 && <p className="mt-5 text-sm text-muted-foreground">{accounts.length} account{accounts.length === 1 ? "" : "s"} ready</p>}</>}

          </div>
          {message && step !== 1 ? <p role="alert" aria-live="assertive" className="mt-5 min-h-5 rounded-[11px] border border-expense/25 bg-expense-soft px-3 py-2.5 text-sm font-semibold text-expense motion-safe:animate-[title-error-nudge_260ms_ease-out]">{message}</p> : null}
        </section>

        <footer className="sticky bottom-0 z-20 -mx-4 mt-5 flex items-center justify-between gap-4 border-t border-border bg-background/95 px-4 pt-4 pb-2 backdrop-blur sm:-mx-6 sm:px-6">
          {step > 1 ? <button type="button" onClick={() => { setMessage(""); setStep((current) => current - 1); }} className="flex min-h-12 items-center gap-1 rounded-[13px] px-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" />Back</button> : <span />}
          {step < 3 ? <MagneticContinueButton onClick={next}>{step === 0 ? "Continue Onboarding" : "Continue"}<ArrowRight aria-hidden="true" className="size-4" /></MagneticContinueButton> : <MagneticContinueButton disabled={isSaving} onClick={() => void finish()}>{isSaving ? "Setting things up…" : "Take me to my budget"}<ArrowRight aria-hidden="true" className="size-4" /></MagneticContinueButton>}
        </footer>
      </div>
    </main>
  );
}
