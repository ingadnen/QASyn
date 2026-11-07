import type { Metadata } from "next";

export const metadata: Metadata = { title: "Data Processing Agreement (GDPR/CCPA)" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Data Processing Agreement (GDPR/CCPA)</h1>
      <p className="mt-2 text-xs text-muted">Last updated: November 2026 · QASyn prototype (fictional company for demonstration).</p>
      <div className="prose max-w-none mt-8 space-y-5 text-sm leading-relaxed text-muted">
        <p>As data controller you determine purposes; QASyn acts as processor for workspace data. Processing occurs only to run your tests and generate evidence. Sub-processors: none in this prototype (fully local).</p>
        <p>Data subject rights: export via Reports CSV, deletion via Organisation reset, and audit trails via System audits. Breach notification within 72 hours. CCPA: no sale of personal information.</p>
      </div>
    </div>
  );
}
