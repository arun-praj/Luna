import { accountImages } from "@/lib/account-images";

export const savingsImageOptions = [
  { name: "Growth", src: accountImages.savings },
  { name: "Bank", src: accountImages.primary },
  { name: "Digital", src: accountImages.esewa },
  { name: "Everyday", src: accountImages.cash },
] as const;

export const savingsColorOptions = [
  { name: "Sage", backgroundColor: "#e3eee9", cardClassName: "border-[#c7dbd2] bg-[#e3eee9]", accentClassName: "text-primary" },
  { name: "Sky", backgroundColor: "#e3eff6", cardClassName: "border-[#cadde9] bg-[#e3eff6]", accentClassName: "text-info" },
  { name: "Lavender", backgroundColor: "#ece6f3", cardClassName: "border-[#d8cee7] bg-[#ece6f3]", accentClassName: "text-[#735b8f]" },
  { name: "Sand", backgroundColor: "#f3e8d4", cardClassName: "border-[#e3d2b6] bg-[#f3e8d4]", accentClassName: "text-warning" },
  { name: "Mint", backgroundColor: "#e5f3eb", cardClassName: "border-[#c7dbd2] bg-[#e5f3eb]", accentClassName: "text-income" },
  { name: "Blush", backgroundColor: "#f8e9e6", cardClassName: "border-[#e6c9c4] bg-[#f8e9e6]", accentClassName: "text-expense" },
  { name: "Peach", backgroundColor: "#fbe8dc", cardClassName: "border-[#efd0bf] bg-[#fbe8dc]", accentClassName: "text-[#b55d35]" },
  { name: "Lemon", backgroundColor: "#f7f0c9", cardClassName: "border-[#e9dda1] bg-[#f7f0c9]", accentClassName: "text-[#9b7b16]" },
  { name: "Seafoam", backgroundColor: "#dff1ed", cardClassName: "border-[#c2dfd9] bg-[#dff1ed]", accentClassName: "text-[#277b72]" },
  { name: "Periwinkle", backgroundColor: "#e5e9f8", cardClassName: "border-[#cbd3ef] bg-[#e5e9f8]", accentClassName: "text-[#5368a5]" },
  { name: "Mauve", backgroundColor: "#f0e3ec", cardClassName: "border-[#dfc9da] bg-[#f0e3ec]", accentClassName: "text-[#905c80]" },
  { name: "Stone", backgroundColor: "#ebe9e3", cardClassName: "border-[#d8d5cb] bg-[#ebe9e3]", accentClassName: "text-[#706e65]" },
] as const;

export function getSavingsIconSource(icon: string | null | undefined) {
  if (icon?.startsWith("/api/uploads/") || icon?.startsWith("data:image/")) return icon;
  return savingsImageOptions.find((option) => option.name === icon)?.src ?? savingsImageOptions[0].src;
}

export function getSavingsColor(backgroundColor: string | null | undefined) {
  return savingsColorOptions.find((option) => option.backgroundColor.toLowerCase() === backgroundColor?.toLowerCase()) ?? savingsColorOptions[0];
}
