import type { Metadata } from "next";
import Link from "next/link";
import { TeamInvite } from "@/components/dashboard/pages/Forms";
import { RoleChanger, PermissionsMatrix } from "@/components/dashboard/pages/TeamClients";
import { Card, EmptyState, PageHeader, StatusPill, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { readSettings, requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

const DEFAULT_PERMS = {
  "Crawl": { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: true },
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
  const filtered = q ? members.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()) || m.email.toLowerCase().includes(q.toLowerCase())) : members;
  const perms = (readSettings(ctx.org) as unknown as { permissions?: typeof DEFAULT_PERMS }).permissions ?? DEFAULT_PERMS;

  return (
    <div className="space-y-6">
      <PageHeader kicker="SETTINGS · TEAM & ACCESS" title="Team & access" description="Invite users and manage their roles." />
      <nav aria-label="Team sections" className="inline-flex rounded-lg bg-slate-100 p-1">
        {[
          { value: "users", label: "Users" },
          { value: "roles", label: "Roles & Permissions" },
        ].map((o) => (
          <a key={o.value} href={`/dashboard/team?tab=${o.value}`} aria-current={tab === o.value ? "page" : undefined} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${tab === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
            {o.label}
          </a>
        ))}
      </nav>

      {tab === "users" && (
        <>
          <Card title="Invite user"><div className="px-5 py-4"><TeamInvite readOnly={ctx.readOnly} /></div></Card>
          <form action="/dashboard/team" method="get" className="flex gap-2">
            <input type="hidden" name="tab" value="users" />
            <input name="q" defaultValue={q} placeholder="Search users…" className="h-10 max-w-sm flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm" />
            <button type="submit" className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-500">Search</button>
          </form>
          <Card title={`${filtered.length} users`}>
            {filtered.length === 0 ? <EmptyState title="No members" description="Invite your first teammate above." /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] tracking-widest text-slate-400 uppercase">
                      <th className="px-5 py-2">Name</th>
                      <th className="px-5 py-2">Email</th>
                      <th className="px-5 py-2">Roles</th>
                      <th className="px-5 py-2">Verified</th>
                      <th className="px-5 py-2">Admin</th>
                      <th className="px-5 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m) => (
                      <tr key={m.id} className="border-b border-slate-50">
                        <td className="px-5 py-3 font-medium text-slate-800">{m.name} {m.email === ctx.user.email && <span className="text-xs text-slate-400">(you)</span>}</td>
                        <td className="px-5 py-3 text-slate-500">{m.email}</td>
                        <td className="px-5 py-3"><RoleChanger memberId={m.id} role={m.role} readOnly={ctx.readOnly || m.email === ctx.user.email} /></td>
                        <td className="px-5 py-3"><StatusPill value={m.emailVerifiedAt ? "passing" : "invited"} label={m.emailVerifiedAt ? "✓ verified" : "invited"} /></td>
                        <td className="px-5 py-3">{m.role === "Admin" ? <span className="font-semibold text-brand-700">Admin</span> : <span className="text-slate-400">—</span>}</td>
                        <td className="px-5 py-3 text-right">
                          {m.status === "invited" && <ActionButton url={`/api/dashboard/team/${m.id}`} method="DELETE" variant="danger" disabled={ctx.readOnly} confirmText="Revoke this invitation?">Revoke</ActionButton>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === "roles" && (
        <Card title="Roles & Permissions">
          <div className="px-5 py-4"><PermissionsMatrix initial={perms as Record<string, Record<string, boolean>>} readOnly={ctx.readOnly} /></div>
        </Card>
      )}

      <p className="text-xs text-slate-400">Team management mirrors /settings/team-access. Scope: <Link href="/dashboard/settings/api-tokens" className="text-brand-600 hover:underline">API Tokens</Link> · <Link href="/dashboard/settings/audits" className="text-brand-600 hover:underline">System audits</Link></p>
    </div>
  );
}
