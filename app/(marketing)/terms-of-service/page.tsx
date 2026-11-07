import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Terms of Service</h1>
      <p className="mt-2 text-xs text-muted">Last updated: November 2026 · QASyn prototype (fictional company for demonstration).</p>
      <div className="prose max-w-none mt-8 space-y-5 text-sm leading-relaxed text-muted">
        <p>These Terms of Service govern access to the QASyn demonstration platform ("the Service"). The Service is a fictional prototype built for evaluation purposes; no real legal entity provides it.</p>
        <p>1. Acceptance. By accessing the Service you agree to these terms. 2. Accounts. You are responsible for credentials on your account. 3. Acceptable use. Automated testing against systems you own or are authorized to test only — no SSRF, no unauthorized access.</p>
        <p>4. Credits. Trial credits are simulated and carry no cash value. 5. Liability. The Service is provided “as is” without warranties; liability is capped at the simulated credit value. 6. Termination. Access may be suspended for abuse.</p>
      </div>
    </div>
  );
}
