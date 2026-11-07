import type { Metadata } from "next";
import Link from "next/link";
import { IntegrationsCatalog, type CatalogWorkspace } from "@/components/marketing/IntegrationsCatalog";
import { DEMO_ORG_SLUG } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { loadOnboardingState } from "@/lib/onboarding-state";
import { resolveOrgContext } from "@/lib/tenant";
import type { IntegrationStatus, Provider } from "@/lib/types";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

/** État des intégrations lu en base : organisation de session, sinon démo "acme". */
async function getWorkspace(): Promise<CatalogWorkspace> {
  const ctx = await resolveOrgContext();

  if (ctx && !ctx.readOnly) {
    const state = await loadOnboardingState(ctx.org.id);
    if (state) {
      const statuses: CatalogWorkspace["statuses"] = {};
      for (const i of state.integrations) statuses[i.provider] = i.status;
      const href = (step: 3 | 4) =>
        state.completed ? "/dashboard/integrations" : state.currentStep >= step ? `/onboarding/${step}` : "/onboarding";
      return { source: "session", orgName: state.organisation.name, statuses, connectHref: { 3: href(3), 4: href(4) } };
    }
  }

  const demo = await prisma.organisation.findUnique({
    where: { slug: DEMO_ORG_SLUG },
    include: { integrations: true },
  });
  const statuses: CatalogWorkspace["statuses"] = {};
  for (const i of demo?.integrations ?? []) statuses[i.provider as Provider] = i.status as IntegrationStatus;
  return {
    source: demo ? "demo" : "none",
    orgName: demo?.name ?? null,
    statuses,
    connectHref: { 3: "/signup", 4: "/signup" },
  };
}

export default async function IntegrationsPage() {
  const workspace = await getWorkspace();

  return (
    <div className="bg-white">
      <section className="border-b border-line bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-5 pt-16 pb-12">
          <p className="text-sm font-semibold text-brand-600">Integrations</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Plug QASyn into the tools <span className="font-serif font-normal italic text-brand-600">you already use.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Code hosts, trackers, CI and chat. Connections made during onboarding show up here instantly.
          </p>
          <div className="mt-6 inline-flex flex-wrap items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm text-muted">
            <span className="size-2 rounded-full bg-emerald-500" />
            {workspace.source === "session" && (
              <>
                Showing your workspace <strong className="text-ink">{workspace.orgName}</strong>
              </>
            )}
            {workspace.source === "demo" && (
              <>
                Showing demo workspace <strong className="text-ink">{workspace.orgName}</strong> ·{" "}
                <Link href="/signup" className="font-semibold text-brand-600 hover:underline">
                  create yours
                </Link>
              </>
            )}
            {workspace.source === "none" && <>No workspace yet — run the seed or create an organisation.</>}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-12">
        <IntegrationsCatalog workspace={workspace} />
      </section>
    </div>
  );
}
