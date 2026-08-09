"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  ShoppingBasket,
  ShoppingCart,
  Sprout,
  Smartphone,
  Trash2,
  Utensils,
  WalletCards,
  Wifi,
  Wrench,
  X,
} from "lucide-react";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";
import { authenticatedFetch } from "@/lib/auth-client";
import { navigateWithRouteExit } from "@/lib/route-motion";
import { getReturnTo } from "@/lib/navigation";
import { useAnimatedVisibility } from "@/lib/use-animated-visibility";
import { useUnsavedChangesGuard } from "@/components/ui/unsaved-changes-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const iconOptions = [
  { label: "Home", icon: House },
  { label: "Food", icon: Utensils },
  { label: "Shopping", icon: ShoppingBag },
  { label: "Travel", icon: CarFront },
  { label: "Health", icon: HeartPulse },
  { label: "Gifts", icon: Gift },
  { label: "Work", icon: BriefcaseBusiness },
  { label: "Wallet", icon: WalletCards },
  { label: "Plants", icon: Sprout },
  { label: "Online Shopping", icon: ShoppingBag },
  { label: "Shopping Cart", icon: ShoppingCart },
  { label: "Groceries", icon: ShoppingBasket },
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
    hex: "#e3eee9",
    backgroundClassName: "bg-[#e3eee9]",
    foregroundClassName: "text-primary",
    borderClassName: "border-[#c7dbd2]",
  },
  {
    name: "Sky",
    hex: "#e3eff6",
    backgroundClassName: "bg-[#e3eff6]",
    foregroundClassName: "text-info",
    borderClassName: "border-[#cadde9]",
  },
  {
    name: "Mint",
    hex: "#e5f3eb",
    backgroundClassName: "bg-[#e5f3eb]",
    foregroundClassName: "text-income",
    borderClassName: "border-[#c7dbd2]",
  },
  {
    name: "Sand",
    hex: "#f3e8d4",
    backgroundClassName: "bg-[#f3e8d4]",
    foregroundClassName: "text-warning",
    borderClassName: "border-[#e3d2b6]",
  },
  {
    name: "Blush",
    hex: "#f8e9e6",
    backgroundClassName: "bg-[#f8e9e6]",
    foregroundClassName: "text-expense",
    borderClassName: "border-[#e6c9c4]",
  },
  {
    name: "Lavender",
    hex: "#ece6f3",
    backgroundClassName: "bg-[#ece6f3]",
    foregroundClassName: "text-[#735b8f]",
    borderClassName: "border-[#d8cee7]",
  },
  {
    name: "Peach",
    hex: "#fbe8dc",
    backgroundClassName: "bg-[#fbe8dc]",
    foregroundClassName: "text-[#b55d35]",
    borderClassName: "border-[#efd0bf]",
  },
  {
    name: "Lemon",
    hex: "#f7f0c9",
    backgroundClassName: "bg-[#f7f0c9]",
    foregroundClassName: "text-[#9b7b16]",
    borderClassName: "border-[#e9dda1]",
  },
  {
    name: "Lime",
    hex: "#e8f1d9",
    backgroundClassName: "bg-[#e8f1d9]",
    foregroundClassName: "text-[#648735]",
    borderClassName: "border-[#cfdfb4]",
  },
  {
    name: "Seafoam",
    hex: "#dff1ed",
    backgroundClassName: "bg-[#dff1ed]",
    foregroundClassName: "text-[#277b72]",
    borderClassName: "border-[#c2dfd9]",
  },
  {
    name: "Periwinkle",
    hex: "#e5e9f8",
    backgroundClassName: "bg-[#e5e9f8]",
    foregroundClassName: "text-[#5368a5]",
    borderClassName: "border-[#cbd3ef]",
  },
  {
    name: "Mauve",
    hex: "#f0e3ec",
    backgroundClassName: "bg-[#f0e3ec]",
    foregroundClassName: "text-[#905c80]",
    borderClassName: "border-[#dfc9da]",
  },
  {
    name: "Stone",
    hex: "#ebe9e3",
    backgroundClassName: "bg-[#ebe9e3]",
    foregroundClassName: "text-[#706e65]",
    borderClassName: "border-[#d8d5cb]",
  },
  {
    name: "Denim",
    hex: "#dfeaf3",
    backgroundClassName: "bg-[#dfeaf3]",
    foregroundClassName: "text-[#4d7596]",
    borderClassName: "border-[#c6d9e8]",
  },
];

export type CategoryEditorData = {
  id: string;
  name: string;
  type?: "expense" | "income";
  icon?: string | null;
  color?: string | null;
  iconIndex?: number;
  colorIndex?: number;
};

export function CategoryEditor({
  category,
  categoryId,
}: {
  category?: CategoryEditorData;
  categoryId?: string;
}) {
  const router = useRouter();
  const isNew = !category && !categoryId;
  const [backHref, setBackHref] = useState("/categories");
  const [loadedCategory, setLoadedCategory] = useState(category);
  const [name, setName] = useState(category?.name ?? "");
  const [type, setType] = useState<"expense" | "income">(category?.type ?? "expense");
  const [selectedIcon, setSelectedIcon] = useState(category?.iconIndex ?? (category?.icon ? Math.max(0, iconOptions.findIndex((option) => option.label === category.icon)) : 0));
  const [selectedColor, setSelectedColor] = useState<number | "custom">(
    category?.colorIndex ?? (category?.color ? Math.max(0, colorOptions.findIndex((option) => option.hex === category.color)) : 0),
  );
  const [customColor, setCustomColor] = useState(category?.color && !colorOptions.some((option) => option.hex === category.color) ? category.color : "#356b68");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const iconPickerTransition = useAnimatedVisibility(iconPickerOpen);
  const [isLoading, setIsLoading] = useState(Boolean(categoryId && !category));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState("");
  const [initialDraft, setInitialDraft] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setBackHref(getReturnTo("/categories"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const PreviewIcon = iconOptions[selectedIcon].icon;
  const selectedColorOption = selectedColor === "custom" ? null : colorOptions[selectedColor];

  const draftSnapshot = JSON.stringify({ name, type, selectedIcon, selectedColor, customColor });
  const { requestDiscard, discardDialog } = useUnsavedChangesGuard(initialDraft !== null && draftSnapshot !== initialDraft);

  useEffect(() => {
    if (isLoading || initialDraft !== null) return;
    const frame = window.requestAnimationFrame(() => setInitialDraft(draftSnapshot));
    return () => window.cancelAnimationFrame(frame);
  }, [draftSnapshot, isLoading, initialDraft]);

  useEffect(() => {
    if (!categoryId || category) return;
    void authenticatedFetch(`/api/categories/${categoryId}`).then(async (response) => {
      if (!response.ok) throw new Error("Category not found.");
      const result = await response.json() as { category: CategoryEditorData };
      const loaded = result.category;
      setLoadedCategory(loaded);
      setName(loaded.name);
      setType(loaded.type ?? "expense");
      setSelectedIcon(loaded.icon ? Math.max(0, iconOptions.findIndex((option) => option.label === loaded.icon)) : 0);
      const colorIndex = loaded.color ? colorOptions.findIndex((option) => option.hex === loaded.color) : 0;
      setSelectedColor(colorIndex >= 0 ? colorIndex : "custom");
      if (loaded.color && colorIndex < 0) setCustomColor(loaded.color);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load category.")).finally(() => setIsLoading(false));
  }, [category, categoryId]);

  async function saveCategory() {
    if (!name.trim()) return;
    setIsSaving(true); setError("");
    const color = selectedColor === "custom" ? customColor : colorOptions[selectedColor].hex;
    const payload = { name: name.trim(), type, icon: iconOptions[selectedIcon].label, color };
    const response = await authenticatedFetch(isNew ? "/api/categories" : `/api/categories/${loadedCategory?.id ?? categoryId}`, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    if (response?.ok) navigateWithRouteExit(() => router.push(backHref));
    else { const result = await response?.json().catch(() => null) as { error?: string } | null; setError(result?.error ?? "Could not save category."); }
    setIsSaving(false);
  }

  async function deleteCategory() {
    const id = loadedCategory?.id ?? categoryId;
    if (!id) return;
    setIsDeleting(true); setError("");
    const response = await authenticatedFetch(`/api/categories/${id}`, { method: "DELETE" }).catch(() => null);
    if (response?.ok) {
      setDeleteOpen(false);
      navigateWithRouteExit(() => router.push(backHref));
    }
    else { const result = await response?.json().catch(() => null) as { error?: string } | null; setError(result?.error ?? "Could not delete category."); }
    setIsDeleting(false);
  }

  return (
    <main className="page-route-enter min-h-dvh overflow-x-clip bg-background">
      <div className="mx-auto w-full max-w-[560px] px-4 pb-12 sm:px-5">
        <StickyPageHeader className="-mx-4 grid grid-cols-[44px_1fr_44px] items-center gap-3 px-4 pb-3 sm:-mx-5 sm:px-5">
          <Link
            href={backHref}
            aria-label={isNew ? "Cancel new category" : "Cancel editing category"}
            onClick={(event) => {
              event.preventDefault();
              requestDiscard(() => navigateWithRouteExit(() => router.push(backHref)));
            }}
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
            onClick={() => void saveCategory()}
            disabled={!name.trim() || isSaving || isLoading}
            className="flex size-11 items-center justify-center rounded-[11px] border border-primary/20 bg-primary-soft text-primary transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:pointer-events-none disabled:border-border disabled:bg-surface-subtle disabled:text-foreground-subtle"
          >
            <Check aria-hidden="true" className="size-5" />
          </button>
        </StickyPageHeader>

        {error ? <p role="alert" className="mt-4 rounded-[10px] border border-expense/25 bg-expense-soft px-3 py-2 text-sm text-expense">{error}</p> : null}
        {isLoading ? <div className="mt-8 flex min-h-60 items-center justify-center text-sm text-muted-foreground">Loading category…</div> : null}

        {!isLoading ? <section className="mt-8 min-w-0 overflow-hidden rounded-[18px] border border-border bg-card p-4 min-[390px]:p-5 sm:p-6">
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
              <legend className="text-sm font-semibold">Category type</legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["expense", "income"] as const).map((option) => <button key={option} type="button" aria-pressed={type === option} onClick={() => setType(option)} className={`min-h-11 rounded-[10px] border text-sm font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${type === option ? "border-primary bg-primary-soft text-primary" : "border-border bg-background text-muted-foreground hover:bg-surface-subtle"}`}>{option}</button>)}
              </div>
            </fieldset>

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
        </section> : null}

        {!isNew ? (
          <section className="mt-8 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={isDeleting || isLoading}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[11px] border border-expense/25 bg-expense-soft px-4 text-sm font-semibold text-expense transition-colors hover:border-expense/45 focus-visible:outline-none focus-visible:ring-2 focus-visible/30 disabled:opacity-60"
            >
              <Trash2 aria-hidden="true" className="size-[18px]" />
              {isDeleting ? "Deleting…" : "Delete category"}
            </button>
            <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">
              Existing transactions will keep their history.
            </p>
          </section>
        ) : null}
        <ConfirmDialog
          open={deleteOpen}
          title="Delete category?"
          description="Existing transactions will keep their history, but this category will no longer be available for new entries."
          confirmLabel="Delete category"
          destructive
          busy={isDeleting}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={deleteCategory}
        />
      </div>

      {iconPickerTransition.mounted ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="icon-picker-title"
          className={`fixed inset-0 z-50 h-dvh overflow-y-auto bg-background ${iconPickerTransition.closing ? "drawer-exit" : "drawer-enter"}`}
        >
          <div className="mx-auto min-h-full w-full max-w-[560px] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-5">
            <StickyPageHeader className="-mx-4 !z-10 flex items-center justify-between px-4 pb-3 sm:-mx-5 sm:px-5">
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
            </StickyPageHeader>

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
      {discardDialog}
    </main>
  );
}
