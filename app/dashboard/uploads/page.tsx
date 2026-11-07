import type { Metadata } from "next";
import { UploadCreate } from "@/components/dashboard/pages/Forms";
import { Card, EmptyState, PageHeader, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Uploads" };
export const dynamic = "force-dynamic";

export default async function UploadsPage() {
  const ctx = await requireOrgContext();
  const uploads = await prisma.upload.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="PLATFORM" title="Uploads" description="Builds (APK/IPA), HAR captures, Postman collections and evidence videos. Metadata only in this prototype." />
      <Card title="Register an upload"><div className="px-5 py-4"><UploadCreate readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${uploads.length} uploads`}>
        {uploads.length === 0 ? <EmptyState title="No uploads" description="Register a build or capture above." /> : (
          <ul className="divide-y divide-slate-100">
            {uploads.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">{u.fileName}</p>
                  <p className="text-xs text-slate-500">{u.kind} · {(u.sizeBytes / 1024).toFixed(0)} KB · by {u.uploadedBy} · {timeAgo(u.createdAt)}</p>
                </div>
                <ActionButton url={`/api/dashboard/uploads/${u.id}`} method="DELETE" variant="danger" disabled={ctx.readOnly} confirmText="Delete this upload?">Delete</ActionButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
