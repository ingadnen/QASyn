import type { Metadata } from "next";
import { InviteUserButton, MemberActions } from "@/components/dashboard/pages/TeamParity";
import { PermissionsMatrix } from "@/components/dashboard/pages/TeamClients";
import { CqaTabs } from "@/components/contextqa/workspace";
import { CqaIcon, PageHeader, StatusPill, cqaCard } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { readSettings, requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Team & access" };
export const dynamic = "force-dynamic";

const DEFAULT_PERMS = {
  Crawl: { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: true },
  "Test Studio": { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: true },
  "Suites & Plans": { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: true },
  "Environments & Data": { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: false },
  "Billing & usage": { Admin: true, Founder: true, "Eng manager": false, Engineer: false, QA: false },
  "API Tokens": { Admin: true, Founder: true, "Eng manager": false, Engineer: false, QA: false },
  "System audits": { Admin: true, Founder: true, "Eng manager": true, Engineer: false, QA: false },
} as Record<string, Record<string, boolean>>;

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const ctx = await requireOrgContext();
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

          <div className={cqaCard}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#f0f1f3] bg-[#fafafa]">
                    {["NAME", "EMAIL", "ROLES", "VERIFIED", "ADMIN", ""].map((h) => (
                      <th key={h} className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold tracking-[0.08em] text-[#9ca3af]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-14 text-center">
                        <p className="text-[14px] font-medium text-[#374151]">No users found</p>
                        <p className="mt-1 text-[12.5px] text-[#9ca3af]">Invite a teammate to get started.</p>
                      </td>
                    </tr>
                  )}
                  {filtered.map((m) => (
                    <tr key={m.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-7 items-center justify-center rounded-full bg-[#eef2ff] text-[10.5px] font-semibold text-[#5b4ee8]">{m.avatarInitials}</span>
                          <span className="font-medium text-[#1f2937]">{m.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-[#4b5563]">{m.email}</td>
                      <td className="px-4 py-3 text-[12.5px] text-[#6b7280]">{m.role === "Admin" ? "—" : m.role}</td>
                      <td className="px-4 py-3">
                        {m.emailVerifiedAt ? (
                          <CqaIcon name="check_circle" className="text-[18px] text-[#00a63e]" />
                        ) : (
                          <StatusPill value="invited" label="Invited" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] font-medium text-[#4b5563]">{m.role === "Admin" ? "Admin" : "—"}</td>
                      <td className="px-4 py-3">
                        <MemberActions memberId={m.id} memberName={m.name} role={m.role} invited={m.status === "invited"} readOnly={ctx.readOnly || m.email === ctx.user.email} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f1f3] px-4 py-2.5 text-[12px] text-[#6b7280]">
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <select aria-label="Rows per page" className="h-7 rounded border border-[#e5e7eb] bg-white px-1.5 text-[12px]" defaultValue="10">
                  <option>10</option>
                  <option>20</option>
                  <option>50</option>
                </select>
              </div>
              <span className="tabular-nums">1–{filtered.length} of {filtered.length}</span>
            </div>
          </div>
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
