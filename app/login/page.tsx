import Image from "next/image";
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { StickyPageHeader } from "@/components/layout/sticky-page-header";

export default function LoginPage() {
  return (
    <main className="page-route-enter h-dvh overflow-hidden bg-white text-foreground">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[520px] flex-col px-5 pb-5 sm:px-8">
        <StickyPageHeader className="-mx-5 w-[calc(100%+2.5rem)] shrink-0 flex items-center justify-between bg-white px-5 pb-3 sm:-mx-8 sm:w-[calc(100%+4rem)] sm:px-8 sm:pt-8">
          <Link
            href="/"
            aria-label="Go to Luna home"
            className="flex items-center gap-2 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <Image
              src="/icon-192.png"
              alt=""
              width={36}
              height={36}
              className="size-9 rounded-[10px] shadow-[0_4px_10px_rgb(53_107_104_/_0.16)]"
            />
            <span className="text-[15px] font-bold tracking-[-0.02em]">Luna</span>
          </Link>
        </StickyPageHeader>

        <section className="flex min-h-0 flex-1 flex-col justify-start overflow-hidden py-3 sm:justify-center sm:py-8">
          <div className="relative mx-auto w-full max-w-[320px]">
            <Image
              src="/budget-login-illustration-crop.png"
              alt="Wallet, coins, receipts, and other objects representing everyday budgeting"
              width={864}
              height={1200}
              priority
              className="h-auto max-h-[18vh] w-full object-contain min-[390px]:max-h-[20vh] sm:max-h-[300px]"
            />
          </div>

          <div className="mx-auto w-full max-w-[390px] text-center">
            <h1
              className="mt-1 text-[36px] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-[48px]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Welcome back
            </h1>
            <p className="mx-auto mt-2 max-w-[300px] text-[14px] leading-5 text-muted-foreground">
              A calmer way to keep every rupee in view.
            </p>

            <LoginForm />
          </div>
        </section>

        <footer className="mx-auto max-w-[390px] shrink-0 text-center text-[11px] leading-5 text-foreground-subtle">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="font-semibold text-primary hover:text-primary-hover">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold text-primary hover:text-primary-hover">
            Privacy Policy
          </Link>
          .
        </footer>
      </div>
    </main>
  );
}
