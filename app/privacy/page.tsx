import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Luna",
  description: "How Luna collects, uses, and protects your information.",
};

export default function PrivacyPage() {
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
        <h1 className="mt-2 text-[36px] font-semibold tracking-[-0.05em] sm:text-[48px]">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: August 2, 2026</p>

        <div className="mt-10 space-y-8 text-[15px] leading-7 text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Who we are</h2>
            <p className="mt-2">Luna is a digital personal-finance and budgeting service operated from Nepal. This Privacy Policy explains how we handle information when you use Luna, including its website, progressive web app, and related services. It applies to users internationally, subject to mandatory rights in your place of residence.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Information we collect</h2>
            <p className="mt-2">We collect information you choose to provide, such as your email address, name, profile details, accounts, categories, budgets, goals, and transaction records. We also receive technical and security information such as device and browser details, approximate network information, session tokens, log records, and account activity. If you contact support, we collect the information in your message.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Local-first storage</h2>
            <p className="mt-2">Luna is designed to work locally first. A copy of some information may be stored in your browser or on your device so you can use the app offline. When sync is enabled, information is sent to our remote services so it can be backed up and available across supported sessions. Information that has not synced may not be recoverable after browser data is cleared, the app is removed, or the device is lost.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. How we use information</h2>
            <p className="mt-2">We use information to provide and personalize Luna; sync and protect your data; authenticate accounts; respond to support requests; troubleshoot, measure, and improve the Service; prevent abuse and fraud; send essential service messages; and comply with legal obligations. We do not sell your personal information.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. When we share information</h2>
            <p className="mt-2">We may share information with service providers that host infrastructure, send email, provide security, or help us operate Luna, under instructions and confidentiality obligations. We may also disclose information when required by law, to protect rights and safety, to investigate abuse, or as part of a merger, financing, or transfer of the Service. We do not share your financial records with advertisers for their own marketing.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. International processing</h2>
            <p className="mt-2">Luna is operated from Nepal, and our providers or infrastructure may process information in Nepal or other countries. Those countries may have different data-protection rules than your home country. Where required, we use appropriate contractual, technical, or other safeguards for international transfers.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Retention and deletion</h2>
            <p className="mt-2">We keep information for as long as needed to provide the Service, maintain security and business records, resolve disputes, and meet legal requirements. You may request access, correction, export, or deletion of your account information through the controls available in Luna or by contacting support. Deletion may not remove information we must retain by law, and device-local copies may require you to clear the app’s local storage.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Your choices and rights</h2>
            <p className="mt-2">Depending on where you live, you may have rights to access, correct, delete, restrict, object to, or receive a portable copy of your personal information, and to withdraw consent where processing is based on consent. You may also complain to your local data-protection authority. We will verify requests as reasonably necessary to protect your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Security</h2>
            <p className="mt-2">We use reasonable administrative, technical, and organizational measures to protect information. No internet transmission or storage system is completely secure, so keep your device and credentials protected and notify us if you suspect unauthorized access.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Cookies and similar technologies</h2>
            <p className="mt-2">Luna uses browser storage, cookies, and similar technologies where needed for authentication, offline operation, preferences, security, and basic service measurement. Blocking these technologies can prevent some features from working. We do not use them to sell your financial information.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Children and policy changes</h2>
            <p className="mt-2">Luna is not intended for children under 18, and we do not knowingly collect their information. We may update this Policy as our practices or legal obligations change. We will post the revised version and update the date above; where required, we will provide additional notice.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">12. Contact us</h2>
            <p className="mt-2">For privacy questions or requests, use the support contact published in the Luna app or website. Please include enough information for us to identify your account and understand your request.</p>
          </section>
        </div>

        <p className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
          See also our <Link href="/terms" className="font-semibold text-primary hover:text-primary-hover">Terms of Service</Link>.
        </p>
      </article>
    </main>
  );
}
