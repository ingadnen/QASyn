"use client";

import { useEffect, useState } from "react";
import { CqaIcon, cqaBtnPrimary, cqaCard, cqaInput, cqaLabel } from "@/components/dashboard/ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { toast } from "@/lib/toast";

interface ConsoleOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  trialCredits: number;
  creditsUsed: number;
  trialEndsAt: string;
}

interface ConsoleUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  organisationId: string | null;
  organisationName: string;
}

interface ConsolePayload {
  organisations: ConsoleOrg[];
  users: ConsoleUser[];
  roles: string[];
  plans: string[];
}

type OrgDraft = { plan: string; trialCredits: string; creditsUsed: string };

export function SuperAdminConsole() {
  const [data, setData] = useState<ConsolePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, OrgDraft>>({});

  useEffect(() => {
    let active = true;
    apiFetch<ConsolePayload>("/api/dashboard/super-admin", { method: "GET" })
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setDrafts(
          Object.fromEntries(
            payload.organisations.map((org) => [org.id, { plan: org.plan, trialCredits: String(org.trialCredits), creditsUsed: String(org.creditsUsed) }]),
          ),
        );
      })
      .catch((e) => active && setError(errorMessage(e)));
    return () => {
      active = false;
    };
  }, []);

  async function saveOrganisation(org: ConsoleOrg) {
    const draft = drafts[org.id];
    if (!draft) return;
    setBusy(`org-${org.id}`);
    try {
      const res = await apiFetch<{ organisation: ConsoleOrg }>("/api/dashboard/super-admin", {
        method: "PATCH",
        json: {
          action: "organisation",
          organisationId: org.id,
          plan: draft.plan,
          trialCredits: Number(draft.trialCredits) || 0,
          creditsUsed: Number(draft.creditsUsed) || 0,
        },
      });
      setData((current) => (current ? { ...current, organisations: current.organisations.map((row) => (row.id === org.id ? res.organisation : row)) } : current));
      toast(`${org.name}: plan and credits updated.`, "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  async function saveRole(user: ConsoleUser, role: string) {
    setBusy(`user-${user.id}`);
    try {
      const res = await apiFetch<{ user: ConsoleUser }>("/api/dashboard/super-admin", {
        method: "PATCH",
        json: { action: "user", userId: user.id, role },
      });
      setData((current) =>
        current ? { ...current, users: current.users.map((row) => (row.id === user.id ? { ...row, role: res.user.role } : row)) } : current,
      );
      toast(`${user.email} is now ${role}.`, "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return (
      <section id="super-admin" className={`${cqaCard} mt-6 p-5`}>
        <h2 className="flex items-center gap-2 text-[16px] font-semibold text-[#262626]">👑 Super-Admin Console</h2>
        <p className="mt-1 text-[12.5px] text-[#6b7280]">{error ?? "Loading platform organisations and users…"}</p>
      </section>
    );
  }

  return (
    <section id="super-admin" className="mt-6 space-y-4">
      <div className={`${cqaCard} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-[16px] font-semibold text-[#262626]">👑 Super-Admin Console</h2>
            <p className="mt-1 text-[12.5px] text-[#6b7280]">
              Every organisation, read/write. Change a plan, grant credits, and manage any member role across the platform.
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">{data.organisations.length} organisations</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-[#e5e7eb] text-[10.5px] uppercase tracking-wide text-[#6b7280]">
                <th className="px-2 py-2">Organisation</th>
                <th className="px-2 py-2">Plan</th>
                <th className="px-2 py-2">Credits granted</th>
                <th className="px-2 py-2">Credits used</th>
                <th className="px-2 py-2">Expires</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.organisations.map((org) => {
                const draft = drafts[org.id] ?? { plan: org.plan, trialCredits: String(org.trialCredits), creditsUsed: String(org.creditsUsed) };
                return (
                  <tr key={org.id} className="border-b border-[#f0f1f3] text-[#374151]">
                    <td className="px-2 py-2">
                      <p className="font-medium text-[#111827]">{org.name}</p>
                      <p className="text-[11px] text-[#9ca3af]">/{org.slug}</p>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        aria-label={`Plan for ${org.name}`}
                        className={cqaInput}
                        value={draft.plan}
                        onChange={(e) => setDrafts((current) => ({ ...current, [org.id]: { ...draft, plan: e.target.value } }))}
                      >
                        {data.plans.map((plan) => (
                          <option key={plan} value={plan}>
                            {plan}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Credits granted for ${org.name}`}
                        type="number"
                        className={cqaInput}
                        value={draft.trialCredits}
                        onChange={(e) => setDrafts((current) => ({ ...current, [org.id]: { ...draft, trialCredits: e.target.value } }))}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Credits used for ${org.name}`}
                        type="number"
                        className={cqaInput}
                        value={draft.creditsUsed}
                        onChange={(e) => setDrafts((current) => ({ ...current, [org.id]: { ...draft, creditsUsed: e.target.value } }))}
                      />
                    </td>
                    <td className="px-2 py-2 text-[11.5px] text-[#6b7280]">{new Date(org.trialEndsAt).toLocaleDateString("en-GB")}</td>
                    <td className="px-2 py-2">
                      <button type="button" className={cqaBtnPrimary} disabled={busy === `org-${org.id}`} onClick={() => void saveOrganisation(org)}>
                        {busy === `org-${org.id}` ? "Saving…" : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`${cqaCard} p-5`}>
        <h3 className="text-[15px] font-semibold text-[#262626]">User roles across every organisation</h3>
        <p className="mt-1 text-[12.5px] text-[#6b7280]">Super Admin sits above Admin and keeps every permission.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-[#e5e7eb] text-[10.5px] uppercase tracking-wide text-[#6b7280]">
                <th className="px-2 py-2">Member</th>
                <th className="px-2 py-2">Organisation</th>
                <th className="px-2 py-2">Role</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id} className="border-b border-[#f0f1f3] text-[#374151]">
                  <td className="px-2 py-2">
                    <p className="font-medium text-[#111827]">{user.name}</p>
                    <p className="text-[11px] text-[#9ca3af]">{user.email}</p>
                  </td>
                  <td className="px-2 py-2">{user.organisationName}</td>
                  <td className="px-2 py-2">
                    <select
                      aria-label={`Role for ${user.email}`}
                      className={cqaInput}
                      value={user.role}
                      disabled={busy === `user-${user.id}`}
                      onChange={(e) => void saveRole(user, e.target.value)}
                    >
                      {data.roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-emerald-700">
                      <CqaIcon name="verified_user" className="text-[15px]" /> {user.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
