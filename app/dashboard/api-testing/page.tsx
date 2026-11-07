import type { Metadata } from "next";
import { ApiTestingEditor, type ApiResult } from "@/components/dashboard/pages/EnginesClient";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "API testing" };
export const dynamic = "force-dynamic";

export default async function ApiTestingPage() {
  const ctx = await requireOrgContext();
  const tests = await prisma.apiTest.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="API TESTING & CHAINING" title="API testing" description="Sequential request chains: extract variables (e.g. auth tokens) and inject them into the next requests. Assertions: status, schema and payload values." />
      {tests.length === 0 && (
        <Card title="New API test">
          <EmptyState title="No API tests" description="Create one below — the editor saves and executes the chain." />
        </Card>
      )}
      {tests.map((t) => {
        let requests: never[] = [];
        try {
          requests = JSON.parse(t.requestsJson || "[]");
        } catch {
          requests = [];
        }
        let results: ApiResult[] = [];
        try {
          results = JSON.parse(t.resultsJson || "[]");
        } catch {
          results = [];
        }
        return (
          <Card key={t.id} title={`${t.name} · ${requests.length} requests`} actions={<StatusPill value={t.status === "passed" ? "passing" : t.status === "failed" ? "failing" : "draft"} label={t.status} />}>
            <div className="px-5 py-4">
              <ApiTestingEditor testId={t.id} initial={requests as never} readOnly={ctx.readOnly} />
              {results.length > 0 && (
                <p className="mt-3 text-xs text-slate-500">Last execution: {results.filter((r) => r.ok).length}/{results.length} requests passed.</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
