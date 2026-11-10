import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { InviteUserButton } from "@/components/dashboard/pages/TeamParity";
import { PermissionsMatrix } from "@/components/dashboard/pages/TeamClients";
import { TeamTable } from "@/components/dashboard/pages/TeamTable";
import { CqaTabs } from "@/components/contextqa/workspace";
import { CqaIcon, PageHeader, cqaCard } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { initialsOf } from "@/lib/auth";
import { readSettings, requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Team & access" };
export const dynamic = "force-dynamic";

const DEFAULT_PERMS = {
  Crawl: { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: true, "BA / FA": false },
  "Test Studio": { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: true, "BA / FA": true },
  "Suites & Plans": { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: true, "BA / FA": true },
  "Environments & Data": { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: false, "BA / FA": false },
  "Billing & usage": { Admin: true, Founder: true, "Eng manager": false, Engineer: false, QA: false, "BA / FA": false },
  "API Tokens": { Admin: true, Founder: true, "Eng manager": false, Engineer: false, QA: false, "BA / FA": false },
  "System audits": { Admin: true, Founder: true, "Eng manager": true, Engineer: false, QA: false, "BA / FA": false },
} as Record<string, Record<string, boolean>>;

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const ctx = await requirePermission("team");
  const { tab = "users", q = "" } = await searchParams;
  const members = await prisma.user.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "asc" } });
  const filtered = q ? members.filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(q.toLowerCase())) : members;
  const perms = (readSettings(ctx.org) as unknown as { permissions?: typeof DEFAULT_PERMS }).permissions ?? DEFAULT_PERMS;

  return (
    <div className="space-y-4">
      <PageHeader title="Team & access" description="Invite users and manage their roles" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <CqaTabs
          active={tab}
          tabs={[
            { label: "Users", href: "/dashboard/team?tab=users", value: "users" },
            { label: "Roles & Permissions", href: "/dashboard/team?tab=roles", value: "roles" },
          ]}
        />
        <InviteUserButton readOnly={ctx.readOnly} />
      </div>

      {tab === "users" ? (
        <div className="space-y-4">
          <form method="get" className="relative max-w-[360px]">
            <input type="hidden" name="tab" value="users" />
            <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
            <input
              name="q"
              defaultValue={q}
              aria-label="Search users"
              placeholder="Search"
              className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-[13px] text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
            />
          </form>

          <TeamTable
            rows={filtered.map((m) => ({
              id: m.id,
              name: m.name,
              email: m.email,
              avatarInitials: initialsOf(m.name, m.email),
              role: m.role,
              verified: Boolean(m.emailVerifiedAt),
              status: m.status,
            }))}
            currentUserEmail={ctx.user.email}
            readOnly={ctx.readOnly}
          />
        </div>
      ) : (
        <div className={cqaCard}>
          <div className="border-b border-[#f0f1f3] px-4 py-3">
            <h2 className="text-[14px] font-semibold text-[#111827]">Roles &amp; Permissions</h2>
            <p className="mt-0.5 text-[12.5px] text-[#6b7280]">Toggle what each role can access in this workspace. Changes save automatically.</p>
          </div>
          <div className="px-4 py-4">
            <PermissionsMatrix initial={perms as Record<string, Record<string, boolean>>} readOnly={ctx.readOnly} />
          </div>
        </div>
      )}
    </div>
  );
}
