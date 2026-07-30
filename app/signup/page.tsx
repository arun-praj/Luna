import Image from "next/image";
import Link from "next/link";
import { WalletCards } from "lucide-react";

import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <main className="min-h-dvh bg-white text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5 pb-5 pt-5 sm:px-8 sm:pt-8">
        <header className="flex items-center">
          <Link href="/" aria-label="Go to Budget home" className="flex items-center gap-2 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-[0_4px_10px_rgb(53_107_104_/_0.16)]">
              <WalletCards aria-hidden="true" className="size-[19px]" strokeWidth={2.2} />
            </span>
            <span className="text-[15px] font-bold tracking-[-0.02em]">Budget</span>
          </Link>
        </header>
        <section className="flex flex-1 flex-col justify-start py-4 sm:justify-center sm:py-10">
          <div className="relative mx-auto w-full max-w-[370px]">
            <Image src="/budget-login-illustration-crop.png" alt="Wallet, coins, receipts, and other objects representing everyday budgeting" width={864} height={1200} priority className="h-auto max-h-[27vh] w-full object-contain sm:max-h-[360px]" />
          </div>
          <div className="mx-auto w-full max-w-[390px] text-center">
            <h1 className="mt-1 text-[36px] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-[48px]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>Start with clarity</h1>
            <p className="mx-auto mt-2 max-w-[300px] text-[14px] leading-5 text-muted-foreground">Set up a simple home for your money.</p>
            <SignupForm />
          </div>
        </section>
        <footer className="mx-auto max-w-[390px] text-center text-[11px] leading-5 text-foreground-subtle">
          By creating an account, you agree to our{" "}
          <Link href="#terms" className="font-semibold text-primary hover:text-primary-hover">Terms</Link>{" "}
          and{" "}
          <Link href="#privacy" className="font-semibold text-primary hover:text-primary-hover">Privacy Policy</Link>.
        </footer>
      </div>
    </main>
  );
}
