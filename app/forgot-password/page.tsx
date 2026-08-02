import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

function safeBackPath(value: string | string[] | undefined) {
  const path = Array.isArray(value) ? value[0] : value;
  return path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/api/") ? path : "/login";
}

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const { returnTo: requestedReturnTo } = await searchParams;
  const returnTo = safeBackPath(requestedReturnTo);
  return <main className="page-route-enter min-h-screen bg-background"><div className="mx-auto w-full max-w-[460px] px-5 py-8"><Link href={returnTo} aria-label="Go back" className="flex size-11 items-center justify-center rounded-[10px] border border-border bg-card text-foreground"><ArrowLeft aria-hidden="true" className="size-5" /></Link><div className="mt-12 flex size-14 items-center justify-center rounded-[14px] bg-primary text-primary-foreground"><KeyRound aria-hidden="true" className="size-7" /></div><h1 className="mt-5 text-[30px] font-semibold tracking-[-0.04em]">Forgot your password?</h1><p className="mt-2 text-sm text-muted-foreground">{returnTo === "/profile" ? "We’ll send a secure reset link to your signed-in Luna account." : "Enter your email and we’ll send a secure reset link."}</p><ForgotPasswordForm returnTo={returnTo} accountOnly={returnTo === "/profile"} /></div></main>;
}
