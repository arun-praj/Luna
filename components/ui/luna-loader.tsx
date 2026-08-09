import Image from "next/image";

export function LunaLoader({ label = "Preparing Luna" }: { label?: string }) {
  return (
    <main
      className="grid min-h-dvh place-items-center bg-background px-5"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex flex-col items-center">
        <div className="relative flex size-24 items-end justify-center">
          <span aria-hidden="true" className="luna-loader-shadow absolute bottom-2 h-2 w-12 rounded-full bg-primary/15" />
          <Image
            src="/luna-loader-pet.png"
            alt=""
            width={96}
            height={96}
            priority
            className="luna-loader-pet relative size-24 object-contain"
          />
        </div>
        <span className="sr-only">{label}</span>
      </div>
    </main>
  );
}
