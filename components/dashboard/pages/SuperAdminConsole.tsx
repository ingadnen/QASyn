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
  website: string;
  trialCredits: number;
  creditsUsed: number;
  trialEndsAt: string;
  activeModel?: string;
  models?: string[];
  integrations?: Array<{ provider: string; status: string; detail: string | null; connectedAt: string }>;
}

interface ConsoleUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  organisationId: string | null;
  organisationName: string;
  creditQuota?: number;
  creditsConsumed?: number;
}

interface PaymentConfigView {
  paypalEnabled: boolean;
  paypalRecipientEmail: string;
  paypalClientId: string;
  paypalMeOrCheckoutUrl: string;
  stripeEnabled: boolean;
  stripeRecipientAccount: string;
  stripePublishableKey: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  invoiceEnabled: boolean;
  invoiceBeneficiaryName: string;
  invoiceRecipientEmail: string;
  invoiceBankDetails: string;
  currency: string;
  mode: string;
}

interface EmailConfigView {
  enabled: boolean;
  provider: "smtp" | "resend";
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassConfigured: boolean;
  smtpPassMasked: string;
  fromAddress: string;
  contactRecipientEmail: string;
  resendApiKeyConfigured: boolean;
  resendApiKeyMasked: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface MailDeliveryLogEntry {
  at: string;
  to: string;
  subject: string;
  provider: string;
  status: string;
  error?: string | null;
}

interface LeadSubmissionView {
  id: string;
  email: string;
  source: string;
  kind: "demo" | "contact" | "career";
  name: string;
  company?: string;
  role?: string;
  jobTitle?: string;
  portfolioUrl?: string;
  message?: string;
  createdAt: string;
  cvFileName?: string;
  cvMimeType?: string;
  coverLetterFileName?: string;
  coverLetterMimeType?: string;
  cvDownloadUrl?: string;
  coverLetterDownloadUrl?: string;
}

interface EmailOutboxView {
  id: string;
  to: string;
  subject: string;
  provider: string;
  status: string;
  error?: string | null;
  createdAt: string;
}

interface ImapMessageView {
  seq: number;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

interface ReplyTarget {
  to: string;
  name: string;
  label: string;
}

interface ConsolePayload {
  organisations: ConsoleOrg[];
  users: ConsoleUser[];
  platformSkills?: Array<{ id: string; name: string; trigger: string; systemPrompt: string; model: string; enabled: boolean }>;
  paymentConfig?: PaymentConfigView;
  emailConfig?: EmailConfigView;
  mailDeliveryLog?: MailDeliveryLogEntry[];
  leadSubmissions?: LeadSubmissionView[];
  emailOutbox?: EmailOutboxView[];
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
  website: "",
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
  const [quotaDrafts, setQuotaDrafts] = useState<Record<string, string>>({});
  const [modelOrg, setModelOrg] = useState("");
  const [modelName, setModelName] = useState("QASyn Vision AI");
  const [skillDraft, setSkillDraft] = useState({ name: "", trigger: "", systemPrompt: "", model: "QASyn Vision AI" });
  const [governanceBusy, setGovernanceBusy] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState<PaymentConfigView | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [emailDraft, setEmailDraft] = useState<EmailConfigView | null>(null);
  const [emailPass, setEmailPass] = useState("");
  const [emailResendKey, setEmailResendKey] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailTestBusy, setEmailTestBusy] = useState(false);
  const [mailDeliveryLog, setMailDeliveryLog] = useState<MailDeliveryLogEntry[]>([]);
  const [leadSubmissions, setLeadSubmissions] = useState<LeadSubmissionView[]>([]);
  const [emailOutbox, setEmailOutbox] = useState<EmailOutboxView[]>([]);
  const [webmailTab, setWebmailTab] = useState<"submissions" | "imap" | "sent">("submissions");
  const [imapMessages, setImapMessages] = useState<ImapMessageView[]>([]);
  const [imapBusy, setImapBusy] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [replySubject, setReplySubject] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);

  const organisations = useMemo(
    () =>
      (data?.organisations ?? []).filter((org) =>
        matchesColumnFilters(orgFilters, {
          Organisation: `${org.name} ${org.slug}`,
          Plan: org.plan,
          "Credits granted": String(org.trialCredits),
          "Credits used": String(org.creditsUsed),
          Expires: new Date(org.trialEndsAt).toLocaleDateString("en-GB"),
          Integrations: (org.integrations ?? []).map((integration) => `${integration.provider} ${integration.status}`).join(" "),
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
          "Token quota": `${user.creditQuota ?? 0} ${user.creditsConsumed ?? 0}`,
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
        setPaymentDraft(payload.paymentConfig ?? null);
        setEmailDraft(payload.emailConfig ?? null);
        setMailDeliveryLog(payload.mailDeliveryLog ?? []);
        setLeadSubmissions(payload.leadSubmissions ?? []);
        setEmailOutbox(payload.emailOutbox ?? []);
        setModelOrg(payload.organisations[0]?.id ?? "");
        setDrafts(
          Object.fromEntries(
            payload.organisations.map((org) => [org.id, { plan: org.plan, trialCredits: String(org.trialCredits), creditsUsed: String(org.creditsUsed) }]),
          ),
        );
        setQuotaDrafts(
          Object.fromEntries(payload.users.map((user) => [user.id, String(user.creditQuota ?? 0)])),
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
      setData((current) =>
        current
          ? {
              ...current,
              organisations: current.organisations.map((row) =>
                row.id === org.id ? { ...row, ...res.organisation, integrations: row.integrations, activeModel: row.activeModel, models: row.models } : row,
              ),
            }
          : current,
      );
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

  async function saveQuota(user: ConsoleUser, quota: number) {
    setBusy(`user-${user.id}`);
    try {
      const res = await apiFetch<{ user: ConsoleUser }>("/api/dashboard/super-admin", {
        method: "PATCH",
        json: { action: "user", userId: user.id, creditQuota: Math.max(0, quota) },
      });
      setData((current) =>
        current
          ? {
              ...current,
              users: current.users.map((row) =>
                row.id === user.id ? { ...row, creditQuota: res.user.creditQuota, creditsConsumed: res.user.creditsConsumed } : row,
              ),
            }
          : current,
      );
      setQuotaDrafts((current) => ({ ...current, [user.id]: String(res.user.creditQuota ?? 0) }));
      toast(`${user.email}: token quota set to ${(res.user.creditQuota ?? 0).toLocaleString("en-US")}.`, "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  function patchPaymentDraft(patch: Partial<PaymentConfigView>) {
    setPaymentDraft((current) => (current ? { ...current, ...patch } : current));
  }

  async function savePaymentConfig() {
    if (!paymentDraft) return;
    setPaymentBusy(true);
    try {
      const result = await apiFetch<{ paymentConfig: PaymentConfigView }>("/api/dashboard/super-admin", {
        method: "PATCH",
        json: { action: "payment_config", ...paymentDraft },
      });
      setPaymentDraft(result.paymentConfig);
      toast(`Payment recipients updated — all checkouts now route to ${result.paymentConfig.paypalRecipientEmail}`, "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setPaymentBusy(false);
    }
  }

  function patchEmailDraft(patch: Partial<EmailConfigView>) {
    setEmailDraft((current) => (current ? { ...current, ...patch } : current));
  }

  async function refreshConsole() {
    const payload = await apiFetch<ConsolePayload>("/api/dashboard/super-admin", { method: "GET" });
    setData(payload);
    setPaymentDraft(payload.paymentConfig ?? null);
    setEmailDraft(payload.emailConfig ?? null);
    setMailDeliveryLog(payload.mailDeliveryLog ?? []);
    setLeadSubmissions(payload.leadSubmissions ?? []);
    setEmailOutbox(payload.emailOutbox ?? []);
  }

  async function saveEmailConfig(options?: { silent?: boolean }): Promise<boolean> {
    if (!emailDraft) return false;
    setEmailBusy(true);
    try {
      const result = await apiFetch<{ emailConfig: EmailConfigView }>("/api/dashboard/super-admin", {
        method: "POST",
        json: {
          action: "update_email_config",
          enabled: emailDraft.enabled,
          provider: emailDraft.provider,
          smtpHost: emailDraft.smtpHost,
          smtpPort: Number(emailDraft.smtpPort) || 465,
          smtpUser: emailDraft.smtpUser,
          smtpPass: emailPass,
          fromAddress: emailDraft.fromAddress,
          contactRecipientEmail: emailDraft.contactRecipientEmail,
          resendApiKey: emailResendKey,
        },
      });
      setEmailDraft(result.emailConfig);
      setEmailPass("");
      setEmailResendKey("");
      if (!options?.silent) toast("Outbound email configuration saved.", "success");
      return true;
    } catch (e) {
      toast(errorMessage(e), "error");
      return false;
    } finally {
      setEmailBusy(false);
    }
  }

  async function testEmailConfig() {
    if (!emailDraft) return;
    setEmailTestBusy(true);
    try {
      const saved = await saveEmailConfig({ silent: true });
      if (!saved) return;
      const result = await apiFetch<{ ok: boolean; provider: string; status: string; recipient: string }>(
        "/api/dashboard/super-admin",
        { method: "POST", json: { action: "test_email_config" } },
      );
      await refreshConsole();
      toast(`Test email ${result.status} via ${result.provider} → ${result.recipient}`, result.status === "sent" ? "success" : "info");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setEmailTestBusy(false);
    }
  }

  function openReply(target: ReplyTarget, subject: string) {
    setReplyTarget(target);
    setReplySubject(subject);
    setReplyMessage("");
  }

  function openLeadReply(lead: LeadSubmissionView) {
    const label = lead.kind === "career" ? "job application" : lead.kind === "demo" ? "demo request" : "message";
    openReply(
      { to: lead.email, name: lead.name, label },
      `Re: QASyn — ${lead.kind === "career" ? "your application" : lead.kind === "demo" ? "your demo request" : "your message"}`,
    );
  }

  function openImapReply(message: ImapMessageView) {
    const email = /<([^>]+)>/.exec(message.from)?.[1] || message.from;
    const name = message.from.replace(/<[^>]+>/, "").trim() || email;
    openReply({ to: email, name, label: "email" }, message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`);
  }

  async function sendWebmailReply() {
    if (!replyTarget || !replySubject.trim() || !replyMessage.trim()) return;
    setReplyBusy(true);
    try {
      const result = await apiFetch<{ ok: boolean; provider: string; status: string; to: string }>(
        "/api/dashboard/super-admin",
        {
          method: "POST",
          json: { action: "send_webmail_reply", to: replyTarget.to, subject: replySubject.trim(), message: replyMessage.trim() },
        },
      );
      await refreshConsole();
      setReplyTarget(null);
      toast(`Reply ${result.status} via ${result.provider} → ${result.to}`, result.status === "sent" ? "success" : "info");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setReplyBusy(false);
    }
  }

  async function syncImapInbox() {
    setImapBusy(true);
    try {
      const result = await apiFetch<{ ok: boolean; messages?: ImapMessageView[]; host?: string }>("/api/dashboard/super-admin", {
        method: "POST",
        json: { action: "sync_imap_inbox" },
      });
      setImapMessages(result.messages ?? []);
      toast(`${result.messages?.length ?? 0} message(s) synced from ${result.host ?? "IMAP"}.`, "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setImapBusy(false);
    }
  }

  async function assignModel() {
    if (!modelOrg || !modelName.trim()) return;
    setGovernanceBusy(true);
    try {
      await apiFetch("/api/dashboard/super-admin", { method: "PATCH", json: { action: "model", organisationId: modelOrg, model: modelName.trim() } });
      setData((current) => current ? { ...current, organisations: current.organisations.map((org) => org.id === modelOrg ? { ...org, activeModel: modelName.trim() } : org) } : current);
      toast("Tenant AI model updated.", "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setGovernanceBusy(false);
    }
  }

  async function createPlatformSkill() {
    if (!skillDraft.name.trim() || skillDraft.systemPrompt.trim().length < 10) return;
    setGovernanceBusy(true);
    try {
      const result = await apiFetch<{ skills: NonNullable<ConsolePayload["platformSkills"]> }>("/api/dashboard/super-admin", {
        method: "PATCH",
        json: { action: "skill", subAction: "create", ...skillDraft },
      });
      setData((current) => current ? { ...current, platformSkills: result.skills } : current);
      setSkillDraft({ name: "", trigger: "", systemPrompt: "", model: "QASyn Vision AI" });
      toast("Platform skill published.", "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setGovernanceBusy(false);
    }
  }

  async function deletePlatformSkill(id: string) {
    setGovernanceBusy(true);
    try {
      const result = await apiFetch<{ skills: NonNullable<ConsolePayload["platformSkills"]> }>("/api/dashboard/super-admin", { method: "PATCH", json: { action: "skill", subAction: "delete", id } });
      setData((current) => current ? { ...current, platformSkills: result.skills } : current);
      toast("Platform skill removed.", "info");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setGovernanceBusy(false);
    }
  }

  async function provisionEnterprise() {    setProvisionBusy(true);
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
      website: org.website ?? "",
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
          website: configureDraft.website || undefined,
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
                <th className="px-2 py-2">Integrations<ColumnFilter column="Integrations" value={orgFilters.Integrations ?? ""} onChange={(value) => setOrgFilters((current) => ({ ...current, Integrations: value }))} /></th>
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
                      <div className="flex max-w-[180px] flex-wrap gap-1">
                        {(org.integrations ?? []).length === 0 && <span className="text-[11px] text-[#9ca3af]">None</span>}
                        {(org.integrations ?? []).map((integration) => (
                          <span
                            key={`${org.id}-${integration.provider}`}
                            title={integration.detail ?? integration.provider}
                            className={integration.status === "CONNECTED" ? "rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700" : "rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"}
                          >
                            {integration.provider}
                          </span>
                        ))}
                      </div>
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
                <th className="px-2 py-2">Token quota<ColumnFilter column="Token quota" value={userFilters["Token quota"] ?? ""} onChange={(value) => setUserFilters((current) => ({ ...current, "Token quota": value }))} /></th>
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
                    <div className="flex items-center gap-1">
                      <input
                        aria-label={`Token quota for ${user.email}`}
                        type="number"
                        min={0}
                        className={`${cqaInput} w-24`}
                        value={quotaDrafts[user.id] ?? String(user.creditQuota ?? 0)}
                        disabled={busy === `user-${user.id}`}
                        onChange={(e) => setQuotaDrafts((current) => ({ ...current, [user.id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="rounded border border-[#d1d5db] px-1.5 py-1 text-[10.5px] font-semibold text-[#4b5563] hover:bg-[#f9fafb]"
                        disabled={busy === `user-${user.id}`}
                        onClick={() => void saveQuota(user, Number(quotaDrafts[user.id] ?? user.creditQuota ?? 0))}
                      >
                        Set
                      </button>
                      <button
                        type="button"
                        className="rounded border border-[#d1d5db] px-1.5 py-1 text-[10.5px] font-semibold text-[#067647] hover:bg-[#ecfdf3]"
                        disabled={busy === `user-${user.id}`}
                        onClick={() => void saveQuota(user, (user.creditQuota ?? 0) + 25_000)}
                      >
                        +25K
                      </button>
                    </div>
                    <p className="mt-1 text-[10.5px] text-[#9ca3af]">{(user.creditsConsumed ?? 0).toLocaleString("en-US")} consumed</p>
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

      <div className={`${cqaCard} p-5`} data-testid="super-admin-payment-config">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-semibold text-[#262626]">💳 Payment Gateways &amp; Payout Recipients (PayPal · Stripe · Interac / Bank)</h2>
            <p className="mt-1 text-[12.5px] text-[#6b7280]">
              Every customer checkout in Billing and Onboarding routes to these recipients. Secret keys are masked when loaded.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            {paymentDraft?.currency ?? "USD"} · {paymentDraft?.mode ?? "live_or_verified"}
          </span>
        </div>

        {paymentDraft ? (
          <div className="mt-4 space-y-5">
            <div className="flex flex-wrap gap-4 text-[12px] text-[#374151]">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={paymentDraft.paypalEnabled} onChange={(e) => patchPaymentDraft({ paypalEnabled: e.target.checked })} /> PayPal enabled</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={paymentDraft.stripeEnabled} onChange={(e) => patchPaymentDraft({ stripeEnabled: e.target.checked })} /> Stripe enabled</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={paymentDraft.invoiceEnabled} onChange={(e) => patchPaymentDraft({ invoiceEnabled: e.target.checked })} /> Invoice / Interac enabled</label>
            </div>

            <section className="rounded-lg border border-[#e5e7eb] p-3">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7280]">PayPal</h3>
              <div className="mt-2 grid gap-3 lg:grid-cols-3">
                <label className="block">
                  <span className={cqaLabel}>PayPal Recipient Email (Destinataire PayPal)</span>
                  <input data-testid="super-admin-paypal-recipient" className={cqaInput} value={paymentDraft.paypalRecipientEmail} onChange={(e) => patchPaymentDraft({ paypalRecipientEmail: e.target.value })} placeholder="ingrebhiadnen@gmail.com" />
                </label>
                <label className="block">
                  <span className={cqaLabel}>PayPal Client ID (Optional Live SDK)</span>
                  <input className={cqaInput} value={paymentDraft.paypalClientId} onChange={(e) => patchPaymentDraft({ paypalClientId: e.target.value })} placeholder="AX..." />
                </label>
                <label className="block">
                  <span className={cqaLabel}>PayPal Checkout URL</span>
                  <input className={cqaInput} value={paymentDraft.paypalMeOrCheckoutUrl} onChange={(e) => patchPaymentDraft({ paypalMeOrCheckoutUrl: e.target.value })} placeholder="https://www.paypal.com/cgi-bin/webscr" />
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-[#e5e7eb] p-3">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7280]">Stripe / Card</h3>
              <div className="mt-2 grid gap-3 lg:grid-cols-2">
                <label className="block">
                  <span className={cqaLabel}>Stripe Merchant / Payout Account Email</span>
                  <input data-testid="super-admin-stripe-recipient" className={cqaInput} value={paymentDraft.stripeRecipientAccount} onChange={(e) => patchPaymentDraft({ stripeRecipientAccount: e.target.value })} placeholder="ingrebhiadnen@gmail.com" />
                </label>
                <label className="block">
                  <span className={cqaLabel}>Stripe Publishable Key (pk_...)</span>
                  <input className={cqaInput} value={paymentDraft.stripePublishableKey} onChange={(e) => patchPaymentDraft({ stripePublishableKey: e.target.value })} placeholder="pk_live_..." />
                </label>
                <label className="block">
                  <span className={cqaLabel}>Stripe Secret Key (sk_..., masked)</span>
                  <input type="password" className={cqaInput} value={paymentDraft.stripeSecretKey} onChange={(e) => patchPaymentDraft({ stripeSecretKey: e.target.value })} placeholder="sk_live_..." />
                </label>
                <label className="block">
                  <span className={cqaLabel}>Stripe Webhook Secret (whsec_..., masked)</span>
                  <input type="password" className={cqaInput} value={paymentDraft.stripeWebhookSecret} onChange={(e) => patchPaymentDraft({ stripeWebhookSecret: e.target.value })} placeholder="whsec_..." />
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-[#e5e7eb] p-3">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7280]">Invoice / Interac / Bank</h3>
              <div className="mt-2 grid gap-3 lg:grid-cols-3">
                <label className="block">
                  <span className={cqaLabel}>Beneficiary Name</span>
                  <input className={cqaInput} value={paymentDraft.invoiceBeneficiaryName} onChange={(e) => patchPaymentDraft({ invoiceBeneficiaryName: e.target.value })} placeholder="QASyn Inc." />
                </label>
                <label className="block">
                  <span className={cqaLabel}>Invoice / Interac Recipient Email</span>
                  <input className={cqaInput} value={paymentDraft.invoiceRecipientEmail} onChange={(e) => patchPaymentDraft({ invoiceRecipientEmail: e.target.value })} placeholder="ingrebhiadnen@gmail.com" />
                </label>
                <label className="block">
                  <span className={cqaLabel}>Currency</span>
                  <select className={cqaInput} value={paymentDraft.currency} onChange={(e) => patchPaymentDraft({ currency: e.target.value })}>
                    <option value="USD">USD</option>
                    <option value="CAD">CAD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>
                <label className="block lg:col-span-2">
                  <span className={cqaLabel}>Bank Instructions</span>
                  <input className={cqaInput} value={paymentDraft.invoiceBankDetails} onChange={(e) => patchPaymentDraft({ invoiceBankDetails: e.target.value })} placeholder="RBC Royal Bank · Interac e-Transfer: ..." />
                </label>
                <label className="block">
                  <span className={cqaLabel}>Mode</span>
                  <select className={cqaInput} value={paymentDraft.mode} onChange={(e) => patchPaymentDraft({ mode: e.target.value })}>
                    <option value="live_or_verified">live_or_verified</option>
                    <option value="live">live</option>
                    <option value="sandbox">sandbox</option>
                  </select>
                </label>
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" data-testid="super-admin-save-payment-config" className={cqaBtnPrimary} disabled={paymentBusy} onClick={() => void savePaymentConfig()}>
                {paymentBusy ? "Saving…" : "Save Payment Recipients"}
              </button>
              <p className="text-[11px] text-[#6b7280]">PayPal {paymentDraft.paypalRecipientEmail} · Stripe {paymentDraft.stripeRecipientAccount} · Interac {paymentDraft.invoiceRecipientEmail}</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-[12.5px] text-[#6b7280]">Loading payment configuration…</p>
        )}
      </div>

      <div className={`${cqaCard} p-5`} data-testid="super-admin-email-config">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-semibold text-[#262626]">✉️ Outbound Email &amp; SMTP Configuration (qasyn.com / qasyn.io)</h2>
            <p className="mt-1 text-[12.5px] text-[#6b7280]">
              Configure the platform mailer used for verification codes, contact requests, demo requests and careers notifications. Secrets are encrypted at rest.
            </p>
          </div>
          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
            {emailDraft?.enabled ? "Enabled" : "Disabled"} · {emailDraft?.provider ?? "smtp"}
          </span>
        </div>

        {emailDraft ? (
          <div className="mt-4 space-y-5">
            <label className="inline-flex items-center gap-2 text-[12px] text-[#374151]">
              <input
                type="checkbox"
                checked={emailDraft.enabled}
                onChange={(e) => patchEmailDraft({ enabled: e.target.checked })}
              />
              Outbound email enabled
            </label>

            <div className="grid gap-3 lg:grid-cols-3">
              <label className="block">
                <span className={cqaLabel}>Provider</span>
                <select
                  data-testid="super-admin-email-provider"
                  className={cqaInput}
                  value={emailDraft.provider}
                  onChange={(e) => patchEmailDraft({ provider: e.target.value as "smtp" | "resend" })}
                >
                  <option value="smtp">SMTP</option>
                  <option value="resend">Resend</option>
                </select>
              </label>
              <label className="block">
                <span className={cqaLabel}>SMTP Host</span>
                <input
                  data-testid="super-admin-email-smtp-host"
                  className={cqaInput}
                  value={emailDraft.smtpHost}
                  onChange={(e) => patchEmailDraft({ smtpHost: e.target.value })}
                  placeholder="mailserver.businessidentity.llc"
                />
              </label>
              <label className="block">
                <span className={cqaLabel}>SMTP Port</span>
                <input
                  data-testid="super-admin-email-smtp-port"
                  className={cqaInput}
                  type="number"
                  min={1}
                  max={65_535}
                  value={emailDraft.smtpPort}
                  onChange={(e) => patchEmailDraft({ smtpPort: Number(e.target.value) || 465 })}
                />
              </label>
              <label className="block">
                <span className={cqaLabel}>SMTP Username</span>
                <input
                  data-testid="super-admin-email-smtp-user"
                  className={cqaInput}
                  value={emailDraft.smtpUser}
                  onChange={(e) => patchEmailDraft({ smtpUser: e.target.value })}
                  placeholder="info@qasyn.io"
                />
              </label>
              <label className="block">
                <span className={cqaLabel}>SMTP Password (masked when saved)</span>
                <input
                  data-testid="super-admin-email-smtp-pass"
                  className={cqaInput}
                  type="password"
                  value={emailPass}
                  onChange={(e) => setEmailPass(e.target.value)}
                  placeholder={emailDraft.smtpPassConfigured ? emailDraft.smtpPassMasked : "Enter SMTP password"}
                />
              </label>
              <label className="block">
                <span className={cqaLabel}>From Address</span>
                <input
                  data-testid="super-admin-email-from"
                  className={cqaInput}
                  value={emailDraft.fromAddress}
                  onChange={(e) => patchEmailDraft({ fromAddress: e.target.value })}
                  placeholder="QASyn <info@qasyn.io>"
                />
              </label>
              <label className="block lg:col-span-2">
                <span className={cqaLabel}>Internal Lead &amp; Careers Notification Recipient</span>
                <input
                  data-testid="super-admin-email-recipient"
                  className={cqaInput}
                  type="email"
                  value={emailDraft.contactRecipientEmail}
                  onChange={(e) => patchEmailDraft({ contactRecipientEmail: e.target.value })}
                  placeholder="leads@qasyn.io"
                />
              </label>
              <label className="block">
                <span className={cqaLabel}>Resend API Key (masked when saved)</span>
                <input
                  data-testid="super-admin-email-resend-key"
                  className={cqaInput}
                  type="password"
                  value={emailResendKey}
                  onChange={(e) => setEmailResendKey(e.target.value)}
                  placeholder={emailDraft.resendApiKeyConfigured ? emailDraft.resendApiKeyMasked : "re_..."}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="super-admin-save-email-config"
                className={cqaBtnPrimary}
                disabled={emailBusy}
                onClick={() => void saveEmailConfig()}
              >
                {emailBusy ? "Saving…" : "Save Email Configuration"}
              </button>
              <button
                type="button"
                data-testid="super-admin-test-email"
                className={cqaBtnSecondary}
                disabled={emailTestBusy}
                onClick={() => void testEmailConfig()}
              >
                {emailTestBusy ? "Sending…" : "Send Test Email"}
              </button>
              <p className="text-[11px] text-[#6b7280]">
                Leave the password or Resend key blank to preserve the stored secret.
                {emailDraft.updatedAt ? ` Last updated ${new Date(emailDraft.updatedAt).toLocaleString("en-GB")}${emailDraft.updatedBy ? ` by ${emailDraft.updatedBy}` : ""}.` : ""}
              </p>
            </div>

            <div>
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7280]">Live delivery log</h3>
              <div className="mt-2 overflow-x-auto">
                <table
                  className="w-full min-w-[640px] border-collapse text-left text-[12px]"
                  data-testid="super-admin-mail-delivery-log"
                >
                  <thead>
                    <tr className="border-b border-[#e5e7eb] text-[10.5px] uppercase tracking-wide text-[#6b7280]">
                      <th className="px-2 py-2">Time</th>
                      <th className="px-2 py-2">Recipient</th>
                      <th className="px-2 py-2">Subject</th>
                      <th className="px-2 py-2">Provider</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mailDeliveryLog.map((entry, index) => (
                      <tr key={`${entry.at}-${index}`} className="border-b border-[#f0f1f3] text-[#374151]">
                        <td className="px-2 py-2 text-[11.5px] text-[#6b7280]">{new Date(entry.at).toLocaleString("en-GB")}</td>
                        <td className="px-2 py-2">{entry.to}</td>
                        <td className="max-w-[260px] truncate px-2 py-2" title={entry.subject}>{entry.subject}</td>
                        <td className="px-2 py-2">{entry.provider}</td>
                        <td className="px-2 py-2">
                          <span className={entry.status === "sent" ? "rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700" : entry.status === "failed" ? "rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700" : "rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"}>
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {mailDeliveryLog.length === 0 && (
                      <tr>
                        <td className="px-2 py-3 text-[12px] text-[#9ca3af]" colSpan={5}>No deliveries logged yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-[12.5px] text-[#6b7280]">Loading email configuration…</p>
        )}
      </div>

      <div id="webmail-inbox" className={`${cqaCard} p-5`} data-testid="super-admin-webmail-inbox">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-semibold text-[#262626]">📬 Webmail &amp; Candidatures Inbox</h2>
            <p className="mt-1 text-[12.5px] text-[#6b7280]">
              Leads, demo requests, job applications, CV downloads, live IMAP mail and delivery logs in one place.
            </p>
          </div>
          <a
            href="https://mailserver.businessidentity.llc"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-[11.5px] font-semibold text-[#4b5563] hover:bg-[#f9fafb]"
          >
            Launch Northwest Webmail ↗
          </a>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { id: "submissions" as const, label: "Submissions & Candidatures (Leads, Demos & CVs)" },
            { id: "imap" as const, label: "Live IMAP Inbox (mailserver.businessidentity.llc)" },
            { id: "sent" as const, label: "Sent & Outbox Log" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-testid={`super-admin-webmail-tab-${tab.id}`}
              onClick={() => setWebmailTab(tab.id)}
              className={
                webmailTab === tab.id
                  ? "rounded-full bg-[#5b4ee8] px-3 py-1.5 text-[11.5px] font-semibold text-white"
                  : "rounded-full border border-[#d1d5db] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#4b5563] hover:bg-[#f9fafb]"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {webmailTab === "submissions" && (
          <div className="mt-4 space-y-3" data-testid="super-admin-webmail-submissions">
            {leadSubmissions.map((lead) => {
              const badge = lead.kind === "career" ? "Job Application" : lead.kind === "demo" ? "Demo Request" : "Contact";
              const badgeClass =
                lead.kind === "career"
                  ? "bg-violet-50 text-violet-700"
                  : lead.kind === "demo"
                    ? "bg-sky-50 text-sky-700"
                    : "bg-slate-100 text-slate-600";
              return (
                <article key={lead.id} className="rounded-lg border border-[#e5e7eb] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>{badge}</span>
                    <p className="text-[12.5px] font-semibold text-[#111827]">{lead.name}</p>
                    <p className="text-[11.5px] text-[#6b7280]">{lead.email}</p>
                    <p className="ml-auto text-[10.5px] text-[#9ca3af]">{new Date(lead.createdAt).toLocaleString("en-GB")}</p>
                  </div>
                  {(lead.company || lead.jobTitle || lead.role) && (
                    <p className="mt-1 text-[11.5px] text-[#6b7280]">
                      {[lead.company, lead.jobTitle, lead.role].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {lead.message && <p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-[#374151]">{lead.message}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {lead.cvDownloadUrl && (
                      <a
                        href={lead.cvDownloadUrl}
                        data-testid={`webmail-download-cv-${lead.id}`}
                        className="rounded border border-[#d1d5db] px-2 py-1 text-[10.5px] font-semibold text-[#4b5563] hover:bg-[#f9fafb]"
                      >
                        Download CV{lead.cvFileName ? ` · ${lead.cvFileName}` : ""}
                      </a>
                    )}
                    {lead.coverLetterDownloadUrl && (
                      <a
                        href={lead.coverLetterDownloadUrl}
                        data-testid={`webmail-download-cover-${lead.id}`}
                        className="rounded border border-[#d1d5db] px-2 py-1 text-[10.5px] font-semibold text-[#4b5563] hover:bg-[#f9fafb]"
                      >
                        Download Cover Letter{lead.coverLetterFileName ? ` · ${lead.coverLetterFileName}` : ""}
                      </a>
                    )}
                    <button
                      type="button"
                      data-testid={`webmail-reply-${lead.id}`}
                      className="rounded border border-[#5b4ee8] px-2 py-1 text-[10.5px] font-semibold text-[#5b4ee8] hover:bg-[#f5f3ff]"
                      onClick={() => openLeadReply(lead)}
                    >
                      Reply by Email
                    </button>
                  </div>
                </article>
              );
            })}
            {leadSubmissions.length === 0 && <p className="text-[12px] text-[#9ca3af]">No submissions yet.</p>}
          </div>
        )}

        {webmailTab === "imap" && (
          <div className="mt-4" data-testid="super-admin-webmail-imap">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="super-admin-sync-imap"
                className={cqaBtnPrimary}
                disabled={imapBusy}
                onClick={() => void syncImapInbox()}
              >
                {imapBusy ? "Syncing…" : "Sync Live IMAP Inbox"}
              </button>
              <a
                href="https://mailserver.businessidentity.llc"
                target="_blank"
                rel="noreferrer"
                className="text-[11.5px] font-semibold text-[#5b4ee8] hover:underline"
              >
                Open External Webmail (mailserver.businessidentity.llc) ↗
              </a>
            </div>
            <div className="mt-3 space-y-2">
              {imapMessages.map((message) => (
                <article key={`${message.seq}-${message.subject}`} className="rounded-lg border border-[#e5e7eb] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12.5px] font-semibold text-[#111827]">{message.subject}</p>
                    <p className="ml-auto text-[10.5px] text-[#9ca3af]">{message.date}</p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#6b7280]">{message.from}</p>
                  <p className="mt-2 text-[12px] leading-5 text-[#374151]">{message.snippet || "No preview available."}</p>
                  <button
                    type="button"
                    className="mt-2 rounded border border-[#5b4ee8] px-2 py-1 text-[10.5px] font-semibold text-[#5b4ee8] hover:bg-[#f5f3ff]"
                    onClick={() => openImapReply(message)}
                  >
                    Compose / Reply
                  </button>
                </article>
              ))}
              {imapMessages.length === 0 && (
                <p className="text-[12px] text-[#9ca3af]">
                  No live IMAP messages loaded. Save the SMTP mailbox credentials, then click Sync Live IMAP Inbox.
                </p>
              )}
            </div>
          </div>
        )}

        {webmailTab === "sent" && (
          <div className="mt-4 space-y-5" data-testid="super-admin-webmail-sent">
            <div>
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7280]">Live delivery log</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-[#e5e7eb] text-[10.5px] uppercase tracking-wide text-[#6b7280]">
                      <th className="px-2 py-2">Time</th>
                      <th className="px-2 py-2">Recipient</th>
                      <th className="px-2 py-2">Subject</th>
                      <th className="px-2 py-2">Provider</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mailDeliveryLog.map((entry, index) => (
                      <tr key={`${entry.at}-${index}`} className="border-b border-[#f0f1f3] text-[#374151]">
                        <td className="px-2 py-2 text-[11.5px] text-[#6b7280]">{new Date(entry.at).toLocaleString("en-GB")}</td>
                        <td className="px-2 py-2">{entry.to}</td>
                        <td className="max-w-[260px] truncate px-2 py-2" title={entry.subject}>{entry.subject}</td>
                        <td className="px-2 py-2">{entry.provider}</td>
                        <td className="px-2 py-2">{entry.status}</td>
                      </tr>
                    ))}
                    {mailDeliveryLog.length === 0 && (
                      <tr>
                        <td className="px-2 py-3 text-[12px] text-[#9ca3af]" colSpan={5}>No deliveries logged yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7280]">Recent EmailOutbox items</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-[12px]" data-testid="super-admin-email-outbox">
                  <thead>
                    <tr className="border-b border-[#e5e7eb] text-[10.5px] uppercase tracking-wide text-[#6b7280]">
                      <th className="px-2 py-2">Time</th>
                      <th className="px-2 py-2">Recipient</th>
                      <th className="px-2 py-2">Subject</th>
                      <th className="px-2 py-2">Provider</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailOutbox.map((entry) => (
                      <tr key={entry.id} className="border-b border-[#f0f1f3] text-[#374151]">
                        <td className="px-2 py-2 text-[11.5px] text-[#6b7280]">{new Date(entry.createdAt).toLocaleString("en-GB")}</td>
                        <td className="px-2 py-2">{entry.to}</td>
                        <td className="max-w-[240px] truncate px-2 py-2" title={entry.subject}>{entry.subject}</td>
                        <td className="px-2 py-2">{entry.provider}</td>
                        <td className="px-2 py-2">{entry.status}</td>
                        <td className="max-w-[180px] truncate px-2 py-2 text-[11px] text-[#b42318]" title={entry.error ?? ""}>{entry.error || "—"}</td>
                      </tr>
                    ))}
                    {emailOutbox.length === 0 && (
                      <tr>
                        <td className="px-2 py-3 text-[12px] text-[#9ca3af]" colSpan={6}>No outbox items yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`${cqaCard} p-5`} data-testid="super-admin-governance">
        <h2 className="text-[16px] font-semibold text-[#262626]">Tenant AI models &amp; platform skills governance</h2>
        <p className="mt-1 text-[12.5px] text-[#6b7280]">Assign the active AI model for any tenant and publish platform-wide agent skills.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label className="block">
            <span className={cqaLabel}>Tenant</span>
            <select className={cqaInput} value={modelOrg} onChange={(e) => setModelOrg(e.target.value)}>
              {data.organisations.map((org) => <option key={org.id} value={org.id}>{org.name} · {org.activeModel ?? "QASyn Vision AI"}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={cqaLabel}>Active AI model</span>
            <input className={cqaInput} value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="QASyn Vision AI · Claude · DeepSeek · custom" />
          </label>
          <button type="button" data-testid="super-admin-assign-model" className={cqaBtnPrimary} disabled={governanceBusy || !modelOrg} onClick={() => void assignModel()}>Assign model</button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">Platform skills</p>
            <ul className="mt-2 divide-y divide-[#f0f1f3] rounded-lg border border-[#e5e7eb]">
              {(data.platformSkills ?? []).map((skill) => (
                <li key={skill.id} className="flex items-center gap-2 px-3 py-2 text-[12px]">
                  <span className={skill.enabled ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-slate-300"} />
                  <span className="font-semibold text-[#111827]">{skill.name}</span>
                  <span className="truncate text-[#6b7280]">{skill.model}</span>
                  <button type="button" className="ml-auto text-[11px] font-semibold text-[#b42318] hover:underline" disabled={governanceBusy} onClick={() => void deletePlatformSkill(skill.id)}>Remove</button>
                </li>
              ))}
              {(data.platformSkills ?? []).length === 0 && <li className="px-3 py-2 text-[12px] text-[#9ca3af]">No platform skill published yet.</li>}
            </ul>
          </div>
          <div className="space-y-2">
            <input className={cqaInput} value={skillDraft.name} onChange={(e) => setSkillDraft((current) => ({ ...current, name: e.target.value }))} placeholder="Skill name" />
            <input className={cqaInput} value={skillDraft.trigger} onChange={(e) => setSkillDraft((current) => ({ ...current, trigger: e.target.value }))} placeholder="Trigger" />
            <textarea className={cqaInput} rows={3} value={skillDraft.systemPrompt} onChange={(e) => setSkillDraft((current) => ({ ...current, systemPrompt: e.target.value }))} placeholder="System prompt / Markdown rules" />
            <button type="button" data-testid="super-admin-create-skill" className={cqaBtnPrimary} disabled={governanceBusy || !skillDraft.name.trim() || skillDraft.systemPrompt.trim().length < 10} onClick={() => void createPlatformSkill()}>Publish platform skill</button>
          </div>
        </div>
      </div>

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
              <span className={cqaLabel}>Website (https://...)</span>
              <input className={cqaInput} value={configureDraft.website} onChange={(e) => setConfigureDraft((current) => ({ ...current, website: e.target.value }))} placeholder="https://www.bdc.ca" />
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

      <Modal
        open={Boolean(replyTarget)}
        onClose={() => setReplyTarget(null)}
        title={`Reply by email · ${replyTarget?.name ?? ""}`}
        size="lg"
        footer={
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setReplyTarget(null)}>Cancel</button>
            <button
              type="button"
              className={cqaBtnPrimary}
              data-testid="super-admin-send-webmail-reply"
              disabled={replyBusy || !replySubject.trim() || !replyMessage.trim()}
              onClick={() => void sendWebmailReply()}
            >
              {replyBusy ? "Sending…" : "Send reply"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[12.5px] text-[#6b7280]">
            To <strong className="text-[#111827]">{replyTarget?.to}</strong> · {replyTarget?.label}
          </p>
          <label className="block">
            <span className={cqaLabel}>Subject</span>
            <input
              data-testid="super-admin-webmail-reply-subject"
              className={cqaInput}
              value={replySubject}
              onChange={(e) => setReplySubject(e.target.value)}
            />
          </label>
          <label className="block">
            <span className={cqaLabel}>Message</span>
            <textarea
              data-testid="super-admin-webmail-reply-message"
              className={`${cqaInput} min-h-[160px]`}
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Write your reply…"
            />
          </label>
        </div>
      </Modal>
    </section>
  );
}
