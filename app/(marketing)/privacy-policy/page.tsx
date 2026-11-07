import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Privacy Policy</h1>
      <p className="mt-2 text-xs text-muted">Last updated: November 2026 · QASyn prototype (fictional company for demonstration).</p>
      <div className="prose max-w-none mt-8 space-y-5 text-sm leading-relaxed text-muted">
        <p>We collect only what testing requires: workspace names, test content you create, and usage telemetry. Test data is stored locally in SQLite for this prototype and never leaves your machine.</p>
        <p>Cookies: we use a single session cookie (qasyn_org) for authentication. Third-party cookies are not used. You may clear data at any time via Settings › Organisation › Reset.</p>
      </div>
    </div>
  );
}
