import { AuthenticatedImage } from "@/components/ui/authenticated-image";
import { getSavingsIconSource } from "@/lib/savings-appearance";

export function LoadingBlock({ className }: { className: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-[10px] bg-surface-subtle ${className}`} />;
}

export function SavingsInstrumentAvatar({ icon }: { icon?: string | null }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[9px] border border-primary/10 bg-primary-soft">
      <AuthenticatedImage
        src={getSavingsIconSource(icon)}
        alt=""
        width={36}
        height={36}
        className="size-full object-cover"
        unoptimized
      />
    </span>
  );
}
