"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Baby,
  Banknote,
  BookOpen,
  BriefcaseBusiness,
  BusFront,
  CarFront,
  Check,
  Clapperboard,
  Coffee,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Music,
  Palette,
  PawPrint,
  Plane,
  Shirt,
  ShoppingBag,
  Smartphone,
  Trash2,
  Utensils,
  WalletCards,
  Wifi,
  Wrench,
  X,
} from "lucide-react";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";

const iconOptions = [
  { label: "Home", icon: House },
  { label: "Food", icon: Utensils },
  { label: "Shopping", icon: ShoppingBag },
  { label: "Travel", icon: CarFront },
  { label: "Health", icon: HeartPulse },
  { label: "Gifts", icon: Gift },
  { label: "Work", icon: BriefcaseBusiness },
  { label: "Wallet", icon: WalletCards },
  { label: "Coffee", icon: Coffee },
  { label: "Fitness", icon: Dumbbell },
  { label: "Education", icon: GraduationCap },
  { label: "Flights", icon: Plane },
  { label: "Pets", icon: PawPrint },
  { label: "Gaming", icon: Gamepad2 },
  { label: "Music", icon: Music },
  { label: "Baby", icon: Baby },
  { label: "Clothing", icon: Shirt },
  { label: "Repairs", icon: Wrench },
  { label: "Internet", icon: Wifi },
  { label: "Cash", icon: Banknote },
  { label: "Books", icon: BookOpen },
  { label: "Phone", icon: Smartphone },
  { label: "Fuel", icon: Fuel },
  { label: "Bus", icon: BusFront },
  { label: "Movies", icon: Clapperboard },
];
const quickIconOptions = iconOptions.slice(0, 8);

const colorOptions = [
  {
    name: "Sage",
    backgroundClassName: "bg-[#e3eee9]",
    foregroundClassName: "text-primary",
    borderClassName: "border-[#c7dbd2]",
  },
  {
    name: "Sky",
    backgroundClassName: "bg-[#e3eff6]",
    foregroundClassName: "text-info",
    borderClassName: "border-[#cadde9]",
  },
  {
    name: "Mint",
    backgroundClassName: "bg-[#e5f3eb]",
    foregroundClassName: "text-income",
    borderClassName: "border-[#c7dbd2]",
  },
  {
    name: "Sand",
    backgroundClassName: "bg-[#f3e8d4]",
    foregroundClassName: "text-warning",
    borderClassName: "border-[#e3d2b6]",
  },
  {
    name: "Blush",
    backgroundClassName: "bg-[#f8e9e6]",
    foregroundClassName: "text-expense",
    borderClassName: "border-[#e6c9c4]",
  },
  {
    name: "Lavender",
    backgroundClassName: "bg-[#ece6f3]",
    foregroundClassName: "text-[#735b8f]",
    borderClassName: "border-[#d8cee7]",
  },
  {
    name: "Peach",
    backgroundClassName: "bg-[#fbe8dc]",
    foregroundClassName: "text-[#b55d35]",
    borderClassName: "border-[#efd0bf]",
  },
  {
    name: "Lemon",
    backgroundClassName: "bg-[#f7f0c9]",
    foregroundClassName: "text-[#9b7b16]",
    borderClassName: "border-[#e9dda1]",
  },
  {
    name: "Lime",
    backgroundClassName: "bg-[#e8f1d9]",
    foregroundClassName: "text-[#648735]",
    borderClassName: "border-[#cfdfb4]",
  },
  {
    name: "Seafoam",
    backgroundClassName: "bg-[#dff1ed]",
    foregroundClassName: "text-[#277b72]",
    borderClassName: "border-[#c2dfd9]",
  },
  {
    name: "Periwinkle",
    backgroundClassName: "bg-[#e5e9f8]",
    foregroundClassName: "text-[#5368a5]",
    borderClassName: "border-[#cbd3ef]",
  },
  {
    name: "Mauve",
    backgroundClassName: "bg-[#f0e3ec]",
    foregroundClassName: "text-[#905c80]",
    borderClassName: "border-[#dfc9da]",
  },
  {
    name: "Stone",
    backgroundClassName: "bg-[#ebe9e3]",
    foregroundClassName: "text-[#706e65]",
    borderClassName: "border-[#d8d5cb]",
  },
  {
    name: "Denim",
    backgroundClassName: "bg-[#dfeaf3]",
    foregroundClassName: "text-[#4d7596]",
    borderClassName: "border-[#c6d9e8]",
  },
];

export type CategoryEditorData = {
  id: string;
  name: string;
  iconIndex: number;
  colorIndex: number;
};

export function CategoryEditor({
  category,
}: {
  category?: CategoryEditorData;
}) {
  const isNew = !category;
  const [name, setName] = useState(category?.name ?? "");
  const [selectedIcon, setSelectedIcon] = useState(category?.iconIndex ?? 0);
  const [selectedColor, setSelectedColor] = useState<number | "custom">(
    category?.colorIndex ?? 0,
  );
  const [customColor, setCustomColor] = useState("#356b68");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const PreviewIcon = iconOptions[selectedIcon].icon;
  const selectedColorOption = selectedColor === "custom" ? null : colorOptions[selectedColor];

  return (
    <main className="min-h-dvh overflow-x-hidden animate-in fade-in-0 slide-in-from-right-4 bg-background duration-300 motion-reduce:animate-none">
      <div className="mx-auto w-full max-w-[560px] px-4 pb-12 sm:px-5">
        <StickyPageHeader className="-mx-4 grid grid-cols-[44px_1fr_44px] items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <Link
            href="/categories"
            aria-label={isNew ? "Cancel new category" : "Cancel editing category"}
            className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <X aria-hidden="true" className="size-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Categories</p>
            <h1 className="truncate text-[26px] font-semibold tracking-[-0.04em]">
              {isNew ? "New category" : "Edit category"}
            </h1>
          </div>
          <button
            type="button"
            aria-label={isNew ? "Add category" : "Save category changes"}
            disabled={!name.trim()}
            className="flex size-11 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:border-border disabled:bg-surface-subtle disabled:text-foreground-subtle"
          >
            <Check aria-hidden="true" className="size-5" />
          </button>
        </StickyPageHeader>

        <section className="mt-8 min-w-0 overflow-hidden rounded-[18px] border border-border bg-card p-4 min-[390px]:p-5 sm:p-6">
          <div className="flex flex-col items-center text-center">
            <div
              className={`flex size-[72px] items-center justify-center rounded-[20px] border ${
                selectedColorOption
                  ? `${selectedColorOption.backgroundClassName} ${selectedColorOption.foregroundClassName} ${selectedColorOption.borderClassName}`
                  : "border-transparent text-white"
              }`}
              style={selectedColor === "custom" ? { backgroundColor: customColor } : undefined}
            >
              <PreviewIcon aria-hidden="true" className="size-8" strokeWidth={1.7} />
            </div>
            <p className="mt-3 text-sm font-semibold">{name.trim() || "Your category"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Preview</p>
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <label htmlFor="category-name" className="text-sm font-semibold">
                Category name
              </label>
              <input
                id="category-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Subscriptions"
                maxLength={32}
                className="mt-2 h-12 w-full rounded-[10px] border border-input bg-background px-4 text-[15px] outline-none transition-colors placeholder:text-foreground-subtle focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>

            <fieldset>
              <legend className="sr-only">Choose an icon</legend>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Choose an icon</p>
                <button
                  type="button"
                  onClick={() => setIconPickerOpen(true)}
                  className="min-h-8 rounded-md px-1 text-xs font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                >
                  Show more icons
                </button>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {quickIconOptions.map((option, index) => {
                  const Icon = option.icon;
                  const isSelected = selectedIcon === index;

                  return (
                    <button
                      type="button"
                      key={option.label}
                      aria-label={option.label}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedIcon(index)}
                      className={`flex h-[58px] flex-col items-center justify-center gap-1.5 rounded-[10px] border text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                        isSelected
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-background hover:border-primary/30 hover:bg-surface-subtle"
                      }`}
                    >
                      <Icon aria-hidden="true" className="size-[19px]" strokeWidth={1.8} />
                      <span className="text-[10px] font-medium">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="text-sm font-semibold">Choose a color</legend>
              <div className="mt-3 min-w-0 max-w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max min-w-max flex-nowrap gap-3 pb-1">
                  {colorOptions.map((option, index) => {
                    const isSelected = selectedColor === index;

                    return (
                      <button
                        type="button"
                        key={option.name}
                        aria-label={option.name}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedColor(index)}
                        className={`flex size-11 shrink-0 snap-start items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 ${option.backgroundClassName} ${option.foregroundClassName} ${option.borderClassName}`}
                      >
                        {isSelected ? (
                          <Check
                            aria-hidden="true"
                            className="size-4"
                            strokeWidth={2.5}
                          />
                        ) : null}
                      </button>
                    );
                  })}
                  <label className={`relative flex size-11 shrink-0 snap-start cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed bg-background text-muted-foreground transition-colors hover:bg-surface-subtle focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/35 focus-within:ring-offset-2 ${selectedColor === "custom" ? "border-primary" : "border-border-strong"}`}>
                    {selectedColor === "custom" ? (
                      <span className="absolute inset-1 rounded-full" style={{ backgroundColor: customColor }} />
                    ) : null}
                    <Palette aria-hidden="true" className="relative z-10 size-4" />
                    <span className="sr-only">Choose a custom color</span>
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
              <p className="mt-1 text-xs text-muted-foreground">Swipe to see more colors</p>
            </fieldset>
          </div>
        </section>

        {!isNew ? (
          <section className="mt-8 border-t border-border pt-6">
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[11px] border border-expense/25 bg-expense-soft px-4 text-sm font-semibold text-expense transition-colors hover:border-expense/45 focus-visible:outline-none focus-visible:ring-2 focus-visible/30"
            >
              <Trash2 aria-hidden="true" className="size-[18px]" />
              Delete category
            </button>
            <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">
              Existing transactions will keep their history.
            </p>
          </section>
        ) : null}
      </div>

      {iconPickerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="icon-picker-title"
          className="fixed inset-0 z-50 h-dvh overflow-y-auto bg-background animate-in fade-in-0 slide-in-from-bottom-3"
        >
          <div className="mx-auto min-h-full w-full max-w-[560px] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-5">
            <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between border-b border-border bg-background/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:-mx-5 sm:px-5 sm:pt-8">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Category appearance
                </p>
                <h2
                  id="icon-picker-title"
                  className="mt-0.5 text-[24px] font-semibold tracking-[-0.04em]"
                >
                  Choose an icon
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close icon picker"
                onClick={() => setIconPickerOpen(false)}
                className="flex size-11 items-center justify-center rounded-[11px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </header>

            <p className="mt-6 text-sm leading-6 text-muted-foreground">
              Pick the symbol that will make this category easiest to recognize.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2.5 min-[360px]:grid-cols-4">
              {iconOptions.map((option, index) => {
                const Icon = option.icon;
                const isSelected = selectedIcon === index;

                return (
                  <button
                    type="button"
                    key={option.label}
                    aria-label={option.label}
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedIcon(index);
                      setIconPickerOpen(false);
                    }}
                    className={`relative flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-[12px] border px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                      isSelected
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-surface-subtle hover:text-foreground"
                    }`}
                  >
                    <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
                    <span className="max-w-full truncate text-[10px] font-medium">
                      {option.label}
                    </span>
                    {isSelected ? (
                      <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check aria-hidden="true" className="size-2.5" strokeWidth={2.5} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
