import type { Metadata } from "next";
import { SecurityScanForm } from "@/components/dashboard/pages/EngineClients";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Security testing" };
export const dynamic = "force-dynamic";

export default async function SecurityTestingPage() {
  const ctx = await requireOrgContext();
  const scans = await prisma.securityScan.findMany({ where: { organisationId: ctx.org.id }, orderBy: { startedAt: "desc" }, take: 20 });
  return (
    <div className="space-y-6">
      <PageHeader kicker="SOLUTIONS" title="Security testing" description="OWASP Top 10 automated scanner: XSS, SQL injection, headers, CORS and cookie checks with CVSS scoring." />
      <Card title="New scan"><div className="px-5 py-4"><SecurityScanForm readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${scans.length} scans`}>
        {scans.length === 0 ? <EmptyState title="No scans" description="Run your first scan above." /> : (
          <ul className="divide-y divide-slate-100">
            {scans.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">{s.targetUrl}</p>
                  <p className="text-xs text-slate-500">{s.scanType} · {s.highCount}H/{s.mediumCount}M/{s.lowCount}L · {timeAgo(s.startedAt)}</p>
                </div>
                <StatusPill value={s.status === "COMPLETED" ? "passing" : "draft"} label={s.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
