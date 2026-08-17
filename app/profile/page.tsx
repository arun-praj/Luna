"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  Check,
  EyeOff,
  FileText,
  Landmark,
  Gauge,
  HandCoins,
  LockKeyhole,
  LogOut,
  Pencil,
  Repeat2,
  Sparkles,
  X,
  Tags,
  Target,
  WalletCards,
} from "lucide-react";

import { AVATAR_PRESETS, avatarForPreset, randomAvatarPreset } from "@/lib/avatar";
import { authenticatedFetch, loginPathFor, signOut } from "@/lib/auth-client";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { NotificationSettingsCard } from "@/components/notifications/notification-settings";
import { SecuritySettingsCard } from "@/components/profile/security-settings";
import { PrivacySettingsCard } from "@/components/profile/privacy-settings";
import { PageDataSkeleton } from "@/components/ui/data-skeleton";
import { withReturnTo } from "@/lib/navigation";
import { AppTutorial } from "@/components/tutorial/app-tutorial";
import { DataExportButton } from "@/components/profile/data-export";

type ProfileUser = {
  id: string;
  name: string;
  email: string;
  currency: string;
  hideTotalBalance: boolean;
  monthlyReportEnabled: boolean;
  lastLoginAt: string | null;
  avatarPreset: string;
  emailVerifiedAt: string | null;
};

const CURRENCY_CODES =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("currency")
    : ["NPR", "USD", "EUR", "INR"];

function currencySymbol(code: string) {
  try {
    return (
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? code
    );
  } catch {
    return code;
  }
}

function currencyName(code: string) {
  try {
    return (
      new Intl.DisplayNames(undefined, { type: "currency" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}

function formatLocalDateTime(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [isAvatarPickerClosing, setIsAvatarPickerClosing] = useState(false);
  const [randomAvatarPreview, setRandomAvatarPreview] = useState<string | null>(null);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState("");
  const [isAccountDetailsOpen, setIsAccountDetailsOpen] = useState(false);
  const [isAccountEditorClosing, setIsAccountEditorClosing] = useState(false);
  const [isCurrencyPickerOpen, setIsCurrencyPickerOpen] = useState(false);
  const [isCurrencyPickerClosing, setIsCurrencyPickerClosing] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);
  const [isSavingBalancePrivacy, setIsSavingBalancePrivacy] = useState(false);
  const [balancePrivacyMessage, setBalancePrivacyMessage] = useState("");
  const avatarCloseTimer = useRef<number | null>(null);
  const accountEditorCloseTimer = useRef<number | null>(null);
  const currencyCloseTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    void authenticatedFetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) {
          router.replace(loginPathFor("/profile"));
          return;
        }
        const result = (await response.json()) as { user: ProfileUser };
        if (active) setUser(result.user);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    return () => {
      if (avatarCloseTimer.current !== null) {
        window.clearTimeout(avatarCloseTimer.current);
      }
      if (accountEditorCloseTimer.current !== null) {
        window.clearTimeout(accountEditorCloseTimer.current);
      }
      if (currencyCloseTimer.current !== null) {
        window.clearTimeout(currencyCloseTimer.current);
      }
    };
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);
    await signOut();
    router.replace("/login");
  }

  async function handleAvatarSelect(avatarPreset: string) {
    setIsSavingAvatar(true);
    const response = await authenticatedFetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarPreset }),
    });
    if (response.ok) {
      const result = (await response.json()) as { user: ProfileUser };
      setUser(result.user);
      window.localStorage.setItem(
        "cocomelon.avatar-preset",
        result.user.avatarPreset,
      );
      closeAvatarPicker();
    }
    setIsSavingAvatar(false);
  }

  function openAvatarPicker() {
    if (avatarCloseTimer.current !== null) {
      window.clearTimeout(avatarCloseTimer.current);
      avatarCloseTimer.current = null;
    }
    setIsAvatarPickerClosing(false);
    setRandomAvatarPreview(null);
    setIsAvatarPickerOpen(true);
  }

  function closeAvatarPicker() {
    if (!isAvatarPickerOpen || isAvatarPickerClosing) return;
    if (avatarCloseTimer.current !== null) {
      window.clearTimeout(avatarCloseTimer.current);
    }
    setIsAvatarPickerClosing(true);
    avatarCloseTimer.current = window.setTimeout(() => {
      setIsAvatarPickerOpen(false);
      setIsAvatarPickerClosing(false);
      setRandomAvatarPreview(null);
      avatarCloseTimer.current = null;
    }, 320);
  }

  function startEditingName() {
    if (!user) return;
    setEditedName(user.name);
    setNameMessage("");
    setIsEditingName(true);
  }

  function cancelEditingName() {
    setIsEditingName(false);
    setNameMessage("");
  }

  function openAccountEditor() {
    if (accountEditorCloseTimer.current !== null) {
      window.clearTimeout(accountEditorCloseTimer.current);
      accountEditorCloseTimer.current = null;
    }
    setIsAccountEditorClosing(false);
    setIsAccountDetailsOpen(true);
  }

  function closeAccountEditor() {
    if (!isAccountDetailsOpen || isAccountEditorClosing) return;
    if (accountEditorCloseTimer.current !== null) {
      window.clearTimeout(accountEditorCloseTimer.current);
    }
    setIsAccountEditorClosing(true);
    accountEditorCloseTimer.current = window.setTimeout(() => {
      setIsAccountDetailsOpen(false);
      setIsAccountEditorClosing(false);
      accountEditorCloseTimer.current = null;
    }, 320);
  }

  async function saveName() {
    setIsSavingName(true);
    setNameMessage("");
    const response = await authenticatedFetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editedName }),
    });
    if (response.ok) {
      const result = (await response.json()) as { user: ProfileUser };
      setUser(result.user);
      setIsEditingName(false);
      setNameMessage("Saved");
    } else {
      setNameMessage("Could not save name");
    }
    setIsSavingName(false);
  }

  async function saveCurrency(currency: string) {
    setIsSavingCurrency(true);
    const response = await authenticatedFetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency }),
    });
    if (response.ok) {
      const result = (await response.json()) as { user: ProfileUser };
      setUser(result.user);
      closeCurrencyPicker();
      setCurrencySearch("");
    }
    setIsSavingCurrency(false);
  }

  async function saveHideTotalBalance(hideTotalBalance: boolean) {
    if (!user) return;
    const previousValue = user.hideTotalBalance;
    setIsSavingBalancePrivacy(true);
    setBalancePrivacyMessage("");
    setUser((current) => current ? { ...current, hideTotalBalance } : current);
    const response = await authenticatedFetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hideTotalBalance }),
    });
    if (response.ok) {
      const result = (await response.json()) as { user: ProfileUser };
      setUser(result.user);
    } else {
      setUser((current) => current ? { ...current, hideTotalBalance: previousValue } : current);
      setBalancePrivacyMessage("Could not save this preference");
    }
    setIsSavingBalancePrivacy(false);
  }

  function openCurrencyPicker() {
    if (currencyCloseTimer.current !== null) {
      window.clearTimeout(currencyCloseTimer.current);
      currencyCloseTimer.current = null;
    }
    setIsCurrencyPickerClosing(false);
    setIsCurrencyPickerOpen(true);
  }

  function closeCurrencyPicker() {
    if (!isCurrencyPickerOpen || isCurrencyPickerClosing) return;
    if (currencyCloseTimer.current !== null) {
      window.clearTimeout(currencyCloseTimer.current);
    }
    setIsCurrencyPickerClosing(true);
    currencyCloseTimer.current = window.setTimeout(() => {
      setIsCurrencyPickerOpen(false);
      setIsCurrencyPickerClosing(false);
      currencyCloseTimer.current = null;
    }, 320);
  }

  if (isLoading || !user) {
    return <PageDataSkeleton label="Loading profile" />;
  }

  return (
    <main
      className="profile-route-enter min-h-screen bg-background"
    >
      <div className="mx-auto w-full max-w-[720px] px-4 pb-12 sm:px-5">
        <StickyPageHeader className="-mx-4 flex items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <Link
            href="/"
            aria-label="Back to home"
            className="flex size-11 items-center justify-center rounded-[10px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
          </Link>
          <h1 className="text-[24px] font-semibold tracking-[-0.035em]">
            Profile
          </h1>
          <div className="ml-auto">
            <DataExportButton currency={user.currency} />
          </div>
        </StickyPageHeader>

        <section data-tour="profile-page" className="mt-10 flex flex-col items-center text-center">
          <div className="relative">
            <Image
              src={avatarForPreset(user.avatarPreset)}
              alt={`${user.name}'s avatar`}
              width={88}
              height={88}
              unoptimized
              priority
              className="size-[88px] rounded-[18px] border border-border bg-primary-soft"
            />
            <button
              type="button"
              aria-label="Choose profile icon"
              onClick={openAvatarPicker}
              className="absolute -bottom-2 -right-2 flex size-9 items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Pencil aria-hidden="true" className="size-3.5" />
            </button>
          </div>
          <h2 className="mt-4 text-[22px] font-semibold tracking-[-0.03em]">
            {user.name}
          </h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            {user.emailVerifiedAt ? (
              <Image
                src="/email-verified-badge.png"
                alt="Email verified"
                width={20}
                height={20}
                aria-label="Email verified"
                title="Email verified"
                unoptimized
                className="size-[20px] shrink-0 object-contain"
              />
            ) : null}
            {user.email}
          </p>
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={openAccountEditor}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <Pencil aria-hidden="true" className="size-3.5" />
              Edit your account and currency
            </button>
          </div>
        </section>

        <nav aria-label="Profile quick links" className="mt-6 grid grid-cols-2 gap-2">
          {[
            { href: withReturnTo("/accounts", "/profile"), label: "Accounts", icon: WalletCards },
            { href: withReturnTo("/loans", "/profile"), label: "Loans", icon: HandCoins },
            { href: withReturnTo("/categories", "/profile"), label: "Categories", icon: Tags },
            { href: withReturnTo("/budgets", "/profile"), label: "Budgets", icon: Gauge },
            { href: withReturnTo("/savings-instruments", "/profile"), label: "Saving Instruments", icon: Landmark },
            { href: withReturnTo("/goals", "/profile"), label: "Goals", icon: Target },
            { href: withReturnTo("/recurring", "/profile"), label: "Recurring", icon: Repeat2 },
            { href: withReturnTo("/reports", "/profile"), label: "Reports", icon: FileText },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex min-h-[64px] min-w-0 items-center gap-2 rounded-[12px] border border-border bg-card px-2.5 py-2 text-left transition-colors hover:bg-surface-subtle focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-primary-soft text-primary"><Icon aria-hidden="true" className="size-4" /></span>
              <span className="min-w-0 flex-1 text-[13px] font-semibold leading-4">{label}</span>
              <ChevronRight aria-hidden="true" className="size-[15px] shrink-0 text-foreground-subtle" />
            </Link>
          ))}
        </nav>

        {isAvatarPickerOpen ? (
          <div
            className={`fixed inset-0 z-50 flex items-end bg-foreground/30 ${isAvatarPickerClosing ? "profile-scrim-exit" : "profile-scrim-enter"}`}
            role="presentation"
            onPointerDown={closeAvatarPicker}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="avatar-picker-title"
              className={`flex max-h-[88dvh] w-full flex-col rounded-t-[24px] border-t border-border bg-background pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)] ${isAvatarPickerClosing ? "drawer-exit" : "drawer-enter"}`}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div
                className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-foreground/20"
                aria-hidden="true"
              />
              <header className="flex shrink-0 items-center justify-between border-b border-border px-4 pb-3 pt-3">
                <button
                  type="button"
                  aria-label="Close icon picker"
                  onClick={closeAvatarPicker}
                  className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
                <div className="min-w-0 text-center">
                  <h2
                    id="avatar-picker-title"
                    className="text-base font-semibold"
                  >
                    Choose your icon
                  </h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Pick an icon that feels like you.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeAvatarPicker}
                  className="rounded-[10px] bg-primary-soft px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                >
                  Done
                </button>
              </header>
              <div className="min-h-0 overflow-y-auto px-4 pb-3 pt-4">
                <div className="grid grid-cols-4 gap-3 min-[390px]:grid-cols-5">
                <button
                  type="button"
                  disabled={isSavingAvatar}
                  onClick={() => setRandomAvatarPreview(randomAvatarPreset())}
                  aria-label="Generate a surprise profile icon"
                  className="flex min-w-0 flex-col items-center rounded-[12px] p-1 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
                >
                  <span className="flex aspect-square w-full items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                    <Sparkles aria-hidden="true" className="size-6" />
                  </span>
                  <span className="mt-1 block max-w-full truncate text-[10px] text-muted-foreground">
                    Surprise me
                  </span>
                </button>
                {randomAvatarPreview ? (
                  <button
                    type="button"
                    disabled={isSavingAvatar}
                    onClick={() => void handleAvatarSelect(randomAvatarPreview)}
                    aria-label="Use generated profile icon"
                    className="flex min-w-0 flex-col items-center rounded-[12px] bg-primary/15 p-1 ring-2 ring-primary transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
                  >
                    <Image
                      src={avatarForPreset(randomAvatarPreview)}
                      alt=""
                      width={58}
                      height={58}
                      unoptimized
                      className="aspect-square w-full rounded-[10px]"
                    />
                    <span className="mt-1 block max-w-full truncate text-[10px] font-semibold text-primary">
                      Use this icon
                    </span>
                  </button>
                ) : null}
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={isSavingAvatar}
                    onClick={() => void handleAvatarSelect(preset.id)}
                    aria-label={`Choose ${preset.label} icon`}
                    className={`rounded-[12px] p-1 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${user.avatarPreset === preset.id ? "bg-primary/15 ring-2 ring-primary" : ""}`}
                  >
                    <Image
                      src={avatarForPreset(preset.id)}
                      alt=""
                      width={58}
                      height={58}
                      unoptimized
                      className="size-full rounded-[10px]"
                    />
                    <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                      {preset.label}
                    </span>
                  </button>
                ))}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {isAccountDetailsOpen ? (
          <div
            className={`fixed inset-0 z-50 flex items-end bg-foreground/30 ${isAccountEditorClosing ? "profile-scrim-exit" : "profile-scrim-enter"}`}
            role="presentation"
            onPointerDown={closeAccountEditor}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-editor-title"
              className={`flex max-h-[78dvh] w-full flex-col rounded-t-[24px] border-t border-border bg-background pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)] ${isAccountEditorClosing ? "drawer-exit" : "drawer-enter"}`}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div
                className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-foreground/20"
                aria-hidden="true"
              />
              <header className="flex shrink-0 items-center justify-start gap-3 border-b border-border px-4 pb-3 pt-3">
                <button
                  type="button"
                  aria-label="Close account editor"
                  onClick={closeAccountEditor}
                  className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Profile</p>
                  <h2 id="account-editor-title" className="text-lg font-semibold">
                    Edit your account and currency
                  </h2>
                </div>
              </header>
              <div className="min-h-0 overflow-y-auto px-4 pb-4 pt-4">
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="profile-name"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Name
                      </label>
                      {!isEditingName ? (
                        <button
                          type="button"
                          onClick={startEditingName}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                        >
                          <Pencil aria-hidden="true" className="size-3.5" /> Edit
                        </button>
                      ) : null}
                    </div>
                    {isEditingName ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          id="profile-name"
                          value={editedName}
                          onChange={(event) => setEditedName(event.target.value)}
                          autoFocus
                          maxLength={100}
                          className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                        />
                        <button
                          type="button"
                          onClick={() => void saveName()}
                          disabled={isSavingName}
                          aria-label="Save name"
                          className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground disabled:opacity-60"
                        >
                          <Check aria-hidden="true" className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingName}
                          disabled={isSavingName}
                          aria-label="Cancel name edit"
                          className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-border text-muted-foreground disabled:opacity-60"
                        >
                          <X aria-hidden="true" className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm font-medium">{user.name}</p>
                    )}
                    {nameMessage ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {nameMessage}
                      </p>
                    ) : null}
                  </div>
    <div className="border-t border-border/60 pt-4">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span>Email address</span>
                      <LockKeyhole aria-hidden="true" className="size-3" />
                    </div>
                    <p aria-readonly="true" className="mt-1 text-sm text-muted-foreground">
                      {user.email}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Email cannot be changed here.
                    </p>
                  </div>
                  <div className="border-t border-border/60 pt-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      Currency
                    </p>
                    <button
                      type="button"
                      onClick={openCurrencyPicker}
                      className="mt-2 flex min-h-[64px] w-full items-center gap-3 rounded-[12px] border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-sm font-semibold text-primary">
                        {currencySymbol(user.currency)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          {currencyName(user.currency)}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {user.currency}
                        </span>
                      </span>
                      <Pencil aria-hidden="true" className="size-4 text-foreground-subtle" />
                    </button>
                  </div>
                  <div className="border-t border-border/60 pt-4">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                        <EyeOff aria-hidden="true" className="size-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">Hide total balance</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Keep balances hidden until you tap the total. It will be visible for 5 seconds.
                        </p>
                      </div>
      <button
        type="button"
        role="switch"
        aria-checked={user.hideTotalBalance}
        aria-label="Hide total balance"
        aria-busy={isSavingBalancePrivacy}
        disabled={isSavingBalancePrivacy}
        onClick={() => void saveHideTotalBalance(!user.hideTotalBalance)}
                        className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60 ${user.hideTotalBalance ? "bg-primary" : "bg-border-strong"}`}
                      >
        <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${user.hideTotalBalance ? "left-6" : "left-1"}`} />
      </button>
    </div>
    {balancePrivacyMessage ? <p className="mt-2 text-xs text-danger">{balancePrivacyMessage}</p> : null}
  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {isCurrencyPickerOpen ? (
          <div
            className={`fixed inset-0 z-50 flex items-end bg-foreground/30 ${isCurrencyPickerClosing ? "profile-scrim-exit" : "profile-scrim-enter"}`}
            role="presentation"
            onPointerDown={closeCurrencyPicker}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="currency-picker-title"
              className={`flex max-h-[88dvh] w-full flex-col rounded-t-[24px] border-t border-border bg-background pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-18px_50px_rgb(23_32_29_/_0.18)] ${isCurrencyPickerClosing ? "drawer-exit" : "drawer-enter"}`}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div
                className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-foreground/20"
                aria-hidden="true"
              />
              <header className="flex shrink-0 items-center justify-between border-b border-border px-4 pb-3 pt-3">
                <button
                  type="button"
                  aria-label="Close currency picker"
                  onClick={closeCurrencyPicker}
                  className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
                <div className="min-w-0 text-center">
                  <h2
                    id="currency-picker-title"
                    className="text-base font-semibold"
                  >
                    Choose your currency
                  </h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Browse all currencies supported by your device.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCurrencyPicker}
                  className="rounded-[10px] bg-primary-soft px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                >
                  Done
                </button>
              </header>
              <div className="min-h-0 overflow-y-auto px-4">
                <input
                  autoFocus
                  value={currencySearch}
                  onChange={(event) => setCurrencySearch(event.target.value)}
                  placeholder="Search currency or code"
                  className="mt-4 min-h-11 w-full rounded-[10px] border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
                <div className="mt-3 space-y-1 pb-2">
                  {CURRENCY_CODES.filter((code) =>
                    `${code} ${currencyName(code)}`
                      .toLowerCase()
                      .includes(currencySearch.toLowerCase()),
                  ).map((code) => (
                    <button
                      key={code}
                      type="button"
                      disabled={isSavingCurrency}
                      onClick={() => void saveCurrency(code)}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-[10px] px-2 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${user.currency === code ? "bg-primary-soft" : ""}`}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                        {currencySymbol(code)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {currencyName(code)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {code}
                        </span>
                      </span>
                      {user.currency === code ? (
                        <Check
                          aria-hidden="true"
                          className="size-4 text-primary"
                        />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        <section className="mt-10" aria-labelledby="preferences-privacy-heading">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Your preferences</p>
          <h2 id="preferences-privacy-heading" className="mt-1 text-xl font-semibold tracking-[-0.03em]">Notifications, security & privacy</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">Control how Luna contacts you and protects your information.</p>
        </section>

        <NotificationSettingsCard
          userId={user.id}
          monthlyReportEnabled={user.monthlyReportEnabled}
          onMonthlyReportChange={(monthlyReportEnabled) => setUser((current) => current ? { ...current, monthlyReportEnabled } : current)}
        />
        <SecuritySettingsCard userId={user.id} />

        <PrivacySettingsCard />

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] border border-expense/25 bg-expense-soft px-4 text-sm font-semibold text-expense transition-colors hover:bg-expense/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-expense/25"
        >
          <LogOut aria-hidden="true" className="size-[18px]" />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Last login: {formatLocalDateTime(user.lastLoginAt)}
        </p>
      </div>
      <AppTutorial mode="profile" />
    </main>
  );
}
