import type { Metadata } from "next";
import { TeamInvite } from "@/components/dashboard/pages/Forms";
import { Card, EmptyState, PageHeader, StatusPill, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

const ROLES = ["Admin", "Founder", "Eng manager", "Engineer", "QA"] as const;
const PERMISSIONS: Array<[string, Record<string, boolean>]> = [
  ["Crawl", { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: true }],
  ["Test Studio", { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: true }],
  ["Suites & Plans", { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: true }],
  ["Environments & Data", { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: false }],
  ["Billing & usage", { Admin: true, Founder: true, "Eng manager": false, Engineer: false, QA: false }],
  ["API Tokens", { Admin: true, Founder: true, "Eng manager": false, Engineer: false, QA: false }],
  ["System audits", { Admin: true, Founder: true, "Eng manager": true, Engineer: false, QA: false }],
];

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireOrgContext();
  const { tab = "users" } = await searchParams;
  const members = await prisma.user.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "asc" } });
  const query = "";
  const filtered = query ? members.filter((m) => m.name.toLowerCase().includes(query) || m.email.toLowerCase().includes(query)) : members;

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
                        <td className="px-5 py-3 font-medium text-slate-800">{m.name}</td>
                        <td className="px-5 py-3 text-slate-500">{m.email}</td>
                        <td className="px-5 py-3 text-slate-500">{m.role}</td>
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
          <div className="overflow-x-auto p-5">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-2 pr-3 font-semibold text-slate-700">Permission</th>
                  {ROLES.map((r) => <th key={r} className="py-2 pr-3 font-semibold text-slate-700">{r}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map(([label, perms]) => (
                  <tr key={label} className="border-b border-slate-50">
                    <td className="py-2 pr-3 text-slate-700">{label}</td>
                    {ROLES.map((r) => <td key={r} className="py-2 pr-3">{perms[r] ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">—</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
