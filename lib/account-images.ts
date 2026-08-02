import { createAvatar } from "@dicebear/core";
import { shapes } from "@dicebear/collection";

function createAccountImage(seed: string, backgroundColor: string) {
  return createAvatar(shapes, {
    seed,
    backgroundColor: [backgroundColor],
    radius: 22,
    size: 96,
  }).toDataUri();
}

export function getAccountImageSource(
  icon: string | null | undefined,
) {
  if (icon?.startsWith("/api/") || icon?.startsWith("data:image/")) return icon;
  if (icon?.startsWith("dicebear:fun-emoji:") || icon === "WalletCards") return null;
  if (icon === "Digital") return accountImages.esewa;
  if (icon === "Growth") return accountImages.savings;
  if (icon === "Everyday") return accountImages.cash;
  if (icon === "Bank") return accountImages.primary;
  return null;
}

export const accountImages = {
  primary: createAccountImage("Primary bank vault", "dcece7"),
  esewa: createAccountImage("Digital wallet mobile", "dcebf5"),
  savings: createAccountImage("Savings growth", "e8e2f3"),
  cash: createAccountImage("Everyday cash", "f5e9d2"),
};
