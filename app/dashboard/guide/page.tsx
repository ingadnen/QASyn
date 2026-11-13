import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/ui";

export const metadata: Metadata = { title: "Interactive Guide" };
export const dynamic = "force-dynamic";

const MODULES = [
  ["Overview", "KPIs, release quality, AI telemetry and Autopilot."],
  ["Pull requests", "Impact analysis, PR gate, Azure DevOps/GitHub/GitLab sync."],
  ["Crawl", "Live DOM crawl, in-progress rows and linked test generation."],
  ["Code Analysis", "Graphify topology and blast-radius intelligence."],
  ["Requirements", "Boards work items, coverage and linked cases."],
  ["Test cases", "NLP authoring, sorting, bulk actions and Studio."],
  ["Test Studio", "Step editor, per-step PNG evidence and QASyn Vision AI healing."],
  ["Suites & plans", "Suite/plan governance and cross-environment execution."],
  ["Environments & data", "Variables, profiles, auth, proxy and viewports."],
  ["Uploads", "APK, IPA, HAR, Postman and evidence artefacts."],
  ["Knowledge Base", "Grounding sources for agents and test generation."],
  ["Team & access", "Roles, invitations and token quotas."],
  ["Tunnels", "Secure localhost execution agents."],
  ["Integrations", "Source control, issue trackers, AI and cloud providers."],
  ["Billing & usage", "Plans, credits, top-ups, quotas and AI telemetry."],
  ["MCP", "JSON-RPC tools, custom models and agent skills."],
  ["API Tokens", "Scoped machine credentials for CI and agents."],
  ["System Audits", "Immutable workspace audit trail."],
  ["Learning Hub", "Interactive tutorials with completion tracking."],
];

export default function DashboardGuidePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Interactive Guide" description="The complete QASyn architecture, module by module" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {MODULES.map(([name, description], index) => (
          <article key={name} className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">Module {index + 1}</p>
            <h2 className="mt-1 text-sm font-semibold text-[#111827]">{name}</h2>
            <p className="mt-1 text-[12px] leading-5 text-[#6b7280]">{description}</p>
          </article>
        ))}
      </div>
      <section className="rounded-xl border border-[#e5e7eb] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#111827]">End-to-end workflow</h2>
        <ol className="mt-3 grid gap-2 text-[12.5px] text-[#4b5563] md:grid-cols-3">
          {[
            "Connect repositories, environments and issue trackers.",
            "Crawl the live app and author target-specific cases.",
            "Execute with Playwright and QASyn Vision AI verification.",
            "Self-heal selectors and persist step-level PNG evidence.",
            "Gate the pull request with impact analysis.",
            "Report release quality to the workspace ledger.",
          ].map((step, index) => (
            <li key={step} className="rounded-lg bg-[#fafafa] px-3 py-2"><strong>{index + 1}.</strong> {step}</li>
          ))}
        </ol>
        <Link href="/dashboard/learning" className="mt-4 inline-block text-[12.5px] font-semibold text-[#5b4ee8] hover:underline">Open the Learning Hub →</Link>
      </section>
    </div>
  );
}
