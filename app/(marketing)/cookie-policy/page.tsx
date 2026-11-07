import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cookie Policy" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Cookie Policy</h1>
      <p className="mt-2 text-xs text-muted">Last updated: November 2026 · QASyn prototype (fictional company for demonstration).</p>
      <div className="prose max-w-none mt-8 space-y-5 text-sm leading-relaxed text-muted">
        <p>Essential cookies: qasyn_org (session, 30 days, httpOnly). No analytics or advertising cookies are used. Preferences are stored in the session, not in cookies.</p>
        <p>You can disable cookies in your browser; the dashboard requires the session cookie to stay signed in.</p>
      </div>
    </div>
  );
}
