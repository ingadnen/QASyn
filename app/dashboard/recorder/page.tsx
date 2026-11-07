import type { Metadata } from "next";
import { RecorderClient } from "@/components/dashboard/pages/RecorderClient";
import { PageHeader } from "@/components/dashboard/ui";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Recorder" };
export const dynamic = "force-dynamic";

export default async function RecorderPage() {
  const ctx = await requireOrgContext();
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="WEB AUTOMATION STUDIO · CHROME EXTENSION"
        title="Recorder"
        description={`Low-code recording for ${ctx.org.name}: click inside the sandbox viewport and every interaction is translated live into structured NLP steps for a new TestCase.`}
      />
      <RecorderClient organisationName={ctx.org.name} readOnly={ctx.readOnly} />
    </div>
  );
}
