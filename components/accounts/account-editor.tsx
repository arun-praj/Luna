"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Check,
  CircleDollarSign,
  ImagePlus,
  Landmark,
  Palette,
  Smartphone,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";

import { accountImages } from "@/lib/account-images";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { formatMoney, MoneyEditor } from "@/components/money/money-editor";

const accountTypes = [
  { value: "bank", label: "Bank", icon: Landmark },
  { value: "wallet", label: "Wallet", icon: Smartphone },
  { value: "savings", label: "Savings", icon: WalletCards },
  { value: "cash", label: "Cash", icon: CircleDollarSign },
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

export type AccountEditorData = {
  id: string;
  name: string;
  type: string;
  balance: string;
  includeInTotal: boolean;
  colorIndex: number;
  imageIndex: number;
};

export function AccountEditor({
  account,
}: {
  account?: AccountEditorData;
}) {
  const isNew = !account;
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.type ?? "");
  const [balance, setBalance] = useState(account?.balance ?? "0");
  const [includeInTotal, setIncludeInTotal] = useState(
    account?.includeInTotal ?? true,
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
  const [imageError, setImageError] = useState("");

  const selectedColorOption =
    selectedColor === "custom" ? null : colorOptions[selectedColor];
  const selectedImageSource =
    selectedImage === "custom" && customImage
      ? customImage
      : imageOptions[selectedImage === "custom" ? 0 : selectedImage].src;

  const uploadImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Choose a valid image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("The image must be smaller than 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCustomImage(String(reader.result));
      setSelectedImage("custom");
      setImageError("");
    };
    reader.readAsDataURL(file);
  };

  const canSave =
    Boolean(name.trim()) &&
    Boolean(type) &&
    balance.trim() !== "" &&
    Number(balance) >= 0;

  const displayBalance = formatMoney(balance);

  return (
    <main className="min-h-dvh overflow-x-hidden animate-in fade-in-0 slide-in-from-right-4 bg-background duration-300 motion-reduce:animate-none">
      <div className="mx-auto w-full max-w-[560px] px-4 pb-12 sm:px-5">
        <StickyPageHeader className="-mx-4 grid grid-cols-[44px_1fr_44px] items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <Link
            href="/accounts"
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
            disabled={!canSave}
            className="flex size-11 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:border-border disabled:bg-surface-subtle disabled:text-foreground-subtle"
          >
            <Check aria-hidden="true" className="size-5" />
          </button>
        </StickyPageHeader>

        <section
          aria-label="Account preview"
          className={`mt-8 overflow-hidden rounded-[16px] border ${
            selectedColorOption?.cardClassName ?? ""
          }`}
          style={
            selectedColor === "custom"
              ? {
                  backgroundColor: customColor,
                  borderColor: `color-mix(in srgb, ${customColor}, #17201d 16%)`,
                }
              : undefined
          }
        >
          <div className="flex min-h-[108px] items-center gap-3 px-4 py-4 min-[390px]:min-h-[116px] min-[390px]:gap-4 min-[390px]:px-5 min-[390px]:py-5">
            <Image
              src={selectedImageSource}
              alt=""
              width={52}
              height={52}
              className="size-12 shrink-0 rounded-[13px] border border-white/75 bg-white/45 min-[390px]:size-[52px]"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold">
                {name.trim() || "Your account"}
              </p>
              <p className="mt-1 text-xs font-medium capitalize text-muted-foreground">
                {type ? `${type} account` : "Choose an account type"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="max-w-[108px] truncate text-[18px] font-semibold tracking-[-0.03em] tabular-nums min-[390px]:max-w-none min-[390px]:text-[20px]">
                {displayBalance}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                NPR
              </p>
            </div>
          </div>
          <div className="border-t border-current/10 bg-white/40 px-4 py-2.5 text-xs font-medium text-muted-foreground min-[390px]:px-5">
            {includeInTotal ? "Included in total balance" : "Excluded from total balance"}
          </div>
        </section>

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
              className="mt-2 h-12 w-full rounded-[10px] border border-input bg-background px-4 text-[15px] outline-none transition-colors placeholder:text-foreground-subtle focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
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

          <div>
            <p className="text-sm font-semibold">
              Starting balance
            </p>
            <button
              type="button"
              aria-label="Edit starting balance"
              onClick={() => setBalanceEditorOpen(true)}
              className="relative mt-2 flex min-h-12 w-full items-center rounded-[10px] border border-input bg-background px-4 outline-none transition-colors hover:border-primary/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
            >
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                NPR
              </span>
              <span className="ml-auto pl-12 text-right text-[16px] font-semibold tabular-nums">
                {displayBalance}
              </span>
            </button>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Tap to open the numpad and calculator
            </p>
          </div>

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
                    className="size-11 rounded-[9px]"
                  />
                </button>
              ))}
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
                <ImagePlus aria-hidden="true" className="size-5" />
                Upload
              </label>
            </div>
            <p
              className={`mt-2 text-xs ${
                imageError ? "text-expense" : "text-muted-foreground"
              }`}
            >
              {imageError || "Upload a custom image up to 5 MB."}
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
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[11px] border border-expense/25 bg-expense-soft px-4 text-sm font-semibold text-expense transition-colors hover:border-expense/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-expense/30"
            >
              <Trash2 aria-hidden="true" className="size-[18px]" />
              Delete account
            </button>
            <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">
              Transactions in this account will need to be reassigned.
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
