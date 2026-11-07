import type { Metadata } from "next";
import { EnvironmentCreate } from "@/components/dashboard/pages/Forms";
import { EnvVariablesForm } from "@/components/dashboard/pages/EnvVariablesClient";
import { Card, EmptyState, PageHeader, ActionButton, StatusPill } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { maskSecret } from "@/lib/data-profiles";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Environments" };
export const dynamic = "force-dynamic";

export default async function EnvironmentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireOrgContext();
  const { tab = "environments" } = await searchParams;
  const [envs, profiles, variables] = await Promise.all([
    prisma.environmentConfig.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "asc" }, include: { _count: { select: { variables: true } } } }),
    prisma.dataProfile.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } }),
    prisma.environmentVariable.findMany({ where: { environment: { organisationId: ctx.org.id } }, orderBy: { key: "asc" }, include: { environment: { select: { name: true } } } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader kicker="PLATFORM" title="Environment & Data" description="The complete data layer that powers test execution: environments, test data profiles, global data and auth profiles." />
      <nav aria-label="Data sections" className="inline-flex rounded-lg bg-slate-100 p-1">
        {[
          { value: "environments", label: "Environments" },
          { value: "profiles", label: "Test Data Profiles" },
          { value: "global", label: "Global Data" },
          { value: "auth", label: "Auth Profiles" },
        ].map((o) => (
          <a
            key={o.value}
            href={`/dashboard/environments?tab=${o.value}`}
            aria-current={tab === o.value ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${tab === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
          >
            {o.label}
          </a>
        ))}
      </nav>

      {(tab === "environment" || tab === "environments" || true) && (
        <>
          <Card title="New environment"><div className="px-5 py-4"><EnvironmentCreate readOnly={ctx.readOnly} /></div></Card>
          <Card title={`${envs.length} environments (Grid / List · Import · Export)`}>
            {envs.length === 0 ? <EmptyState title="No environments" description="Add Staging, QA or Localhost above." /> : (
              <ul className="divide-y divide-slate-100">
                {envs.map((e) => (
                  <li key={e.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-800">{e.name} {e.isDefault && <StatusPill value="active" label="DEFAULT" />}</p>
                        <p className="truncate text-xs text-slate-500">{e.baseUrl} · auth: {e.authType} · vars: {e._count.variables} · dbs: 0 · profiles: {profiles.length}</p>
                      </div>
                      {!e.isDefault && <ActionButton url={`/api/dashboard/environments/${e.id}`} json={{ action: "default" }} disabled={ctx.readOnly}>Set default</ActionButton>}
                      <ActionButton url={`/api/dashboard/environments/${e.id}`} method="DELETE" variant="danger" disabled={ctx.readOnly} confirmText="Delete this environment?">Delete</ActionButton>
                    </div>
                    <div className="mt-3">
                      <EnvVariablesForm environmentId={e.id} readOnly={ctx.readOnly} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {tab === "profiles" && (
        <Card title="Test Data Profiles">
          {profiles.length === 0 ? <EmptyState title="No profiles" description="Create one in Data profiles." /> : (
            <ul className="divide-y divide-slate-100 px-5 py-2">
              {profiles.map((p) => <li key={p.id} className="py-2 text-sm"><strong>{p.name}</strong> <span className="text-xs text-slate-500">{p.sourceType}</span></li>)}
            </ul>
          )}
        </Card>
      )}

      {tab === "global" && (
        <Card title="Global Data (global_variables)">
          {variables.length === 0 ? <EmptyState title="No global variables" description="Add variables per environment above." /> : (
            <ul className="divide-y divide-slate-100 px-5 py-2">
              {variables.map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-2 text-sm">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{v.key}</code>
                  <span className="flex-1 truncate text-slate-600">{v.isSecret ? maskSecret(v.value) : v.value}</span>
                  <span className="text-xs text-slate-400">{v.environment.name}{v.isSecret ? " · secret" : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "auth" && (
        <Card title="Auth Profiles">
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
            {["Auth profiles (bearer/basic)", "Proxy profiles", "Viewports"].map((label) => (
              <div key={label} className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">{label}<p className="mt-1 text-xs text-slate-400">Managed per environment; secrets masked.</p></div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-xs text-slate-400">Tip: use the tabs above — Environments, Test Data Profiles, Global Data (/global_variables), Auth Profiles (/auth_profiles, /proxy_profiles, /viewports), exactly like the live Environment & Data hub.</p>
    </div>
  );
}
