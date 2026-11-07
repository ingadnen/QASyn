import type { Metadata } from "next";
import { EmailTestingClient } from "@/components/dashboard/pages/EngineClients";
import { Card, EmptyState, PageHeader } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Email testing" };
export const dynamic = "force-dynamic";

export default async function EmailTestingPage() {
  const ctx = await requireOrgContext();
  const inboxes = await prisma.emailTestInbox.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, include: { messages: { orderBy: { receivedAt: "desc" }, take: 5 } } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="SOLUTIONS" title="Email testing" description="Virtual inboxes with OTP and magic-link verification for transactional flows." />
      <Card title="Studio"><div className="px-5 py-4"><EmailTestingClient readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${inboxes.length} inboxes`}>
        {inboxes.length === 0 ? <EmptyState title="No inboxes" description="Generate one above." /> : (
          <ul className="divide-y divide-slate-100">
            {inboxes.map((i) => (
              <li key={i.id} className="px-5 py-3">
                <p className="font-mono text-sm text-slate-800">{i.emailAddress}</p>
                <ul className="mt-1 space-y-1">
                  {i.messages.map((m) => (
                    <li key={m.id} className="text-xs text-slate-600">
                      {m.subject} · OTP: <strong>{m.extractedOtp ?? "—"}</strong> · {timeAgo(m.receivedAt)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
