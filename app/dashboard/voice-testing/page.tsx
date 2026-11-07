import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/dashboard/ui";
import { PERSONA_LIBRARY, simulateConversation } from "@/lib/persona-simulator";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Voice testing" };
export const dynamic = "force-dynamic";

export default async function VoiceTestingPage() {
  const ctx = await requireOrgContext();
  const agents = await prisma.agentTestSuite.findMany({ where: { organisationId: ctx.org.id }, take: 5 });
  const dialog = simulateConversation(PERSONA_LIBRARY[0], ["Where is my invoice?", "I need it now, please"]);
  return (
    <div className="space-y-6">
      <PageHeader kicker="ENTERPRISE" title="Voice testing" description="STT/TTS evaluation, interruption handling, latency metrics and accent robustness via persona-driven scenarios." />
      <Card title="Persona library (voice scenarios)">
        <ul className="divide-y divide-slate-100 px-5 py-2">
          {PERSONA_LIBRARY.map((p) => (
            <li key={p.name} className="py-2 text-sm">
              <span className="font-medium text-slate-800">{p.name}</span> <span className="text-xs text-slate-500">{p.temperament} · {p.language}</span>
              <p className="mt-0.5 text-xs text-slate-500">{p.behaviorRules.join(" · ")}</p>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Simulated multi-turn dialog (Frustrated Customer)">
        <ol className="space-y-1 px-5 py-3">
          {dialog.map((d, i) => <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">{d}</li>)}
        </ol>
        <p className="px-5 pb-4 text-xs text-slate-500">Latency budget: TTS first-audio &lt; 800 ms · interruption recovery &lt; 1.5 s · accent robustness ≥ 85% ASR accuracy (simulated).</p>
      </Card>
      <Card title="Voice-capable agent suites">
        <ul className="divide-y divide-slate-100 px-5 py-2">
          {agents.length === 0 && <li className="py-3 text-sm text-slate-500">No agent suites yet — declare one in Agent suites.</li>}
          {agents.map((a) => <li key={a.id} className="py-2 text-sm">{a.name} <span className="text-xs text-slate-500">{a.agentEndpoint}</span></li>)}
        </ul>
      </Card>
    </div>
  );
}
