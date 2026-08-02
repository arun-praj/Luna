import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";

export default function ResetPasswordPage() {
  return <main className="page-route-enter min-h-screen bg-background"><div className="mx-auto w-full max-w-[460px] px-5 py-8"><Link href="/login" aria-label="Back to login" className="flex size-11 items-center justify-center rounded-[10px] border border-border bg-card text-foreground"><ArrowLeft aria-hidden="true" className="size-5" /></Link><div className="mt-12 flex size-14 items-center justify-center rounded-[14px] bg-primary text-primary-foreground"><KeyRound aria-hidden="true" className="size-7" /></div><h1 className="mt-5 text-[30px] font-semibold tracking-[-0.04em]">Set a new password</h1><p className="mt-2 text-sm text-muted-foreground">Choose a new password for your Luna account.</p><ResetPasswordForm /></div></main>;
}
