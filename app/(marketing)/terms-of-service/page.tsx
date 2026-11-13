import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Terms of Service</h1>
      <p className="mt-2 text-xs text-muted">Last updated: November 2026</p>
      <div className="prose max-w-none mt-8 space-y-5 text-sm leading-relaxed text-muted">
        <p>
          These Terms of Service govern access to the QASyn quality engineering platform and related services
          (&quot;the Service&quot;). By creating a workspace or using the Service, you agree to these terms on behalf
          of your organisation.
        </p>
        <p>
          <strong>1. Accounts and access.</strong> You are responsible for the accuracy of account information, for
          protecting your credentials, and for all activity performed under your workspace. Enterprise administrators
          may configure SSO, SCIM provisioning, roles, and seat limits for their organisation.
        </p>
        <p>
          <strong>2. Acceptable use.</strong> You may use the Service only against systems you own or are authorised
          to test. You must not attempt unauthorised access, disable security controls, exfiltrate third-party data,
          or use the Service to attack, overload, or probe infrastructure without permission.
        </p>
        <p>
          <strong>3. Credits and billing.</strong> Paid plans include a monthly credit allowance. Credits are consumed
          by test runs, impact analysis, bug analysis, and other metered actions described in the product. Overage is
          billed at the rates shown in your order or workspace billing page. Fees are non-refundable except where
          required by law.
        </p>
        <p>
          <strong>4. Customer data.</strong> You retain ownership of the content, test assets, and credentials you
          submit. You grant QASyn the limited rights needed to operate the Service, provide support, and maintain
          security. Our handling of personal data is described in the Privacy Policy and Data Processing Agreement.
        </p>
        <p>
          <strong>5. Availability and support.</strong> We work to keep the Service available and secure. Enterprise
          plans may include a service-level commitment, priority support, and private deployment options as set out in
          the applicable order.
        </p>
        <p>
          <strong>6. Liability.</strong> To the maximum extent permitted by law, QASyn is not liable for indirect,
          incidental, special, or consequential damages, or for lost profits, revenue, or data. Our aggregate
          liability is limited to the fees paid for the Service during the twelve months preceding the claim.
        </p>
        <p>
          <strong>7. Termination.</strong> You may stop using the Service at any time. We may suspend or terminate
          access for material breach, abuse, or non-payment. On termination, you may export your data during the
          retention window described in the Privacy Policy.
        </p>
        <p>
          <strong>8. Contact.</strong> Legal and contractual questions: <a className="text-brand-600 hover:underline" href="mailto:adnen.rebhi@qasyn.com">adnen.rebhi@qasyn.com</a>.
        </p>
      </div>
    </div>
  );
}
