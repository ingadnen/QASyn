"use client";

import { useEffect, useMemo, useState } from "react";
import { CqaIcon, Modal, cqaBtnPrimary, cqaBtnSecondary, cqaCard, cqaInput, cqaLabel } from "@/components/dashboard/ui";
import { BiviaObservatory } from "@/components/dashboard/pages/BiviaObservatory";
import type { AzureSyncSummary } from "@/components/dashboard/pages/AzureDevOpsSyncButton";
import { apiFetch, errorMessage } from "@/lib/api";
import { parseAzureDevOpsUrl } from "@/lib/azure-devops";
import type { BiviaObservatorySummary } from "@/lib/bivia-telemetry";
import {
  INTEGRATION_PROVIDERS,
  type IntegrationCategory,
  type IntegrationDefinition,
  type IntegrationField,
} from "@/lib/integration-providers";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export interface IntegrationRow {
  provider: string;
  status: string;
  detail: string | null;
  config: Record<string, string>;
  lastSyncAt: string | null;
  connectedAt: string;
}

const TABS: IntegrationCategory[] = ["All Plugins", "Bug Reporting", "Product Management", "AI & Verification"];

function BrandMark({ definition }: { definition: IntegrationDefinition }) {
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-bold tracking-[-0.02em] text-white"
      style={{ backgroundColor: definition.color, color: definition.fg ?? "#fff" }}
    >
      {definition.mark}
    </span>
  );
}

function ConnectedPill({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
        connected ? "bg-[#ecfdf3] text-[#067647]" : "bg-[#f3f4f6] text-[#6b7280]",
      )}
    >
      <span className={cn("size-1.5 rounded-full", connected ? "bg-[#17b26a]" : "bg-[#9ca3af]")} />
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

function formatWhen(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
}

function fieldInput(field: IntegrationField, value: string, onChange: (value: string) => void, disabled: boolean) {
  if (field.type === "textarea") {
    return (
      <textarea
        className={cn(cqaInput, "h-20 resize-y py-2")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        required={field.required}
        disabled={disabled}
        aria-label={field.label}
      />
    );
  }
  if (field.type === "select" && field.options) {
    return (
      <select
        className={cqaInput}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        disabled={disabled}
        aria-label={field.label}
      >
        <option value="">Select…</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className={cqaInput}
      type={field.type === "password" ? "password" : field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      required={field.required}
      disabled={disabled}
      min={field.type === "number" ? field.min : undefined}
      max={field.type === "number" ? field.max : undefined}
      step={field.type === "number" ? field.step : undefined}
      autoComplete={field.type === "password" ? "new-password" : "off"}
      aria-label={field.label}
    />
  );
}

function ConfigureModal({
  definition,
  row,
  readOnly,
  biviaReady,
  onClose,
  onSaved,
}: {
  definition: IntegrationDefinition;
  row: IntegrationRow | undefined;
  readOnly: boolean;
  biviaReady: boolean;
  onClose: () => void;
  onSaved: (row: IntegrationRow) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of definition.fields) {
      initial[field.key] = row?.config?.[field.key] ?? field.defaultValue ?? "";
    }
    return initial;
  });
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Array<{ label: string; ok: boolean }> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [effects, setEffects] = useState<string[] | null>(null);
  const [syncPending, setSyncPending] = useState(false);
  const [syncSummary, setSyncSummary] = useState<AzureSyncSummary | null>(null);
  const connected = row?.status === "CONNECTED" || row?.status === "INDEXING";
  const biviaLive = definition.key === "BIVIA" && biviaReady;
  const effectivelyConnected = connected || biviaLive;
  const badge = effectivelyConnected ? "Pro · Connected" : "Pro · Available";

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const field of definition.fields) {
      initial[field.key] = row?.config?.[field.key] ?? field.defaultValue ?? "";
    }
    setForm(initial);
    setChecks(null);
    setMessage(null);
    setEffects(null);
    setSyncSummary(null);
    setError(null);
  }, [definition]);

  async function call(action: "test" | "connect" | "sync" | "disconnect") {
    setPending(action);
    setError(null);
    setMessage(null);
    setEffects(null);
    try {
      const result = await apiFetch<{
        ok?: boolean;
        message?: string;
        checks?: Array<{ label: string; ok: boolean }>;
        effects?: string[];
        connected?: boolean;
        integration?: IntegrationRow;
      }>("/api/dashboard/integrations", {
        method: "POST",
        json: { provider: definition.key, action, config: form },
      });
      if (action === "test") {
        setChecks(result.checks ?? []);
        setMessage(result.message ?? "Connection tested.");
        toast(result.ok ? `${definition.name} connection succeeded.` : `${definition.name} connection failed.`, result.ok ? "success" : "error");
        return;
      }
      if (action === "disconnect") {
        toast(`${definition.name} disconnected.`, "info");
        onSaved({
          provider: definition.key,
          status: "DISCONNECTED",
          detail: null,
          config: form,
          lastSyncAt: null,
          connectedAt: row?.connectedAt ?? new Date().toISOString(),
        });
        onClose();
        return;
      }
      if (result.integration) onSaved(result.integration);
      if (action === "connect") {
        toast(`${definition.name} connected.`, "success");
        setMessage("Configuration saved. The integration is connected.");
      } else {
        setEffects(result.effects ?? []);
        setMessage("Sync completed.");
        toast(`${definition.name} synced.`, "success");
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(null);
    }
  }

  async function syncAzureDevOps() {
    setSyncPending(true);
    setError(null);
    setMessage(null);
    setSyncSummary(null);
    try {
      const rawOrganization = (form.organization || "").trim() || "https://dev.azure.com/ai-test-automations";
      const parsed = parseAzureDevOpsUrl(rawOrganization);
      const baseUrl = /^https?:\/\//i.test(rawOrganization)
        ? rawOrganization
        : `https://dev.azure.com/${rawOrganization.replace(/^@/, "")}`;
      const summary = await apiFetch<AzureSyncSummary>("/api/dashboard/integrations/azure-devops/sync", {
        method: "POST",
        json: {
          direction: "both",
          baseUrl,
          project: form.project || parsed.project || "AI Test Automation",
          token: form.pat || undefined,
          repository: form.repository || undefined,
        },
      });
      setSyncSummary(summary);
      const counts = summary.counts;
      toast(
        `✅ Azure DevOps synced: ${counts.pullRequests} PRs · ${counts.workItems} Work Items · ${counts.testPlans} Test Plans · ${counts.testSuites} Suites · ${counts.testCases} Test Cases.`,
        "success",
      );
      onSaved({
        provider: "AZURE_DEVOPS",
        status: "CONNECTED",
        detail: `${summary.organization} / ${summary.project}`,
        config: { ...form, organization: summary.organization, project: summary.project },
        lastSyncAt: summary.syncedAt,
        connectedAt: row?.connectedAt ?? new Date().toISOString(),
      });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSyncPending(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Configure ${definition.name}`}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {definition.key === "AZURE_DEVOPS" && (
              <button
                type="button"
                data-testid="azure-devops-sync-btn"
                className={cqaBtnPrimary}
                disabled={readOnly || syncPending || pending !== null}
                onClick={() => void syncAzureDevOps()}
              >
                <CqaIcon name="sync" className="text-[16px]" />
                {syncPending ? "Syncing Azure DevOps…" : "🔄 Sync Azure DevOps (PRs, Boards, Test Plans, Suites & Cases)"}
              </button>
            )}
            <button type="button" className={cqaBtnSecondary} disabled={readOnly || pending !== null} onClick={() => call("test")}>
              <CqaIcon name="cable" className="text-[16px]" />
              {pending === "test" ? "Testing…" : "Test Connection"}
            </button>
            {effectivelyConnected && (
              <>
                <button type="button" className={cqaBtnSecondary} disabled={readOnly || pending !== null} onClick={() => call("sync")}>
                  <CqaIcon name="sync" className="text-[16px]" />
                  {pending === "sync" ? "Syncing…" : "Sync Now"}
                </button>
                <button
                  type="button"
                  className={cn(cqaBtnSecondary, "text-[#b42318]")}
                  disabled={readOnly || pending !== null}
                  onClick={() => call("disconnect")}
                >
                  <CqaIcon name="link_off" className="text-[16px]" />
                  Disconnect
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className={cqaBtnSecondary} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={cqaBtnPrimary} disabled={readOnly || pending !== null} onClick={() => call("connect")}>
              {pending === "connect" ? "Saving…" : effectivelyConnected ? "Save changes" : "Save & Connect"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-[#eef0f3] bg-[#fafafa] p-3">
          <BrandMark definition={definition} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13.5px] font-semibold text-[#111827]">{definition.name}</p>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                biviaLive ? "bg-[#ecfdf3] text-[#067647]" : "bg-[#eef2ff] text-[#4f46e5]",
              )}>{badge}</span>
              <ConnectedPill connected={effectivelyConnected} />
            </div>
            <p className="mt-1 text-[12px] leading-5 text-[#6b7280]">{definition.description}</p>
            {definition.key === "BIVIA" && (
              <p data-testid="bivia-grant" className="mt-1.5 inline-flex rounded-full bg-[#f5f3ff] px-2 py-0.5 text-[10.5px] font-semibold text-[#4f46e5]">
                Enterprise AI verification included
              </p>
            )}
            {biviaLive && (
              <p className="mt-1 text-[11px] font-medium text-[#067647]">Connected through the workspace QASyn Vision AI credential.</p>
            )}
            {row?.lastSyncAt && <p className="mt-1 text-[11px] text-[#9ca3af]">Last sync: {formatWhen(row.lastSyncAt)}</p>}
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[12px] text-[#b42318]">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg border border-[#abefc6] bg-[#ecfdf3] px-3 py-2 text-[12px] text-[#067647]">
            {message}
            {effects && effects.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-[11px]">
                {effects.map((effect) => (
                  <li key={effect}>{effect}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {checks && checks.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-[#eef0f3] p-3">
            {checks.map((check) => (
              <li key={check.label} className="flex items-center gap-2 text-[12px]">
                <CqaIcon
                  name={check.ok ? "check_circle" : "cancel"}
                  className={cn("text-[15px]", check.ok ? "text-[#17b26a]" : "text-[#d92d20]")}
                  filled
                />
                <span className={check.ok ? "text-[#374151]" : "text-[#b42318]"}>{check.label}</span>
              </li>
            ))}
          </ul>
        )}

        {syncSummary && (
          <div
            data-testid="azure-devops-sync-result"
            className="rounded-lg border border-[#b2ddff] bg-[#eff8ff] px-3 py-2 text-[12px] text-[#175cd3]"
          >
            ✅ Synced: {syncSummary.counts.pullRequests} PRs · {syncSummary.counts.workItems} Work Items ·{" "}
            {syncSummary.counts.testPlans} Test Plans · {syncSummary.counts.testSuites} Suites ·{" "}
            {syncSummary.counts.testCases} Test Cases
            <div className="mt-1 flex flex-wrap gap-3 text-[11px] font-semibold">
              <a className="underline" href="/dashboard/pull-requests">Pull Requests</a>
              <a className="underline" href="/dashboard/requirements">Requirements</a>
              <a className="underline" href="/dashboard/plans/test-plans">Test Plans</a>
              <a className="underline" href="/dashboard/plans/suites">Test Suites</a>
              <a className="underline" href="/dashboard/test-cases">Test Cases</a>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {definition.fields.map((field) => (
            <label key={field.key} className={cn("block", field.type === "textarea" && "sm:col-span-2")}>
              <span className={cqaLabel}>
                {field.label}
                {field.required && <span className="ml-0.5 text-[#d92d20]">*</span>}
              </span>
              {fieldInput(
                field,
                form[field.key] ?? "",
                (value) => {
                  if (definition.key === "AZURE_DEVOPS" && field.key === "organization" && /dev\.azure\.com/i.test(value)) {
                    const parsed = parseAzureDevOpsUrl(value);
                    if (parsed.organization && parsed.project) {
                      setForm((prev) => ({ ...prev, organization: parsed.orgUrl, project: parsed.project }));
                      return;
                    }
                  }
                  setForm((prev) => ({ ...prev, [field.key]: value }));
                },
                readOnly || pending !== null,
              )}
              {field.help && <span className="mt-1 block text-[11px] text-[#9ca3af]">{field.help}</span>}
            </label>
          ))}
        </div>
        <p className="text-[11px] leading-5 text-[#9ca3af]">
          Configuration is stored per organisation and is only used by QASyn for this workspace. Tokens are never shared across tenants.
        </p>
      </div>
    </Modal>
  );
}

export function Integrations({
  integrations,
  readOnly,
  biviaReady = false,
  biviaSummary,
}: {
  integrations: IntegrationRow[];
  readOnly: boolean;
  biviaReady?: boolean;
  biviaSummary: BiviaObservatorySummary;
}) {
  const [rows, setRows] = useState<IntegrationRow[]>(integrations);
  const [tab, setTab] = useState<IntegrationCategory>("All Plugins");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<IntegrationDefinition | null>(null);
  const [azureSyncing, setAzureSyncing] = useState(false);
  const [azureSync, setAzureSync] = useState<AzureSyncSummary | null>(null);

  useEffect(() => setRows(integrations), [integrations]);

  const byProvider = useMemo(() => new Map(rows.map((row) => [row.provider, row])), [rows]);
  const biviaRow = byProvider.get("BIVIA");
  const biviaRowConnected = biviaRow?.status === "CONNECTED" || biviaRow?.status === "INDEXING";
  const connectedCount =
    rows.filter((row) => row.status === "CONNECTED" || row.status === "INDEXING").length +
    (biviaReady && !biviaRowConnected ? 1 : 0);

  const visible = INTEGRATION_PROVIDERS.filter((provider) => {
    if (!provider.categories.includes(tab)) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${provider.name} ${provider.description}`.toLowerCase().includes(needle);
  });

  function saved(row: IntegrationRow) {
    setRows((prev) => {
      const next = prev.filter((item) => item.provider !== row.provider);
      if (row.status !== "DISCONNECTED") next.unshift(row);
      return next;
    });
  }

  async function syncAzureCard(row: IntegrationRow | undefined) {
    if (azureSyncing) return;
    setAzureSyncing(true);
    try {
      const config = row?.config ?? {};
      const rawOrganization = config.baseUrl || config.organization || "https://dev.azure.com/ai-test-automations";
      const baseUrl = /^https?:\/\//i.test(rawOrganization)
        ? rawOrganization
        : `https://dev.azure.com/${rawOrganization.replace(/^@/, "")}`;
      const summary = await apiFetch<AzureSyncSummary>("/api/dashboard/integrations/azure-devops/sync", {
        method: "POST",
        json: {
          direction: "both",
          baseUrl,
          project: config.project || "AI Test Automation",
          token: config.pat || undefined,
          repository: config.repository || undefined,
        },
      });
      setAzureSync(summary);
      saved({
        provider: "AZURE_DEVOPS",
        status: "CONNECTED",
        detail: `${summary.organization} / ${summary.project}`,
        config: { ...config, organization: summary.organization, project: summary.project },
        lastSyncAt: summary.syncedAt,
        connectedAt: row?.connectedAt ?? new Date().toISOString(),
      });
      const counts = summary.counts;
      toast(
        `✅ Synced: ${counts.pullRequests} PRs · ${counts.workItems} Work Items · ${counts.testPlans} Test Plans · ${counts.testSuites} Suites · ${counts.testCases} Test Cases.`,
        "success",
      );
    } catch (caught) {
      toast(errorMessage(caught), "error");
    } finally {
      setAzureSyncing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[#111827]">Integrations</h1>
          <p className="mt-1 text-[13px] text-[#6b7280]">
            Connect source control, issue trackers, CI/CD and secrets. All Pro integrations are available and configurable.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[#6b7280]">
          <span className="rounded-full bg-[#ecfdf3] px-2.5 py-1 font-semibold text-[#067647]">{connectedCount} connected</span>
          <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 font-semibold text-[#374151]">{INTEGRATION_PROVIDERS.length} available</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb]">
        <div className="flex flex-wrap items-center gap-1">
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2.5 text-[12.5px] font-medium transition",
                tab === name
                  ? "border-[#5b4ee8] text-[#5b4ee8]"
                  : "border-transparent text-[#6b7280] hover:text-[#111827]",
              )}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="relative mb-2">
          <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-2 text-[17px] text-[#9ca3af]" />
          <input
            className={cn(cqaInput, "h-9 w-[230px] pl-8")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search integrations…"
            aria-label="Search integrations"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((definition) => {
          const row = byProvider.get(definition.key);
          const connected = row?.status === "CONNECTED" || row?.status === "INDEXING";
          const biviaLive = definition.key === "BIVIA" && biviaReady;
          const effectivelyConnected = connected || biviaLive;
          return (
            <article key={definition.key} className={cn(cqaCard, "flex flex-col overflow-hidden")}>
              <div className="flex flex-1 flex-col gap-3 px-4 py-4">
                <div className="flex items-center gap-3">
                  <BrandMark definition={definition} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[14px] font-semibold text-[#111827]">{definition.name}</h2>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide",
                          effectivelyConnected ? "bg-[#ecfdf3] text-[#067647]" : "bg-[#eef2ff] text-[#4f46e5]",
                        )}
                      >
                        {effectivelyConnected ? "Pro · Connected" : "Pro · Available"}
                      </span>
                      <ConnectedPill connected={effectivelyConnected} />
                    </div>
                  </div>
                </div>
                <p className="line-clamp-3 min-h-[48px] text-[12px] leading-5 text-[#6b7280]">{definition.description}</p>
                {definition.key === "AZURE_DEVOPS" && azureSync && (
                  <div
                    data-testid="azure-devops-sync-result"
                    className="rounded-lg border border-[#b2ddff] bg-[#eff8ff] px-2.5 py-2 text-[11px] text-[#175cd3]"
                  >
                    ✅ Synced: {azureSync.counts.pullRequests} PRs · {azureSync.counts.workItems} Work Items ·{" "}
                    {azureSync.counts.testPlans} Test Plans · {azureSync.counts.testSuites} Suites ·{" "}
                    {azureSync.counts.testCases} Test Cases
                    <div className="mt-1 flex flex-wrap gap-2 text-[10.5px] font-semibold">
                      <a className="underline" href="/dashboard/pull-requests">PRs</a>
                      <a className="underline" href="/dashboard/requirements">Requirements</a>
                      <a className="underline" href="/dashboard/plans/test-plans">Plans</a>
                      <a className="underline" href="/dashboard/plans/suites">Suites</a>
                      <a className="underline" href="/dashboard/test-cases">Cases</a>
                    </div>
                  </div>
                )}
                {definition.key === "BIVIA" && (
                  <div className="space-y-2">
                    <p data-testid="bivia-grant" className="inline-flex w-fit rounded-full bg-[#f5f3ff] px-2 py-0.5 text-[10.5px] font-semibold text-[#4f46e5]">
                      Enterprise AI verification included
                    </p>
                    <div data-testid="bivia-card-observatory">
                      <BiviaObservatory summary={biviaSummary} compact />
                    </div>
                  </div>
                )}
                <p className="truncate text-[11.5px] text-[#9ca3af]">
                  {connected
                    ? row?.detail || "Configured"
                    : biviaLive
                      ? "Connected through the workspace QASyn Vision AI credential."
                      : "Add credentials and project details to connect."}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-[#f0f1f3] bg-[#fcfcfd] px-4 py-2.5">
                <span className="text-[10.5px] text-[#9ca3af]">
                  {connected ? `Last sync ${formatWhen(row?.lastSyncAt ?? null)}` : biviaLive ? "Workspace API key" : "Not configured"}
                </span>
                <div className="flex items-center gap-1.5">
                  {definition.key === "AZURE_DEVOPS" && (
                    <button
                      type="button"
                      data-testid="azure-devops-sync-btn"
                      onClick={() => void syncAzureCard(row)}
                      disabled={readOnly || azureSyncing}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-[#b2ddff] bg-[#eff8ff] px-2.5 text-[11.5px] font-semibold text-[#175cd3] transition hover:bg-[#d1e9ff] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CqaIcon name="sync" className={cn("text-[14px]", azureSyncing && "animate-spin")} />
                      {azureSyncing ? "Syncing…" : "🔄 Sync Azure DevOps"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActive(definition)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-[#e5e7eb] bg-white px-2.5 text-[11.5px] font-semibold text-[#5b4ee8] transition hover:bg-[#f5f4ff]"
                  >
                    <CqaIcon name={effectivelyConnected ? "settings" : "link"} className="text-[14px]" />
                    {effectivelyConnected ? "Configure" : "Connect"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className={cn(cqaCard, "px-4 py-10 text-center text-[12.5px] text-[#6b7280]")}>No integration matches this search.</div>
      )}

      {active && (
        <ConfigureModal
          definition={active}
          row={byProvider.get(active.key)}
          readOnly={readOnly}
          biviaReady={biviaReady}
          onClose={() => setActive(null)}
          onSaved={saved}
        />
      )}
    </div>
  );
}
