import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Cookie Policy" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Cookie Policy</h1>
      <p className="mt-2 text-xs text-muted">Last updated: November 2026</p>
      <div className="prose max-w-none mt-8 space-y-5 text-sm leading-relaxed text-muted">
        <p>
          QASyn uses the minimum cookies required to operate a secure workspace. We do not use advertising,
          cross-site tracking, or third-party analytics cookies.
        </p>
        <p>
          <strong>Essential cookies.</strong> The <code>qasyn_org</code> cookie stores your authenticated session for up
          to 30 days. It is HTTP-only, SameSite-protected, and marked Secure when served over HTTPS. It is required to
          keep you signed in and to route requests to the correct organisation.
        </p>
        <p>
          <strong>Preferences.</strong> Interface preferences are stored in your session or workspace profile rather
          than in browser cookies. No cookie is used to build a cross-site profile.
        </p>
        <p>
          <strong>Managing cookies.</strong> You can block or delete cookies in your browser settings. Blocking the
          session cookie prevents sign-in, and deleting it signs you out. Clearing workspace data is available from
          Settings › Organisation.
        </p>
        <p>
          <strong>Contact.</strong> Questions about cookies or privacy: <a className="text-brand-600 hover:underline" href="mailto:info@qasyn.io">info@qasyn.io</a> or <Link className="text-brand-600 hover:underline" href="/contact-us">contact us</Link>.
        </p>
      </div>
    </div>
  );
}
