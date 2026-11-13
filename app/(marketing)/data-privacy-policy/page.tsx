import type { Metadata } from "next";

export const metadata: Metadata = { title: "Data Privacy & AI Safety Policy" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Data Privacy &amp; AI Safety Policy</h1>
      <p className="mt-2 text-xs text-muted">Last updated: November 2026</p>
      <div className="prose max-w-none mt-8 space-y-5 text-sm leading-relaxed text-muted">
        <p>
          QASyn is built for teams that need evidence, not black boxes. This policy describes the controls that protect
          customer data and the safeguards that govern AI-assisted quality engineering.
        </p>
        <p>
          <strong>Data governance.</strong> Test credentials and integration secrets are encrypted at rest with
          AES-256-GCM. API tokens are stored as SHA-256 hashes and shown once at creation. Every data access is scoped
          to the requesting organisation, and administrative actions are recorded in the system audit trail.
        </p>
        <p>
          <strong>Tenant isolation.</strong> Organisation-scoped queries and route-level authorisation checks prevent
          cross-tenant access. Enterprise deployments can run in a private environment with customer-managed network
          boundaries and dedicated storage.
        </p>
        <p>
          <strong>AI safety.</strong> AI-generated tests and analyses are evaluated against OWASP LLM Top 10 red-team
          suites. Guardrails run on every agent response, grounding checks compare outputs with your own knowledge
          base, and high-impact changes remain subject to human review before merge.
        </p>
        <p>
          <strong>Model training.</strong> Customer workspace content is not used to train shared or foundation models
          without explicit written consent. Prompts and outputs are retained only as needed to deliver the feature,
          investigate failures, and meet contractual obligations.
        </p>
        <p>
          <strong>Incident response.</strong> Security events are triaged by the QASyn security team. Confirmed breaches
          affecting personal data are notified to affected customers without undue delay and within the timelines
          required by applicable law.
        </p>
        <p>
          <strong>Contact.</strong> Security and AI-safety questions: <a className="text-brand-600 hover:underline" href="mailto:adnen.rebhi@qasyn.com">adnen.rebhi@qasyn.com</a>.
        </p>
      </div>
    </div>
  );
}
