import { MailCheck } from "lucide-react";
import { BackToLoginButton, EmailVerificationForm } from "@/components/auth/email-verification-form";

export default function VerifyEmailPage() {
  return <main className="page-route-enter min-h-screen bg-background"><div className="mx-auto w-full max-w-[460px] px-5 py-8"><BackToLoginButton /><div className="mt-12 flex size-14 items-center justify-center rounded-[14px] bg-primary-soft text-primary"><MailCheck aria-hidden="true" className="size-7" /></div><h1 className="mt-5 text-[30px] font-semibold tracking-[-0.04em]">Verify your email</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">We sent a six-digit code to your inbox. Verify it to keep your Luna account secure.</p><EmailVerificationForm /></div></main>;
}
