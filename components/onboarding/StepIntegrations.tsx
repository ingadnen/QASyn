"use client";

import { useMemo, useState } from "react";
import type { Provider } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { useIntegrations, useSaveStep } from "./hooks";
import { StepFooter, StepHeader } from "./StepChrome";

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
  optional?: boolean;
}

interface ProviderDef {
  provider: Provider;
  name: string;
  blurb: string;
  fields: FieldDef[];
  repositories?: boolean;
}

const CODE_PROVIDERS: ProviderDef[] = [
  {
    provider: "GITHUB",
    name: "GitHub",
    blurb: "Read pull requests, changed files and checks with a fine-grained personal access token.",
    repositories: true,
    fields: [
      { key: "organization", label: "Organization / workspace URL", placeholder: "https://github.com/acme" },
      { key: "token", label: "Personal access token", placeholder: "github_pat_…", type: "password" },
      { key: "repository", label: "Repository", placeholder: "acme/payments" },
      { key: "baseBranch", label: "Base branch", placeholder: "main", optional: true },
    ],
  },
  {
    provider: "GITLAB",
    name: "GitLab",
    blurb: "Connect a GitLab project or group with an API token. QASyn indexes merge requests and pipelines.",
    repositories: true,
    fields: [
      { key: "organization", label: "GitLab workspace URL", placeholder: "https://gitlab.com/acme" },
      { key: "token", label: "Personal access token", placeholder: "glpat_…", type: "password" },
      { key: "repository", label: "Project path", placeholder: "acme/payments" },
      { key: "baseBranch", label: "Base branch", placeholder: "main", optional: true },
    ],
  },
  {
    provider: "AZURE_DEVOPS",
    name: "Azure DevOps",
    blurb: "Repositories, Boards work items and Test Plans with a PAT scoped to Code, Work Items and Test Management.",
    repositories: true,
    fields: [
      { key: "organization", label: "Organization URL", placeholder: "https://dev.azure.com/ai-test-automations" },
      { key: "project", label: "Project", placeholder: "AI Test Automation" },
      { key: "token", label: "Personal access token", placeholder: "azd_…", type: "password" },
      { key: "repository", label: "Repository", placeholder: "AI Test Automation" },
      { key: "baseBranch", label: "Base branch", placeholder: "main", optional: true },
    ],
  },
];

const TOOL_PROVIDERS: ProviderDef[] = [
  {
    provider: "JIRA",
    name: "Jira",
    blurb: "Turn assigned bugs into reproducible QASyn runs and post results back to the issue.",
    fields: [
      { key: "baseUrl", label: "Jira base URL", placeholder: "https://acme.atlassian.net" },
      { key: "email", label: "Account e-mail", placeholder: "qa@acme.com" },
      { key: "apiToken", label: "API token", placeholder: "ATATT3xFf…", type: "password" },
      { key: "projectKey", label: "Project key", placeholder: "QA" },
    ],
  },
  {
    provider: "LINEAR",
    name: "Linear",
    blurb: "Sync Linear issues, assign QA states and attach evidence links automatically.",
    fields: [
      { key: "apiKey", label: "API key", placeholder: "lin_api_…", type: "password" },
      { key: "teamKey", label: "Team key", placeholder: "ENG" },
    ],
  },
  {
    provider: "SLACK",
    name: "Slack",
    blurb: "Publish quality gates, failure digests and invitation notifications to a channel.",
    fields: [
      { key: "webhookUrl", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/…" },
      { key: "botToken", label: "Bot token", placeholder: "xoxb-…", type: "password", optional: true },
      { key: "channel", label: "Channel", placeholder: "#qa-alerts" },
    ],
  },
  {
    provider: "AZURE_DEVOPS",
    name: "Azure Boards",
    blurb: "Two-way Boards and Test Plans sync for work items, suites and test cases.",
    fields: [
      { key: "organization", label: "Organization URL", placeholder: "https://dev.azure.com/ai-test-automations" },
      { key: "project", label: "Project", placeholder: "AI Test Automation" },
      { key: "token", label: "PAT", placeholder: "azd_…", type: "password" },
    ],
  },
];

function ProviderForm({ definition }: { definition: ProviderDef }) {
  const { integrations, connect, disconnect, busy } = useIntegrations();
  const [form, setForm] = useState<Record<string, string>>({ baseBranch: "main" });
  const [repositories, setRepositories] = useState<Array<{ id: string; name: string; fullName: string; url: string }>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = integrations.find((item) => item.provider === definition.provider);
  const connected = current?.status === "CONNECTED" || current?.status === "INDEXING";
  const filled = definition.fields.filter((field) => !field.optional).every((field) => Boolean(form[field.key]?.trim()));

  async function testAndSave() {
    setError(null);
    setMessage(null);
    const result = await connect(definition.provider, form.repository || form.project || form.organization, form);
    if (!result) {
      setError("Connection failed. Check the URL and token.");
      return;
    }
    setRepositories(result.repositories ?? []);
    setMessage(result.repositories?.length ? `${result.repositories.length} repository(ies) fetched and integration saved.` : "Connection verified and saved.");
  }

  return (
    <section className={cn("rounded-xl border p-4", connected ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{definition.name}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">{definition.blurb}</p>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
          {connected ? "CONNECTED" : "NOT CONNECTED"}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {definition.fields.map((field) => (
          <Input
            key={field.key}
            label={field.label + (field.optional ? " (optional)" : "")}
            type={field.type ?? "text"}
            placeholder={field.placeholder}
            value={form[field.key] ?? ""}
            onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
            autoComplete="off"
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => void testAndSave()} loading={busy === definition.provider} disabled={!filled} loadingText="Testing…">
          {definition.repositories ? "Test & Fetch Repositories" : "Test Connection"}
        </Button>
        {connected && (
          <Button type="button" size="sm" variant="ghost" onClick={() => void disconnect(definition.provider)} disabled={busy === definition.provider}>
            Disconnect
          </Button>
        )}
        {message && <span className="text-xs font-medium text-emerald-700">{message}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
      {repositories.length > 0 && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white">
          <p className="border-b border-slate-100 px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Repositories</p>
          <ul className="max-h-32 overflow-y-auto">
            {repositories.map((repo) => (
              <li key={repo.id}>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, repository: repo.fullName }))}
                  className={cn("flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-slate-50", form.repository === repo.fullName && "bg-brand-50 text-brand-700")}
                >
                  <span className="truncate">{repo.fullName}</span>
                  <span className="text-[10px] text-slate-400">select</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function Step3Code() {
  const { save, pending, error } = useSaveStep();
  const { integrations } = useIntegrations();
  const connected = integrations.some((item) => item.provider === "GITHUB" || item.provider === "GITLAB" || item.provider === "AZURE_DEVOPS");
  return (
    <div className="space-y-8">
      <StepHeader step={3} title="Connect your code" subtitle="Verify credentials and fetch repositories before saving. QASyn uses read-only pull request and pipeline context to scope every run." />
      <div className="space-y-3">
        {CODE_PROVIDERS.map((definition) => <ProviderForm key={`${definition.provider}-${definition.name}`} definition={definition} />)}
      </div>
      <StepFooter step={3} pending={pending} error={error} canContinue={connected} onSkip={() => save({ step: 3, skip: true }, "skip")} onContinue={() => save({ step: 3 })} />
    </div>
  );
}

export function Step4Tools() {
  const { save, pending, error } = useSaveStep();
  const { integrations } = useIntegrations();
  const connected = useMemo(() => integrations.some((item) => ["JIRA", "LINEAR", "SLACK"].includes(item.provider)), [integrations]);
  return (
    <div className="space-y-8">
      <StepHeader step={4} title="Connect your team's tools" subtitle="Test each connection live. Bugs, quality gates and invitation notifications land where your team already works." />
      <div className="space-y-3">
        {TOOL_PROVIDERS.map((definition) => <ProviderForm key={`${definition.provider}-${definition.name}-tools`} definition={definition} />)}
      </div>
      <StepFooter step={4} pending={pending} error={error} canContinue={connected} onSkip={() => save({ step: 4, skip: true }, "skip")} onContinue={() => save({ step: 4 })} />
    </div>
  );
}
