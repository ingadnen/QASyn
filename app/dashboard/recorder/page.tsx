import type { Metadata } from "next";
import { RecorderClient } from "@/components/dashboard/pages/RecorderClient";
import { PageHeader } from "@/components/dashboard/ui";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Recorder" };
export const dynamic = "force-dynamic";

export default async function RecorderPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const ctx = await requireOrgContext();
  const { url } = await searchParams;
  const requested = typeof url === "string" ? url.trim() : "";
  const initialUrl = /^https?:\/\//i.test(requested) ? requested : ctx.org.website || "";
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="WEB AUTOMATION STUDIO · CHROME EXTENSION"
        title="Recorder"
        description={`Low-code recording for ${ctx.org.name}: load the target page, click inside the sandbox viewport and every interaction is translated live into structured NLP steps for a new TestCase.`}
      />
      <RecorderClient organisationName={ctx.org.name} initialUrl={initialUrl} readOnly={ctx.readOnly} />
    </div>
  );
}
