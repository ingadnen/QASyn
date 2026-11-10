import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { OrganizationSettings } from "@/components/dashboard/pages/OrganizationSettings";
import { SuperAdminConsole } from "@/components/dashboard/pages/SuperAdminConsole";
import { prisma } from "@/lib/db";
import { DEFAULT_ORGANIZATION_PREFERENCES, readSettings } from "@/lib/tenant";
import { can, isSuperAdmin } from "@/lib/rbac";

export const metadata: Metadata = { title: "Organization Setting" };
export const dynamic = "force-dynamic";

export default async function OrgSettingsPage() {
  const ctx = await requirePermission("settings");
  const [viewports, proxies, remotes, knowledge] = await Promise.all([
    prisma.viewportSetting.findMany({ where: { organisationId: ctx.org.id }, orderBy: [{ category: "asc" }, { width: "asc" }] }),
    prisma.proxyProfile.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "asc" } }),
    prisma.remoteBrowserProfile.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "asc" } }),
    prisma.knowledgeItem.findMany({ where: { organisationId: ctx.org.id }, select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: 50 }),
  ]);
  const settings = readSettings(ctx.org);
  const initial = { ...DEFAULT_ORGANIZATION_PREFERENCES, ...(settings.organization ?? {}) };
  return (
    <>
      <OrganizationSettings
        readOnly={ctx.readOnly || !can(ctx.user.role, "settingsManage")}
        orgName={ctx.org.name}
        logoUrl={ctx.org.logoUrl}
        initial={initial}
        viewports={viewports.map((v) => ({ id: v.id, name: v.name, width: v.width, height: v.height, category: v.category }))}
        proxies={proxies.map((p) => ({ id: p.id, name: p.name, url: p.url, host: p.host, port: p.port, username: p.username }))}
        remotes={remotes.map((r) => ({ id: r.id, name: r.name, remoteUrl: r.remoteUrl, username: r.username, status: r.status }))}
        knowledge={knowledge}
      />
      {isSuperAdmin(ctx.user.role) && <SuperAdminConsole />}
    </>
  );
}
