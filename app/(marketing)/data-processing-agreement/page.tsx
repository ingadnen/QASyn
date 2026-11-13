import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Data Processing Agreement (GDPR/CCPA)" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Data Processing Agreement (GDPR/CCPA)</h1>
      <p className="mt-2 text-xs text-muted">Last updated: November 2026</p>
      <div className="prose max-w-none mt-8 space-y-5 text-sm leading-relaxed text-muted">
        <p>
          This Data Processing Agreement applies when QASyn processes personal data on behalf of a customer in
          connection with the Service. It supplements the Terms of Service and the Privacy Policy.
        </p>
        <p>
          <strong>Roles.</strong> The customer is the data controller (or business under CCPA) and determines the
          purposes and means of processing. QASyn acts as the processor (or service provider) and processes personal
          data only on documented instructions, including those in the applicable order and this agreement.
        </p>
        <p>
          <strong>Processing scope.</strong> Processing is limited to hosting and operating the customer workspace,
          running tests and analyses, generating reports, providing support, and maintaining security. The categories
          of data subjects and personal data are those the customer chooses to submit to the Service.
        </p>
        <p>
          <strong>Confidentiality and security.</strong> Personnel with access to personal data are bound by
          confidentiality obligations. QASyn maintains technical and organisational measures including encryption in
          transit, AES-256-GCM encryption of secrets at rest, hashed API tokens, tenant-scoped access control, audit
          logging, and regular vulnerability management.
        </p>
        <p>
          <strong>Sub-processors.</strong> QASyn may engage sub-processors for hosting, email delivery, monitoring, and
          support. Sub-processors are bound by written data-protection terms no less protective than this agreement.
          Customers may request the current list and object to new sub-processors on reasonable grounds.
        </p>
        <p>
          <strong>Data subject rights.</strong> QASyn assists customers in responding to access, correction, deletion,
          restriction, portability, and objection requests. The workspace provides export and deletion controls, and
          the QASyn team supports verified requests within the required timelines.
        </p>
        <p>
          <strong>Breach notification.</strong> QASyn notifies the customer without undue delay after confirming a
          personal-data breach and within 72 hours where required by law, with the information reasonably available to
          help the customer meet its own notification obligations.
        </p>
        <p>
          <strong>Return and deletion.</strong> On termination, QASyn returns or deletes personal data at the
          customer&apos;s choice, subject to legal retention requirements. Backups are purged on the normal backup
          cycle after the retention window.
        </p>
        <p>
          <strong>CCPA.</strong> QASyn does not sell personal information, does not retain, use, or disclose it outside
          the business purpose of providing the Service, and will notify the customer if it determines it can no
          longer meet these obligations.
        </p>
        <p>
          <strong>Contact.</strong> Data-processing and DPA requests: <a className="text-brand-600 hover:underline" href="mailto:info@qasyn.io">info@qasyn.io</a> or <Link className="text-brand-600 hover:underline" href="/contact-us">contact us</Link>.
        </p>
      </div>
    </div>
  );
}
