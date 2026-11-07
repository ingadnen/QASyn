import type { Metadata } from "next";
import { DataProfileForm } from "@/components/dashboard/pages/StudioClients";
import { Card, EmptyState, PageHeader, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Data profiles" };
export const dynamic = "force-dynamic";

export default async function DataProfilesPage() {
  const ctx = await requireOrgContext();
  const profiles = await prisma.dataProfile.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } });
  const cases = await prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, orderBy: { title: "asc" }, select: { id: true, title: true } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="TESTING STUDIO" title="Data profiles" description="Parameterized data sets: upload CSV (Excel accepted as CSV) and iterate executions per row." />
      <Card title="New profile (CSV import)"><div className="px-5 py-4"><DataProfileForm readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${profiles.length} profiles`}>
        {profiles.length === 0 ? <EmptyState title="No profiles" description="Import a CSV above." /> : (
          <ul className="divide-y divide-slate-100">
            {profiles.map((p) => {
              let rows: Array<Record<string, string>> = [];
              try {
                rows = JSON.parse(p.rowsJson || "[]");
              } catch {
                rows = [];
              }
              return (
                <li key={p.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium text-slate-800">{p.name}</span>
                    <span className="text-xs text-slate-500">{p.sourceType} · {rows.length} rows</span>
                    <span className="ml-auto"><ActionButton url={`/api/dashboard/data-profiles/${p.id}`} method="DELETE" variant="danger" disabled={ctx.readOnly} confirmText="Delete this profile?">Delete</ActionButton></span>
                  </div>
                  {rows[0] && (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead><tr>{Object.keys(rows[0]).map((c) => <th key={c} className="border-b border-slate-100 py-1 pr-3 font-semibold text-slate-600">{c}</th>)}</tr></thead>
                        <tbody>
                          {rows.slice(0, 5).map((r, i) => (
                            <tr key={i}>{Object.values(r).map((v, j) => <td key={j} className="border-b border-slate-50 py-1 pr-3 text-slate-600">{v}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="mt-1 text-xs text-slate-400">Use <code>{"{{row.column}}"}</code> in test steps to bind data rows. Linked cases: {cases.length} available in Test Studio.</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
