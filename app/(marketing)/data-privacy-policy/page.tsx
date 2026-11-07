import type { Metadata } from "next";

export const metadata: Metadata = { title: "Data Privacy & AI Safety Policy" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Data Privacy & AI Safety Policy</h1>
      <p className="mt-2 text-xs text-muted">Last updated: November 2026 · QASyn prototype (fictional company for demonstration).</p>
      <div className="prose max-w-none mt-8 space-y-5 text-sm leading-relaxed text-muted">
        <p>Enterprise data governance: test credentials are AES-256-GCM encrypted at rest; API tokens are stored as SHA-256 hashes and shown once. Multi-tenant isolation is enforced by organisation-scoped queries on every route.</p>
        <p>AI safety: red-team suites (OWASP LLM Top 10), guardrail evaluation on every agent response, hallucination grounding against your own knowledge base, and audit logging of all member actions.</p>
      </div>
    </div>
  );
}
