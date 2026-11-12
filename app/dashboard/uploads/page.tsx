import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { CreateFolderButton, UploadsTable } from "@/components/dashboard/pages/UploadsClient";
import { CqaIcon, PageHeader, cqaBtnSecondary, cqaCard } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Uploads" };
export const dynamic = "force-dynamic";

export default async function UploadsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requirePermission("uploads");
  const { q = "" } = await searchParams;
  const uploads = await prisma.upload.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } });
  const filtered = uploads.filter((u) => !q || `${u.fileName} ${u.kind} ${u.uploadedBy}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <PageHeader title="Uploads" description="Manage and organize all your uploaded files and folders" />

      <div className="flex flex-wrap items-center gap-2">
        <CreateFolderButton readOnly={ctx.readOnly} />
        <form method="get" className="relative min-w-[220px] flex-1">
          <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
          <input
            name="q"
            defaultValue={q}
            aria-label="Search uploads"
            placeholder="Search"
            className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-[13px] text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
          />
        </form>
        <details className="relative">
          <summary aria-label="Table settings" className={`${cqaBtnSecondary} size-9 cursor-pointer list-none p-0 [&::-webkit-details-marker]:hidden`}>
            <CqaIcon name="settings" className="text-[18px]" />
          </summary>
          <div className="absolute right-0 z-30 mt-1 w-52 rounded-lg border border-[#e5e7eb] bg-white p-3 shadow-lg">
            <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Show columns</p>
            {["File Name", "Type", "Size", "Uploaded by", "Created"].map((c) => (
              <label key={c} className="flex items-center gap-2 py-0.5 text-[12.5px] text-[#374151]">
                <input type="checkbox" defaultChecked className="size-3.5 accent-[#5b4ee8]" /> {c}
              </label>
            ))}
          </div>
        </details>
        <a href="/dashboard/uploads" aria-label="Refresh" className={cqaBtnSecondary}>
          <CqaIcon name="refresh" className="text-[18px]" />
        </a>
      </div>

      <div className={cqaCard}>
        <UploadsTable
          readOnly={ctx.readOnly}
          rows={filtered.map((upload) => ({
            id: upload.id,
            fileName: upload.fileName,
            kind: upload.kind,
            sizeBytes: upload.sizeBytes,
            uploadedBy: upload.uploadedBy,
            createdAt: upload.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
