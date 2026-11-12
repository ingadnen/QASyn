import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { SystemAuditsTable, type AuditRow } from "@/components/dashboard/pages/SystemAuditsTable";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "System Audits" };
export const dynamic = "force-dynamic";

function moduleFor(action: string): string {
  const prefix = action.split(".")[0] ?? "";
  const map: Record<string, string> = {
    test_case: "Test case",
    test_suite: "Test suite",
    suite: "Test suite",
    test_plan: "Test plan",
    test_component: "Test case",
    schedule: "Test plan",
    environment: "Environment",
    crawl: "Crawl",
    requirement: "Requirement",
    knowledge: "Knowledge Base",
    api_token: "API token",
    settings: "Settings",
    integration: "Integration",
    team: "Team",
    member: "Team",
    steps: "Test case",
    proxy_profile: "Proxy profile",
    remote_browser: "Remote browser",
    viewport: "Viewport",
    data_profile: "Data profile",
    auth_profile: "Auth profile",
    global_variable: "Global variable",
  };
  return map[prefix] ?? "Workspace";
}

function detailFor(actor: string, action: string, module: string, target: string): string {
  const t = target.trim();
  if (/^(created|updated|revoked|deleted|performed|System|Adnen|A |An |The )/i.test(t)) return `${actor} ${t}`;
  const verb = action.split(".")[1] ?? "updated";
  if (verb === "created") return `${actor} created ${module} with data: ${t}`;
  if (verb === "updated") return `${actor} updated ${module} with data: ${t}`;
  if (verb === "deleted" || verb === "revoked") return `${actor} deleted ${module} with data: ${t}`;
  return `${actor} performed ${verb.toUpperCase()} action on ${module}`;
}

function formatStamp(date: Date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
}

export default async function AuditsPage() {
  const ctx = await requirePermission("audits");
  const [logs, users] = await Promise.all([
    prisma.systemAuditLog.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ where: { organisationId: ctx.org.id }, select: { name: true, email: true } }),
  ]);
  const nameByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.name]));
  const ordinals = new Map<string, number>();
  const moduleCount = new Map<string, number>();
  const withId = logs.map((log) => {
    const module = moduleFor(log.action);
    const next = (moduleCount.get(module) ?? 0) + 1;
    moduleCount.set(module, next);
    ordinals.set(log.id, next);
    return { log, module };
  });

  const rows: AuditRow[] = withId
    .map(({ log, module }) => {
      const actor = nameByEmail.get(log.actorEmail.toLowerCase()) ?? ctx.user.name;
      return {
        id: log.id,
        date: formatStamp(log.createdAt),
        module,
        moduleId: `${module}-${ordinals.get(log.id)}`,
        details: detailFor(actor, log.action, module, log.target),
      };
    })
    .reverse();

  return (
    <div>
      <h1 className="mb-5 text-[20px] font-bold leading-7 text-[#101828]">System Audits</h1>
      <SystemAuditsTable rows={rows} />
    </div>
  );
}
