import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Privacy Policy</h1>
      <p className="mt-2 text-xs text-muted">Last updated: November 2026</p>
      <div className="prose max-w-none mt-8 space-y-5 text-sm leading-relaxed text-muted">
        <p>
          QASyn collects only the information needed to provide, secure, and support the Service. This policy explains
          what we collect, why we collect it, and the choices available to you.
        </p>
        <p>
          <strong>Information we collect.</strong> Account details (name, work email, organisation, role), workspace
          content you create (test cases, runs, reports, requirements, and integration configuration), usage telemetry
          (feature usage, credit consumption, and diagnostic events), and communications you send to our team.
        </p>
        <p>
          <strong>How we use information.</strong> To operate the Service, authenticate users, enforce tenant
          isolation, measure reliability, prevent abuse, provide support, and meet legal obligations. We do not sell
          personal information or use customer workspace content to train shared models without explicit consent.
        </p>
        <p>
          <strong>Storage and security.</strong> Data is encrypted in transit. Test credentials and integration secrets
          are encrypted at rest with AES-256-GCM, API tokens are stored as SHA-256 hashes, and organisation-scoped
          queries enforce multi-tenant isolation. Access to production systems is limited and audited.
        </p>
        <p>
          <strong>Retention and deletion.</strong> We retain account and workspace data for the life of the account and
          for a short period afterwards to support backup, audit, and legal requirements. You may request export or
          deletion at any time; verified deletion requests are completed within 30 days unless a legal hold applies.
        </p>
        <p>
          <strong>Sharing and sub-processors.</strong> We share data only with service providers that help us host,
          secure, and support the Service, under written confidentiality and data-protection terms. A current
          sub-processor list is available on request. We do not sell personal information.
        </p>
        <p>
          <strong>Your rights.</strong> Depending on your jurisdiction, you may request access, correction, export,
          deletion, restriction, or objection regarding your personal data. California residents may exercise CCPA
          rights, including the right to know and the right to delete. We will not discriminate for exercising these
          rights.
        </p>
        <p>
          <strong>Cookies.</strong> We use a single essential session cookie to keep you signed in. See the Cookie
          Policy for details. No advertising cookies are used.
        </p>
        <p>
          <strong>Contact.</strong> Privacy and data-protection requests: <a className="text-brand-600 hover:underline" href="mailto:info@qasyn.io">info@qasyn.io</a> or <Link className="text-brand-600 hover:underline" href="/contact-us">contact us</Link>.
        </p>
      </div>
    </div>
  );
}
