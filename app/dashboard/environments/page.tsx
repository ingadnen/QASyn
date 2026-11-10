import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { EnvironmentData } from "@/components/dashboard/pages/EnvironmentData";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Environment & Data" };
export const dynamic = "force-dynamic";

function parseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function countArray(value: string): number {
  return parseArray(value).length;
}

export default async function EnvironmentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requirePermission("environments");
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "profiles" || rawTab === "global" || rawTab === "auth" ? rawTab : "environments";

  const [environments, profiles, globals, auths, proxies, viewports] = await Promise.all([
    prisma.environmentConfig.findMany({
      where: { organisationId: ctx.org.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      include: { variables: { orderBy: { key: "asc" } } },
    }),
    prisma.dataProfile.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } }),
    prisma.globalVariable.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } }),
    prisma.authProfile.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } }),
    prisma.proxyProfile.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } }),
    prisma.viewportSetting.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const parsedProfiles = profiles.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    permission: p.permission,
    columns: countArray(p.columnsJson),
    rows: countArray(p.rowsJson),
    environmentIds: parseArray(p.environmentIds),
    createdAt: p.createdAt.toISOString(),
  }));

  const envs = environments.map((env) => ({
    id: env.id,
    name: env.name,
    baseUrl: env.baseUrl,
    description: env.description,
    accent: env.accent,
    isDefault: env.isDefault,
    variablesCount: env.variables.length,
    profilesCount: parsedProfiles.filter((p) => p.environmentIds.includes(env.id)).length,
    updatedAt: env.createdAt.toISOString(),
    variables: env.variables.map((v) => ({ id: v.id, key: v.key, value: v.isSecret ? "••••••••" : v.value, isSecret: v.isSecret })),
  }));

  return (
    <EnvironmentData
      tab={tab}
      readOnly={ctx.readOnly}
      envs={envs}
      profiles={parsedProfiles}
      globals={globals.map((g) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        permission: g.permission,
        value: g.value,
        tags: parseArray(g.tags),
        description: g.description,
      }))}
      auths={auths.map((a) => ({
        id: a.id,
        name: a.name,
        appUrl: a.appUrl,
        loginUrl: a.loginUrl,
        method: a.method,
        username: a.username,
        autoSignIn: a.autoSignIn,
        lastSignedInAt: a.lastSignedInAt?.toISOString() ?? null,
      }))}
      proxies={proxies.map((p) => ({ id: p.id, name: p.name, host: p.host, port: p.port, username: p.username, enabled: p.enabled }))}
      viewports={viewports.map((v) => ({ id: v.id, name: v.name, width: v.width, height: v.height, category: v.category }))}
    />
  );
}
