import { getAccountBackgroundColor, getAccountForeground } from "@/lib/account-appearance";
import { getAccountImageSource } from "@/lib/account-images";
import { AuthenticatedImage } from "@/components/ui/authenticated-image";

function initialsFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : words[0]?.slice(0, 2) || "?").toUpperCase();
}

export function AccountAvatar({
  icon,
  name,
  type,
  backgroundColor,
  size = 44,
}: {
  icon: string | null | undefined;
  name: string;
  type?: string | null;
  backgroundColor?: string | null;
  size?: number;
}) {
  const background = getAccountBackgroundColor(backgroundColor, type);
  const source = getAccountImageSource(icon);
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[inherit] font-bold tracking-[0.04em]"
      style={{ width: size, height: size, backgroundColor: background, color: getAccountForeground(background, type), fontSize: Math.max(10, Math.round(size * 0.28)) }}
    >
      {source ? <AuthenticatedImage src={source} alt="" aria-hidden="true" width={size} height={size} className="block size-full object-cover" unoptimized /> : initialsFor(name)}
    </span>
  );
}
