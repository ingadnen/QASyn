"use client";

import { useEffect, useMemo, useState } from "react";
import { ColumnFilter, distinctColumnValues, matchesColumnFilters } from "@/components/contextqa/table-ui";
import { CqaIcon, Modal, cqaBtnPrimary, cqaBtnSecondary, cqaCard, cqaInput, cqaLabel } from "@/components/dashboard/ui";
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

const emptyProvisionDraft = {
  organisationName: "",
  website: "https://www.cgi.com",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
  seats: "25",
  environmentName: "Production",
  environmentUrl: "",
  trialCredits: "250000",
};

const emptyConfigureDraft = {
  plan: "enterprise",
  trialCredits: "",
  grantCredits: "0",
  seats: "25",
  environmentName: "",
  environmentUrl: "",
  ssoEnabled: true,
  slaEnabled: true,
};

export function SuperAdminConsole() {
  const [data, setData] = useState<ConsolePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, OrgDraft>>({});
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provisionDraft, setProvisionDraft] = useState(emptyProvisionDraft);
  const [provisionBusy, setProvisionBusy] = useState(false);
  const [configureOrg, setConfigureOrg] = useState<ConsoleOrg | null>(null);
  const [configureDraft, setConfigureDraft] = useState(emptyConfigureDraft);
  const [configureBusy, setConfigureBusy] = useState(false);
  const [orgFilters, setOrgFilters] = useState<Record<string, string>>({});
  const [userFilters, setUserFilters] = useState<Record<string, string>>({});

  const organisations = useMemo(
    () =>
      (data?.organisations ?? []).filter((org) =>
        matchesColumnFilters(orgFilters, {
          Organisation: `${org.name} ${org.slug}`,
          Plan: org.plan,
          "Credits granted": String(org.trialCredits),
          "Credits used": String(org.creditsUsed),
          Expires: new Date(org.trialEndsAt).toLocaleDateString("en-GB"),
        }),
      ),
    [data, orgFilters],
  );

  const users = useMemo(
    () =>
      (data?.users ?? []).filter((user) =>
        matchesColumnFilters(userFilters, {
          Member: `${user.name} ${user.email}`,
          Organisation: user.organisationName,
          Role: user.role,
          Status: user.status,
        }),
      ),
    [data, userFilters],
  );

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

  async function provisionEnterprise() {
    setProvisionBusy(true);
    try {
      const res = await apiFetch<{
        organisation: ConsoleOrg;
        admin: ConsoleUser;
        environments: Array<{ id: string; name: string; baseUrl: string; isDefault: boolean }>;
      }>("/api/dashboard/super-admin", {
        method: "POST",
        json: {
          action: "create_enterprise_tenant",
          organisationName: provisionDraft.organisationName,
          website: provisionDraft.website,
          adminName: provisionDraft.adminName,
          adminEmail: provisionDraft.adminEmail,
          adminPassword: provisionDraft.adminPassword,
          seats: Number(provisionDraft.seats) || 25,
          environmentName: provisionDraft.environmentName || undefined,
          environmentUrl: provisionDraft.environmentUrl || undefined,
          trialCredits: Number(provisionDraft.trialCredits) || undefined,
        },
      });
      setData((current) =>
        current
          ? {
              ...current,
              organisations: [...current.organisations, res.organisation],
              users: [...current.users, res.admin],
            }
          : current,
      );
      setDrafts((current) => ({
        ...current,
        [res.organisation.id]: {
          plan: res.organisation.plan,
          trialCredits: String(res.organisation.trialCredits),
          creditsUsed: String(res.organisation.creditsUsed),
        },
      }));
      toast(`${res.organisation.name} provisioned · ${res.environments.length} environment(s) · admin ${res.admin.email}.`, "success");
      setProvisionOpen(false);
      setProvisionDraft(emptyProvisionDraft);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setProvisionBusy(false);
    }
  }

  function openConfigure(org: ConsoleOrg) {
    setConfigureOrg(org);
    setConfigureDraft({
      plan: org.plan,
      trialCredits: String(org.trialCredits),
      grantCredits: "0",
      seats: "25",
      environmentName: "",
      environmentUrl: "",
      ssoEnabled: true,
      slaEnabled: true,
    });
  }

  async function configureEnterprise() {
    if (!configureOrg) return;
    setConfigureBusy(true);
    try {
      const res = await apiFetch<{ organisation: ConsoleOrg }>("/api/dashboard/super-admin", {
        method: "POST",
        json: {
          action: "configure_enterprise_plan",
          organisationId: configureOrg.id,
          plan: configureDraft.plan,
          trialCredits: configureDraft.trialCredits ? Number(configureDraft.trialCredits) : undefined,
          grantCredits: Number(configureDraft.grantCredits) || 0,
          seats: Number(configureDraft.seats) || undefined,
          environmentName: configureDraft.environmentName || undefined,
          environmentUrl: configureDraft.environmentUrl || undefined,
          ssoEnabled: configureDraft.ssoEnabled,
          slaEnabled: configureDraft.slaEnabled,
        },
      });
      setData((current) =>
        current
          ? { ...current, organisations: current.organisations.map((row) => (row.id === res.organisation.id ? res.organisation : row)) }
          : current,
      );
      setDrafts((current) => ({
        ...current,
        [res.organisation.id]: {
          plan: res.organisation.plan,
          trialCredits: String(res.organisation.trialCredits),
          creditsUsed: String(res.organisation.creditsUsed),
        },
      }));
      toast(`${res.organisation.name} configured on the ${res.organisation.plan} plan.`, "success");
      setConfigureOrg(null);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setConfigureBusy(false);
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cqaBtnPrimary}
              data-testid="super-admin-provision-enterprise"
              onClick={() => setProvisionOpen(true)}
            >
              <CqaIcon name="add_business" className="text-[16px]" /> Provision enterprise
            </button>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">{data.organisations.length} organisations</span>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-[#e5e7eb] text-[10.5px] uppercase tracking-wide text-[#6b7280]">
                <th className="px-2 py-2">Organisation<ColumnFilter column="Organisation" value={orgFilters.Organisation ?? ""} onChange={(value) => setOrgFilters((current) => ({ ...current, Organisation: value }))} /></th>
                <th className="px-2 py-2">Plan<ColumnFilter column="Plan" value={orgFilters.Plan ?? ""} onChange={(value) => setOrgFilters((current) => ({ ...current, Plan: value }))} options={data.plans} /></th>
                <th className="px-2 py-2">Credits granted<ColumnFilter column="Credits granted" value={orgFilters["Credits granted"] ?? ""} onChange={(value) => setOrgFilters((current) => ({ ...current, "Credits granted": value }))} /></th>
                <th className="px-2 py-2">Credits used<ColumnFilter column="Credits used" value={orgFilters["Credits used"] ?? ""} onChange={(value) => setOrgFilters((current) => ({ ...current, "Credits used": value }))} /></th>
                <th className="px-2 py-2">Expires<ColumnFilter column="Expires" value={orgFilters.Expires ?? ""} onChange={(value) => setOrgFilters((current) => ({ ...current, Expires: value }))} /></th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {organisations.map((org) => {
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
                      <div className="flex items-center gap-1.5">
                        <button type="button" className={cqaBtnPrimary} disabled={busy === `org-${org.id}`} onClick={() => void saveOrganisation(org)}>
                          {busy === `org-${org.id}` ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className={cqaBtnSecondary}
                          data-testid={`super-admin-configure-open-${org.slug}`}
                          onClick={() => openConfigure(org)}
                        >
                          Configure
                        </button>
                      </div>
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
                <th className="px-2 py-2">Member<ColumnFilter column="Member" value={userFilters.Member ?? ""} onChange={(value) => setUserFilters((current) => ({ ...current, Member: value }))} /></th>
                <th className="px-2 py-2">Organisation<ColumnFilter column="Organisation" value={userFilters.Organisation ?? ""} onChange={(value) => setUserFilters((current) => ({ ...current, Organisation: value }))} /></th>
                <th className="px-2 py-2">Role<ColumnFilter column="Role" value={userFilters.Role ?? ""} onChange={(value) => setUserFilters((current) => ({ ...current, Role: value }))} options={data.roles} /></th>
                <th className="px-2 py-2">Status<ColumnFilter column="Status" value={userFilters.Status ?? ""} onChange={(value) => setUserFilters((current) => ({ ...current, Status: value }))} options={distinctColumnValues(data.users.map((user) => user.status))} /></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
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

      <Modal
        open={provisionOpen}
        onClose={() => setProvisionOpen(false)}
        title="Provision an enterprise tenant"
        size="lg"
        footer={
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setProvisionOpen(false)}>Cancel</button>
            <button
              type="button"
              className={cqaBtnPrimary}
              data-testid="super-admin-provision-submit"
              disabled={
                provisionBusy ||
                provisionDraft.organisationName.trim().length < 2 ||
                provisionDraft.adminName.trim().length < 2 ||
                !provisionDraft.adminEmail.trim() ||
                provisionDraft.adminPassword.length < 8
              }
              onClick={() => void provisionEnterprise()}
            >
              {provisionBusy ? "Provisioning…" : "Create enterprise tenant"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[12.5px] leading-5 text-[#6b7280]">
            Creates the organisation on the Enterprise plan, seeds Production and Staging environments, records the credit grant in the ledger and creates a verified Admin account.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={cqaLabel}>Organisation name</span>
              <input className={cqaInput} value={provisionDraft.organisationName} onChange={(e) => setProvisionDraft((current) => ({ ...current, organisationName: e.target.value }))} placeholder="Acme Enterprise" />
            </label>
            <label className="block">
              <span className={cqaLabel}>Website</span>
              <input className={cqaInput} value={provisionDraft.website} onChange={(e) => setProvisionDraft((current) => ({ ...current, website: e.target.value }))} placeholder="https://www.acme.com" />
            </label>
            <label className="block">
              <span className={cqaLabel}>Admin name</span>
              <input className={cqaInput} value={provisionDraft.adminName} onChange={(e) => setProvisionDraft((current) => ({ ...current, adminName: e.target.value }))} placeholder="Jordan Lee" />
            </label>
            <label className="block">
              <span className={cqaLabel}>Admin e-mail</span>
              <input className={cqaInput} type="email" value={provisionDraft.adminEmail} onChange={(e) => setProvisionDraft((current) => ({ ...current, adminEmail: e.target.value }))} placeholder="admin@acme.com" />
            </label>
            <label className="block">
              <span className={cqaLabel}>Temporary password</span>
              <input className={cqaInput} type="password" value={provisionDraft.adminPassword} onChange={(e) => setProvisionDraft((current) => ({ ...current, adminPassword: e.target.value }))} placeholder="At least 8 characters" />
            </label>
            <label className="block">
              <span className={cqaLabel}>Seats</span>
              <input className={cqaInput} type="number" min={1} value={provisionDraft.seats} onChange={(e) => setProvisionDraft((current) => ({ ...current, seats: e.target.value }))} />
            </label>
            <label className="block">
              <span className={cqaLabel}>Environment name</span>
              <input className={cqaInput} value={provisionDraft.environmentName} onChange={(e) => setProvisionDraft((current) => ({ ...current, environmentName: e.target.value }))} placeholder="Production" />
            </label>
            <label className="block">
              <span className={cqaLabel}>Environment URL</span>
              <input className={cqaInput} value={provisionDraft.environmentUrl} onChange={(e) => setProvisionDraft((current) => ({ ...current, environmentUrl: e.target.value }))} placeholder="https://staging.acme.com" />
            </label>
            <label className="block">
              <span className={cqaLabel}>credits</span>
              <input className={cqaInput} type="number" min={0} value={provisionDraft.trialCredits} onChange={(e) => setProvisionDraft((current) => ({ ...current, trialCredits: e.target.value }))} />
            </label>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(configureOrg)}
        onClose={() => setConfigureOrg(null)}
        title={`Configure enterprise · ${configureOrg?.name ?? ""}`}
        size="lg"
        footer={
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setConfigureOrg(null)}>Cancel</button>
            <button
              type="button"
              className={cqaBtnPrimary}
              data-testid="super-admin-configure-enterprise"
              disabled={configureBusy}
              onClick={() => void configureEnterprise()}
            >
              {configureBusy ? "Configuring…" : "Apply enterprise configuration"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[12.5px] leading-5 text-[#6b7280]">
            Update the enterprise plan, grant credits to the ledger, and bind the tenant&apos;s default deployed environment.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={cqaLabel}>Plan</span>
              <select className={cqaInput} value={configureDraft.plan} onChange={(e) => setConfigureDraft((current) => ({ ...current, plan: e.target.value }))}>
                {(data.plans.length ? data.plans : ["enterprise"]).map((plan) => <option key={plan} value={plan}>{plan}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={cqaLabel}>Total credits</span>
              <input className={cqaInput} type="number" min={0} value={configureDraft.trialCredits} onChange={(e) => setConfigureDraft((current) => ({ ...current, trialCredits: e.target.value }))} />
            </label>
            <label className="block">
              <span className={cqaLabel}>Ledger grant</span>
              <input className={cqaInput} type="number" min={0} value={configureDraft.grantCredits} onChange={(e) => setConfigureDraft((current) => ({ ...current, grantCredits: e.target.value }))} />
            </label>
            <label className="block">
              <span className={cqaLabel}>Seats</span>
              <input className={cqaInput} type="number" min={1} value={configureDraft.seats} onChange={(e) => setConfigureDraft((current) => ({ ...current, seats: e.target.value }))} />
            </label>
            <label className="block">
              <span className={cqaLabel}>Environment name</span>
              <input className={cqaInput} value={configureDraft.environmentName} onChange={(e) => setConfigureDraft((current) => ({ ...current, environmentName: e.target.value }))} placeholder="Leave blank to keep current" />
            </label>
            <label className="block">
              <span className={cqaLabel}>Environment URL</span>
              <input className={cqaInput} value={configureDraft.environmentUrl} onChange={(e) => setConfigureDraft((current) => ({ ...current, environmentUrl: e.target.value }))} placeholder="https://staging.acme.com" />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-[12px] text-[#4b5563]">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-3.5 accent-[#5b4ee8]" checked={configureDraft.ssoEnabled} onChange={(e) => setConfigureDraft((current) => ({ ...current, ssoEnabled: e.target.checked }))} />
              SSO enabled
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-3.5 accent-[#5b4ee8]" checked={configureDraft.slaEnabled} onChange={(e) => setConfigureDraft((current) => ({ ...current, slaEnabled: e.target.checked }))} />
              SLA enabled
            </label>
          </div>
        </div>
      </Modal>
    </section>
  );
}
