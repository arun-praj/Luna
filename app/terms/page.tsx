import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service — Luna",
  description: "The terms that apply when you use Luna.",
};

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <article className="mx-auto w-full max-w-[720px] px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/login"
          aria-label="Back to login"
          className="flex size-11 items-center justify-center rounded-[10px] border border-border bg-card text-foreground transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>

        <p className="mt-10 text-sm font-semibold text-primary">Luna</p>
        <h1 className="mt-2 text-[36px] font-semibold tracking-[-0.05em] sm:text-[48px]">Terms of Service</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: August 2, 2026</p>

        <div className="mt-10 space-y-8 text-[15px] leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. About Luna</h2>
            <p className="mt-2">Luna is a digital personal-finance and budgeting service operated from Nepal. These Terms govern your access to and use of the Luna website, progressive web app, and related services (collectively, the “Service”). By creating an account or using the Service, you agree to these Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Eligibility and your account</h2>
            <p className="mt-2">You must be legally able to enter into these Terms in your place of residence. Luna is intended for adults and is not directed to children under 18. You are responsible for providing accurate information, keeping your sign-in credentials private, and all activity performed through your account. Tell us promptly if you believe your account has been accessed without permission.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. What Luna does—and does not do</h2>
            <p className="mt-2">Luna helps you record, organize, and understand your own financial information. It is not a bank, payment service, lender, investment adviser, tax adviser, or insurance provider. We do not execute transactions or guarantee that any budget, calculation, reminder, or insight is complete or accurate. Check important financial decisions with a qualified professional.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Acceptable use</h2>
            <p className="mt-2">You may use the Service only for lawful personal or internal purposes. Do not misuse the Service, attempt to gain unauthorized access, interfere with its operation, upload malicious code, scrape it, reverse engineer it except where applicable law permits, or use it to violate another person’s rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Your content</h2>
            <p className="mt-2">You retain ownership of the information you enter into Luna. You give us the limited permissions needed to host, sync, secure, back up, and display that information so we can provide the Service. You are responsible for having the right to submit it and for keeping an independent copy of important records.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Local-first use and availability</h2>
            <p className="mt-2">Some Luna data may be stored on your device so the Service can work offline and sync later. Unsynced changes can be lost if you clear browser storage, uninstall the app, lose the device, or use a different browser. The Service may change, be interrupted, or become unavailable, including for maintenance, security, or events outside our reasonable control.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Intellectual property</h2>
            <p className="mt-2">The Service, including its software, design, name, and branding, belongs to Luna or its licensors and is protected by applicable law. These Terms give you a limited, revocable, non-transferable right to use the Service; they do not transfer ownership to you.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Suspension and termination</h2>
            <p className="mt-2">You may stop using Luna and request account deletion at any time. We may suspend or terminate access when reasonably necessary to protect the Service, users, or third parties, to comply with law, or when you materially breach these Terms. Provisions that should continue by their nature will survive termination.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Disclaimers and liability</h2>
            <p className="mt-2">To the extent permitted by law, the Service is provided “as is” and “as available,” without warranties that it will be uninterrupted, error-free, or suitable for a particular financial outcome. To the extent permitted by applicable law, Luna will not be liable for indirect, incidental, special, consequential, or lost-profit losses arising from your use of the Service. Nothing in these Terms excludes liability that cannot legally be excluded, including liability for fraud or intentional misconduct.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Governing law and international users</h2>
            <p className="mt-2">These Terms are governed by the laws of Nepal, without regard to conflict-of-law rules. Courts in Nepal will have jurisdiction, subject to any mandatory consumer protections or dispute rights that apply where you live. Luna is based in Nepal and may be used by consumers internationally; you are responsible for complying with local laws when using it.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Changes and contact</h2>
            <p className="mt-2">We may update these Terms when the Service or law changes. We will post the updated version and change the date above. If a change materially affects your rights, we will provide additional notice where appropriate. For questions or legal notices, use the support contact published in the Luna app or website.</p>
          </section>
        </div>

        <p className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
          See also our <Link href="/privacy" className="font-semibold text-primary hover:text-primary-hover">Privacy Policy</Link>.
        </p>
      </article>
    </main>
  );
}
