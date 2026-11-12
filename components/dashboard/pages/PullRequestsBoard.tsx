"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CqaIcon,
  Modal,
  StatusPill,
  cqaBtnPrimary,
  cqaBtnSecondary,
  cqaCard,
  cqaInput,
  cqaLabel,
} from "@/components/dashboard/ui";
import { RowMenu } from "@/components/contextqa/row-menu";
import { ColumnFilter, ColumnSort, distinctColumnValues, matchesColumnFilters, nextTableSort, sortTableRows, type TableSortState } from "@/components/contextqa/table-ui";
import { apiFetch, errorMessage } from "@/lib/api";
import type { CatalogPullRequest } from "@/lib/pr-catalog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export interface PrImpact {
  modules?: string[];
  blastRadius?: string;
  impacted?: Array<{ id: string; title: string; module: string; criticality: string; status: string }>;
  executed?: Array<{ id: string; title: string; status: string }>;
  passed?: number;
  failed?: number;
  total?: number;
  testsSelected?: number;
  verdict?: string;
}

export interface PrDetailRow {
  id: string;
  prNumber: number;
  title: string;
  branch: string;
  branchTarget: string;
  author: string;
  provider: string | null;
  repository: string | null;
  externalUrl: string | null;
  riskLevel: string;
  status: string;
  filesChanged: number;
  files: string[];
  impact: PrImpact;
  logs: Array<{ at: string; level: string; message: string }>;
  commentBody: string | null;
  commentPosted: boolean;
  testsRun: number;
  regressions: number;
  createdAt: string;
}

export interface PrEnvironmentOption {
  id: string;
  name: string;
  baseUrl: string;
  isDefault: boolean;
}

interface AutoRegressionResponse {
  status: string;
  environment: { id: string; name: string; baseUrl: string } | null;
  targetUrl: string;
  createdTestCases: Array<{ id: string; title: string; testType: string }>;
  executed: Array<{ id: string; title: string; status: string; runId: string; runNumber: number }>;
  passed: number;
  failed: number;
  total: number;
  regressions: number;
  testsRun: number;
  ranAt: string;
}

interface SourcePayload {
  provider: string;
  providerName: string;
  repositories: Array<{ repository: string; baseBranch: string; pullRequests: CatalogPullRequest[] }>;
}

function verdictLabel(row: Pick<PrDetailRow, "status" | "regressions">) {
  if (row.status === "running") return "Analysing";
  if (row.status === "regression_caught") return `${row.regressions} regression${row.regressions === 1 ? "" : "s"} caught`;
  return "Passed baseline";
}

function riskLabel(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function exportReport(row: PrDetailRow) {
  const lines = [
    ["PR", "Title", "Branch", "Author", "Files", "Risk", "Tests run", "Verdict", "Opened"].join(","),
    [
      `#${row.prNumber}`,
      row.title,
      row.branch,
      row.author,
      row.filesChanged,
      row.riskLevel,
      row.testsRun,
      verdictLabel(row),
      row.createdAt,
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  ].join("\r\n");
  const blob = new Blob([`\uFEFF${lines}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pr-${row.prNumber}-impact-report.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  toast(`PR #${row.prNumber} report exported.`, "success");
}

function PrDetailDrawer({
  row,
  readOnly,
  environments,
  onClose,
  onUpdated,
}: {
  row: PrDetailRow;
  readOnly: boolean;
  environments: PrEnvironmentOption[];
  onClose: () => void;
  onUpdated: (row: PrDetailRow) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoEnv, setAutoEnv] = useState(environments.find((env) => env.isDefault)?.id ?? environments[0]?.id ?? "");
  const [autoUrl, setAutoUrl] = useState("");
  const [autoCreate, setAutoCreate] = useState(true);
  const [autoPending, setAutoPending] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [autoResult, setAutoResult] = useState<AutoRegressionResponse | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [gatePending, setGatePending] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateMarkdown, setGateMarkdown] = useState<string | null>(null);
  const [gateMeta, setGateMeta] = useState<{ bivia?: { riskScore: number; probabilityPct: number; riskLevel: string } | null; security?: { grade: string; score: number; findings: number } } | null>(null);
  const executed = row.impact.executed ?? [];
  const modules = row.impact.modules ?? [];
  const commentPosted = row.commentPosted && Boolean(row.commentBody);

  // Phase 10/11 — ready-to-copy CI/CD webhook snippet for this exact PR.
  // The origin is resolved on the client so hosted deployments print their
  // real URL instead of a hardcoded localhost.
  const [webhookOrigin, setWebhookOrigin] = useState("http://localhost:3000");
  useEffect(() => {
    if (typeof window !== "undefined") setWebhookOrigin(window.location.origin);
  }, []);
  const webhookPreviewUrl =
    autoUrl || environments.find((environment) => environment.id === autoEnv)?.baseUrl || row.externalUrl || "https://www.cgi.com";
  const webhookPayload = JSON.stringify({
    prNumber: row.prNumber,
    title: row.title,
    branch: row.branch,
    branchTarget: row.branchTarget,
    author: "ci-bot",
    repository: row.repository ?? undefined,
    changedFiles: row.files,
    previewUrl: webhookPreviewUrl,
    createTests: true,
  });
  const webhookCurl = `curl -X POST ${webhookOrigin}/api/webhooks/ci-pr -H "content-type: application/json" -H "x-qasyn-token: cqa_your_api_token" -d '${webhookPayload}'`;
  const githubWorkflow = `- name: QASyn autonomous PR gate\n  run: |\n    curl -X POST ${webhookOrigin}/api/webhooks/ci-pr \\\n      -H "content-type: application/json" \\\n      -H "x-qasyn-token: \${{ secrets.QASYN_TOKEN }}" \\\n      -d '${webhookPayload.replace(/'/g, "'\\''")}'`;

  async function generateGate() {
    setGateOpen(true);
    setGatePending(true);
    setGateError(null);
    setGateMarkdown(null);
    setGateMeta(null);
    try {
      const result = await apiFetch<{
        markdown: string;
        bivia?: { riskScore: number; probabilityPct: number; riskLevel: string } | null;
        security?: { grade: string; score: number; findings: number };
      }>("/api/dashboard/pull-requests/gate", {
        method: "POST",
        json: { id: row.id },
      });
      setGateMarkdown(result.markdown);
      setGateMeta({ bivia: result.bivia ?? null, security: result.security });
    } catch (caught) {
      setGateError(errorMessage(caught));
    } finally {
      setGatePending(false);
    }
  }

  async function copyGate() {
    if (!gateMarkdown) return;
    try {
      await navigator.clipboard.writeText(gateMarkdown);
      toast("PR gate Markdown copied to clipboard.", "success");
    } catch {
      toast("Clipboard unavailable — select the Markdown to copy manually.", "error");
    }
  }

  async function rerun() {
    setPending(true);
    setError(null);
    try {
      const result = await apiFetch<{ pullRequest: PrDetailRow }>("/api/dashboard/pull-requests", {
        method: "PATCH",
        json: { id: row.id },
      });
      onUpdated(result.pullRequest);
      toast(`Analysis re-ran for PR #${row.prNumber}.`, "success");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function runAutoRegression() {
    if (autoPending) return;
    setAutoPending(true);
    setAutoError(null);
    try {
      const result = await apiFetch<AutoRegressionResponse>("/api/dashboard/pull-requests/auto-regression", {
        method: "POST",
        json: {
          id: row.id,
          environmentId: autoEnv || undefined,
          targetUrl: autoUrl.trim() || undefined,
          createTests: autoCreate,
        },
      });
      setAutoResult(result);
      onUpdated({ ...row, status: result.status, testsRun: result.testsRun, regressions: result.regressions });
      toast(
        `PR #${row.prNumber} auto-regression · ${result.passed}/${result.total} passed${result.regressions ? ` · ${result.regressions} regression(s)` : ""}.`,
        result.regressions ? "error" : "success",
      );
    } catch (caught) {
      setAutoError(errorMessage(caught));
    } finally {
      setAutoPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="presentation">
      <button type="button" aria-label="Close PR analysis" className="absolute inset-0 bg-[#0f172a]/35" onClick={onClose} />
      <aside
        role="dialog"
        aria-label="PR analysis detail"
        className="relative flex h-full w-full max-w-[640px] flex-col bg-white shadow-[-24px_0_60px_rgba(15,23,42,0.18)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#eef0f3] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">PR impact analysis</p>
            <h2 className="mt-1 truncate text-[16px] font-semibold text-[#111827]">
              #{row.prNumber} {row.title}
            </h2>
            <p className="mt-1 truncate font-mono text-[11.5px] text-[#6b7280]">
              {row.branch} → {row.branchTarget} · @{row.author}
            </p>
          </div>
          <button type="button" className="rounded-md p-1 text-[#6b7280] hover:bg-[#f3f4f6]" onClick={onClose} aria-label="Close">
            <CqaIcon name="close" className="text-[20px]" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill value={row.status} label={verdictLabel(row)} />
            <StatusPill value={row.riskLevel} label={`${riskLabel(row.riskLevel)} risk`} />
            <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-medium text-[#374151]">
              {row.provider ?? "Manual"} {row.repository ? `· ${row.repository}` : ""}
            </span>
            {row.externalUrl && (
              <a
                href={row.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#5b4ee8] hover:underline"
              >
                Open in provider <CqaIcon name="open_in_new" className="text-[14px]" />
              </a>
            )}
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[12px] text-[#b42318]">
              {error}
            </div>
          )}

          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Files", String(row.filesChanged)],
              ["Tests run", String(row.testsRun)],
              ["Passed", String(row.impact.passed ?? Math.max(0, row.testsRun - row.regressions))],
              ["Regressions", String(row.regressions)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-[#f0f1f3] bg-[#fcfcfd] px-3 py-2">
                <p className="text-[10.5px] font-medium uppercase tracking-wide text-[#9ca3af]">{label}</p>
                <p className="mt-0.5 text-[16px] font-semibold text-[#111827]">{value}</p>
              </div>
            ))}
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#111827]">
              <CqaIcon name="account_tree" className="text-[16px] text-[#5b4ee8]" /> Blast radius
            </h3>
            <p className="mt-1 text-[12px] leading-5 text-[#6b7280]">
              {row.impact.blastRadius ? `${riskLabel(row.impact.blastRadius)} blast radius` : "Blast radius computed"} across{" "}
              {modules.length > 0 ? modules.join(", ") : "Core"}. {row.impact.testsSelected ?? row.testsRun} impacted test case(s) selected by criticality.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {modules.map((module) => (
                <span key={module} className="rounded-md bg-[#eef2ff] px-2 py-0.5 text-[11px] font-medium text-[#4f46e5]">
                  {module}
                </span>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[12.5px] font-semibold text-[#111827]">Changed files ({row.files.length})</h3>
            <ul className="mt-2 divide-y divide-[#f3f4f6] rounded-lg border border-[#eef0f3]">
              {row.files.map((file) => (
                <li key={file} className="flex items-center gap-2 px-3 py-1.5 font-mono text-[11.5px] text-[#4b5563]">
                  <CqaIcon name="description" className="text-[14px] text-[#9ca3af]" />
                  {file}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-[12.5px] font-semibold text-[#111827]">Impacted tests executed</h3>
            <ul className="mt-2 space-y-1">
              {executed.length === 0 && <li className="text-[12px] text-[#9ca3af]">No impacted test was executed.</li>}
              {executed.map((test) => (
                <li key={test.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#eef0f3] px-3 py-1.5">
                  <span className="min-w-0 truncate text-[12px] text-[#374151]">{test.title}</span>
                  <StatusPill value={test.status === "passing" ? "passing" : "failing"} label={test.status === "passing" ? "Passed" : "Failed"} />
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-[12.5px] font-semibold text-[#111827]">Execution logs</h3>
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-[#eef0f3] bg-[#0f172a] p-3 font-mono text-[11px] leading-5 text-[#d1d5db]">
              {row.logs.length === 0 && <p className="text-[#9ca3af]">No execution log recorded.</p>}
              {row.logs.map((line, index) => (
                <p key={`${line.at}-${index}`} className={line.level === "fail" ? "text-[#fca5a5]" : line.level === "pass" ? "text-[#86efac]" : ""}>
                  <span className="text-[#6b7280]">[{new Date(line.at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" })}]</span> {line.message}
                </p>
              ))}
            </div>
          </section>

          <section data-testid="pr-auto-regression" className="rounded-lg border border-[#ddd8fb] bg-[#faf9ff] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#111827]">
                  <CqaIcon name="rocket_launch" className="text-[16px] text-[#5b4ee8]" /> PR auto-regression
                </h3>
                <p className="mt-1 text-[11.5px] leading-4 text-[#6b7280]">
                  Creates PR-specific smoke and regression cases, then runs them plus the impacted suite against the deployed URL with per-step screenshots.
                </p>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10.5px] font-semibold text-[#4f46e5]">
                {row.status === "regression_caught" ? `${row.regressions} caught` : row.testsRun > 0 ? "Baseline captured" : "Not run"}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className={cqaLabel}>Environment</span>
                <select
                  className={cqaInput}
                  data-testid="pr-auto-regression-environment"
                  value={autoEnv}
                  onChange={(event) => setAutoEnv(event.target.value)}
                  disabled={readOnly || autoPending}
                >
                  <option value="">Default environment</option>
                  {environments.map((environment) => (
                    <option key={environment.id} value={environment.id}>
                      {environment.name}{environment.isDefault ? " · default" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={cqaLabel}>Deployed URL override</span>
                <input
                  className={cqaInput}
                  value={autoUrl}
                  onChange={(event) => setAutoUrl(event.target.value)}
                  placeholder={(() => {
                    const selected = environments.find((environment) => environment.id === autoEnv);
                    return selected?.baseUrl || row.externalUrl || "https://staging.example.com";
                  })()}
                  disabled={readOnly || autoPending}
                />
              </label>
            </div>
            <label className="mt-2 flex items-center gap-2 text-[11.5px] text-[#4b5563]">
              <input
                type="checkbox"
                className="size-3.5 accent-[#5b4ee8]"
                checked={autoCreate}
                onChange={(event) => setAutoCreate(event.target.checked)}
                disabled={readOnly || autoPending}
              />
              Auto-create PR-specific test cases when none exist
            </label>
            {autoError && <p role="alert" className="mt-2 rounded border border-[#fecdca] bg-[#fef3f2] px-2 py-1 text-[11.5px] text-[#b42318]">{autoError}</p>}
            {autoResult && (
              <div data-testid="pr-auto-regression-result" className="mt-2 rounded-md border border-[#d1fadf] bg-[#ecfdf3] px-2.5 py-2 text-[11.5px] text-[#067647]">
                <p className="font-semibold">
                  {autoResult.passed}/{autoResult.total} passed · {autoResult.regressions} regression(s) · {autoResult.environment?.name ?? "default environment"}
                </p>
                <p className="mt-0.5 break-all font-mono text-[10.5px] text-[#067647]">{autoResult.targetUrl}</p>
                {autoResult.createdTestCases.length > 0 && (
                  <p className="mt-1">Created {autoResult.createdTestCases.length} PR test case(s): {autoResult.createdTestCases.map((test) => test.title).join(" · ")}</p>
                )}
                <p className="mt-1 text-[10.5px]">Per-step screenshots are stored in each test run history and Test Studio.</p>
              </div>
            )}
            <button
              type="button"
              className={cn(cqaBtnPrimary, "mt-2 h-8 px-3 text-[12px]")}
              data-testid="pr-auto-regression-run"
              disabled={readOnly || autoPending}
              onClick={() => void runAutoRegression()}
            >
              <CqaIcon name={autoPending ? "hourglass_top" : "play_arrow"} className={cn("text-[16px]", autoPending && "animate-pulse")} />
              {autoPending ? "Running auto-regression…" : "Run PR auto-regression"}
            </button>
          </section>

          <details data-testid="pr-webhook-snippet" className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-3">
            <summary className="cursor-pointer list-none text-[12.5px] font-semibold text-[#1d4ed8]">
              🔗 CI/CD Webhook &amp; GitHub Actions Snippet
            </summary>
            <p className="mt-1 text-[11.5px] leading-4 text-[#1e40af]">
              Trigger this PR&apos;s autonomous gate from GitHub Actions, GitLab CI, Azure DevOps or any pipeline in one call.
              Authenticate with an API token (<code>x-qasyn-token: cqa_…</code>) or an existing session cookie.
            </p>
            <p className="mt-2 text-[10.5px] font-semibold uppercase tracking-wide text-[#1e40af]">cURL</p>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-[#0f172a] p-2.5 font-mono text-[10.5px] leading-4 text-[#d1d5db]">
              {webhookCurl}
            </pre>
            <p className="mt-2 text-[10.5px] font-semibold uppercase tracking-wide text-[#1e40af]">GitHub Actions</p>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-[#0f172a] p-2.5 font-mono text-[10.5px] leading-4 text-[#d1d5db]">
              {githubWorkflow}
            </pre>
          </details>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-[12.5px] font-semibold text-[#111827]">Provider comment</h3>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                  commentPosted ? "bg-[#ecfdf3] text-[#067647]" : "bg-[#f3f4f6] text-[#6b7280]",
                )}
              >
                {commentPosted ? `Posted automatically · ${row.provider ?? "provider"}` : "Not posted"}
              </span>
            </div>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-[#eef0f3] bg-[#fafafa] p-3 text-[11.5px] leading-5 text-[#374151]">
              {row.commentBody ?? "No comment was posted."}
            </pre>
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef0f3] px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={cqaBtnSecondary} disabled={readOnly || pending} onClick={rerun}>
              <CqaIcon name="refresh" className="text-[16px]" />
              {pending ? "Re-running…" : "Re-run analysis"}
            </button>
            <button
              type="button"
              className={cqaBtnPrimary}
              data-testid="pr-gate-open"
              disabled={gatePending}
              onClick={() => void generateGate()}
            >
              <CqaIcon name="gavel" className="text-[16px]" />
              {gatePending ? "Generating…" : "📋 Generate CI/CD PR Gate Comment"}
            </button>
          </div>
          <button type="button" className={cqaBtnSecondary} onClick={onClose}>
            Close
          </button>
        </footer>
      </aside>

      <Modal
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        title="📋 CI/CD PR Gate Comment"
        size="xl"
        footer={
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setGateOpen(false)}>
              Close
            </button>
            <button
              type="button"
              className={cqaBtnPrimary}
              data-testid="pr-gate-copy"
              disabled={!gateMarkdown}
              onClick={() => void copyGate()}
            >
              <CqaIcon name="content_copy" className="text-[16px]" /> Copy Markdown Report
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[12.5px] leading-5 text-[#6b7280]">
            Copy-ready merge gate for GitHub, GitLab, Azure DevOps or Jenkins. It combines the calibrated Bivia verdict,
            the <code className="rounded bg-[#f3f4f6] px-1 py-0.5 text-[11px]">/set</code> impacted-test table and the Strix security summary.
          </p>
          {gateError && (
            <div role="alert" className="rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[12px] text-[#b42318]">
              {gateError}
            </div>
          )}
          {gatePending && (
            <div className="flex items-center gap-2 rounded-lg border border-[#c7d2fe] bg-[#eef2ff] px-3 py-2 text-[12px] text-[#4f46e5]">
              <CqaIcon name="hourglass_top" className="animate-pulse text-[16px]" /> Calibrating Bivia risk and running Strix…
            </div>
          )}
          {gateMeta && (
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-[#f5f3ff] px-2 py-0.5 text-[10.5px] font-semibold text-[#5b4ee8]">
                🧠 Bivia {gateMeta.bivia ? `${gateMeta.bivia.riskScore.toFixed(1)}/10 · ${gateMeta.bivia.probabilityPct.toFixed(1)}%` : "fallback"}
              </span>
              <span className="rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[10.5px] font-semibold text-[#067647]">
                🛡️ Strix {gateMeta.security?.grade ?? "?"} · {gateMeta.security?.score ?? 0}/100 · {gateMeta.security?.findings ?? 0} finding(s)
              </span>
            </div>
          )}
          {gateMarkdown ? (
            <pre
              data-testid="pr-gate-markdown"
              className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-lg border border-[#eef0f3] bg-[#0f172a] p-3 font-mono text-[11px] leading-5 text-[#e2e8f0]"
            >
              {gateMarkdown}
            </pre>
          ) : (
            !gatePending &&
            !gateError && <p className="text-[12px] text-[#9ca3af]">No gate report generated yet.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

function AnalysePrModal({
  open,
  onClose,
  onAnalyzed,
  readOnly,
  nextNumber,
  onNeedIntegration,
}: {
  open: boolean;
  onClose: () => void;
  onAnalyzed: (row: PrDetailRow) => void;
  readOnly: boolean;
  nextNumber: number;
  onNeedIntegration: () => void;
}) {
  const [sources, setSources] = useState<SourcePayload[] | null>(null);
  const [sourceKey, setSourceKey] = useState("");
  const [selected, setSelected] = useState<CatalogPullRequest | null>(null);
  const [manual, setManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    customUrl: "",
    prNumber: nextNumber,
    title: "",
    branch: "feature/",
    author: "",
    filesChanged: 6,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSources(null);
    setSelected(null);
    setError(null);
    setManual(false);
    apiFetch<{ sources: SourcePayload[] }>("/api/dashboard/pull-requests/sources")
      .then((result) => {
        if (cancelled) return;
        setSources(result.sources);
        setSourceKey(result.sources[0] ? `${result.sources[0].provider}|${result.sources[0].repositories[0]?.repository ?? ""}` : "");
      })
      .catch((caught) => !cancelled && setError(errorMessage(caught)));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const activeRepository = useMemo(() => {
    if (!sources) return null;
    for (const source of sources) {
      for (const repository of source.repositories) {
        if (`${source.provider}|${repository.repository}` === sourceKey) return { source, repository };
      }
    }
    return null;
  }, [sourceKey, sources]);

  async function submit() {
    if (readOnly) return;
    setPending(true);
    setError(null);
    try {
      const json = manual
        ? {
            prNumber: Number(manualForm.prNumber),
            title: manualForm.title,
            branch: manualForm.branch,
            author: manualForm.author,
            filesChanged: Number(manualForm.filesChanged),
            customUrl: manualForm.customUrl || undefined,
          }
        : selected
          ? { mode: "catalog", provider: selected.provider, repository: selected.repository, prNumber: selected.number }
          : null;
      if (!json) {
        setError("Select an open pull request first.");
        return;
      }
      const result = await apiFetch<{ pullRequest: PrDetailRow }>("/api/dashboard/pull-requests", { method: "POST", json });
      onAnalyzed(result.pullRequest);
      toast(`PR #${result.pullRequest.prNumber} analysed — ${verdictLabel(result.pullRequest)}.`, "success");
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Analyse a pull request"
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11.5px] text-[#9ca3af]">25 credits per PR check · impacted tests are executed and a comment is posted.</p>
          <div className="flex gap-2">
            <button type="button" className={cqaBtnSecondary} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={cqaBtnPrimary} disabled={readOnly || pending} onClick={submit}>
              {pending ? "Running…" : "Run PR check (25 credits)"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[12px] text-[#b52318]">
            {error}
          </div>
        )}

        {!manual && (
          <>
            {sources === null ? (
              <p className="text-[12px] text-[#6b7280]">Loading connected repositories…</p>
            ) : sources.length === 0 ? (
              <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-3 text-[12.5px] text-[#92400e]">
                No source-control provider is connected.{" "}
                <button type="button" className="font-semibold underline" onClick={onNeedIntegration}>
                  Configure GitHub, GitLab or Azure DevOps
                </button>{" "}
                or use a manual / custom PR URL.
              </div>
            ) : (
              <>
                <label className="block">
                  <span className={cqaLabel}>Connected provider · repository</span>
                  <select
                    className={cqaInput}
                    value={sourceKey}
                    onChange={(event) => {
                      setSourceKey(event.target.value);
                      setSelected(null);
                    }}
                    aria-label="Connected provider and repository"
                  >
                    {sources.flatMap((source) =>
                      source.repositories.map((repository) => (
                        <option key={`${source.provider}|${repository.repository}`} value={`${source.provider}|${repository.repository}`}>
                          {source.providerName} · {repository.repository} (base {repository.baseBranch})
                        </option>
                      )),
                    )}
                  </select>
                </label>

                <div>
                  <p className={cqaLabel}>Open pull requests</p>
                  <div className="max-h-[300px] space-y-1.5 overflow-y-auto rounded-lg border border-[#eef0f3] p-2">
                    {activeRepository?.repository.pullRequests.map((pull) => {
                      const active = selected?.number === pull.number && selected.provider === pull.provider;
                      return (
                        <button
                          key={`${pull.provider}-${pull.number}`}
                          type="button"
                          data-testid="pr-open-option"
                          onClick={() => setSelected(pull)}
                          className={cn(
                            "w-full rounded-lg border px-3 py-2 text-left transition",
                            active ? "border-[#a9a1f7] bg-[#f5f4ff]" : "border-transparent hover:border-[#e5e7eb] hover:bg-[#fafafa]",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="text-[10.5px] font-semibold text-[#9ca3af]">#{pull.number}</span>
                              <span className="ml-2 text-[12.5px] font-medium text-[#111827]">{pull.title}</span>
                            </span>
                            <span className="shrink-0 rounded-full bg-[#f3f4f6] px-1.5 py-0.5 text-[10px] font-medium text-[#6b7280]">
                              {pull.files.length} files
                            </span>
                          </div>
                          <p className="mt-1 truncate font-mono text-[10.5px] text-[#6b7280]">
                            {pull.branch} → {pull.branchTarget} · @{pull.author} · {shortDate(pull.openedAt)}
                          </p>
                          <p className="mt-1 truncate text-[10.5px] text-[#9ca3af]">{pull.files.slice(0, 3).join(" · ")}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {manual && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={cqaLabel}>Custom PR URL (optional)</span>
              <input
                className={cqaInput}
                value={manualForm.customUrl}
                onChange={(event) => setManualForm((prev) => ({ ...prev, customUrl: event.target.value }))}
                placeholder="https://github.com/cgi/digital-portal/pull/812"
                type="url"
                aria-label="Custom PR URL"
              />
            </label>
            <label className="block">
              <span className={cqaLabel}>PR number</span>
              <input
                className={cqaInput}
                value={manualForm.prNumber}
                onChange={(event) => setManualForm((prev) => ({ ...prev, prNumber: Number(event.target.value) }))}
                type="number"
                min={1}
                required
              />
            </label>
            <label className="block">
              <span className={cqaLabel}>Title</span>
              <input
                className={cqaInput}
                value={manualForm.title}
                onChange={(event) => setManualForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Describe the change"
                required
              />
            </label>
            <label className="block">
              <span className={cqaLabel}>Branch</span>
              <input
                className={cqaInput}
                value={manualForm.branch}
                onChange={(event) => setManualForm((prev) => ({ ...prev, branch: event.target.value }))}
                placeholder="feature/…"
                required
              />
            </label>
            <label className="block">
              <span className={cqaLabel}>Author</span>
              <input
                className={cqaInput}
                value={manualForm.author}
                onChange={(event) => setManualForm((prev) => ({ ...prev, author: event.target.value }))}
                placeholder="author"
                required
              />
            </label>
            <label className="block">
              <span className={cqaLabel}>Files changed</span>
              <input
                className={cqaInput}
                value={manualForm.filesChanged}
                onChange={(event) => setManualForm((prev) => ({ ...prev, filesChanged: Number(event.target.value) }))}
                type="number"
                min={1}
                max={5000}
                required
              />
            </label>
          </div>
        )}

        <button
          type="button"
          onClick={() => setManual((value) => !value)}
          className="text-[12px] font-semibold text-[#5b4ee8] hover:underline"
        >
          {manual ? "← Back to connected pull requests" : "Manual / Custom PR URL"}
        </button>
      </div>
    </Modal>
  );
}

export function PullRequestsBoard({
  initialRows,
  readOnly,
  nextNumber,
  environments = [],
}: {
  initialRows: PrDetailRow[];
  readOnly: boolean;
  nextNumber: number;
  environments?: PrEnvironmentOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<TableSortState>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<PrDetailRow | null>(null);

  useEffect(() => setRows(initialRows), [initialRows]);

  function setColumnFilter(column: string, value: string) {
    setColumnFilters((current) => ({ ...current, [column]: value }));
  }

  const filteredRows = useMemo(
    () =>
      sortTableRows(
        rows.filter((row) =>
          matchesColumnFilters(columnFilters, {
            "Pull request": `#${row.prNumber} ${row.title} ${row.branch} ${row.branchTarget} ${row.author}`,
            Risk: riskLabel(row.riskLevel),
            Files: row.filesChanged,
            "Tests run": row.status === "running" ? "Running" : row.testsRun,
            Verdict: verdictLabel(row),
            Opened: shortDate(row.createdAt),
          }),
        ),
        sort,
        {
          "Pull request": (row) => `${row.prNumber} ${row.title}`,
          Risk: (row) => riskLabel(row.riskLevel),
          Files: (row) => row.filesChanged,
          "Tests run": (row) => (row.status === "running" ? "Running" : row.testsRun),
          Verdict: (row) => verdictLabel(row),
          Opened: (row) => row.createdAt,
        },
      ),
    [rows, columnFilters, sort],
  );
  const sortColumn = (column: string) => setSort((current) => nextTableSort(current, column));

  const columnOptions = useMemo(
    () => ({
      Risk: ["High", "Medium", "Low"],
      Verdict: distinctColumnValues(rows.map((row) => verdictLabel(row))),
    }),
    [rows],
  );

  function replace(row: PrDetailRow) {
    setRows((prev) => prev.map((item) => (item.id === row.id ? row : item)));
    setDetail((current) => (current?.id === row.id ? row : current));
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setModalOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#5b4ee8] px-3.5 text-[13px] font-medium text-white shadow-sm transition hover:bg-[#6d61ff] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CqaIcon name="add" className="text-[16px]" /> Analyse PR
        </button>
      </div>

      <div className={cqaCard}>
        {filteredRows.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-[14px] font-medium text-[#374151]">No data available</p>
            <p className="mt-1 text-[12.5px] text-[#9ca3af]">
              {rows.length === 0 ? "There is no data available to display." : "No pull request matches the current column filters."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f0f1f3]">
                  <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">
                    Pull request
                    <ColumnFilter column="Pull request" value={columnFilters["Pull request"] ?? ""} onChange={(value) => setColumnFilter("Pull request", value)} placeholder="Search title, branch or author…" />
                    <ColumnSort column="Pull request" sort={sort} onSort={sortColumn} />
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">
                    Risk
                    <ColumnFilter column="Risk" value={columnFilters.Risk ?? ""} onChange={(value) => setColumnFilter("Risk", value)} options={columnOptions.Risk} />
                    <ColumnSort column="Risk" sort={sort} onSort={sortColumn} />
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">
                    Files
                    <ColumnFilter column="Files" value={columnFilters.Files ?? ""} onChange={(value) => setColumnFilter("Files", value)} />
                    <ColumnSort column="Files" sort={sort} onSort={sortColumn} />
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">
                    Tests run
                    <ColumnFilter column="Tests run" value={columnFilters["Tests run"] ?? ""} onChange={(value) => setColumnFilter("Tests run", value)} />
                    <ColumnSort column="Tests run" sort={sort} onSort={sortColumn} />
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">
                    Verdict
                    <ColumnFilter column="Verdict" value={columnFilters.Verdict ?? ""} onChange={(value) => setColumnFilter("Verdict", value)} options={columnOptions.Verdict} />
                    <ColumnSort column="Verdict" sort={sort} onSort={sortColumn} />
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">
                    Opened
                    <ColumnFilter column="Opened" value={columnFilters.Opened ?? ""} onChange={(value) => setColumnFilter("Opened", value)} />
                    <ColumnSort column="Opened" sort={sort} onSort={sortColumn} />
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Action<ColumnSort column="Action" sort={sort} onSort={sortColumn} /></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
                    <td className="max-w-[380px] px-4 py-3">
                      <button type="button" onClick={() => setDetail(row)} className="max-w-full text-left">
                        <span className="block truncate font-medium text-[#1f2937] hover:text-[#5b4ee8]">
                          #{row.prNumber} {row.title}
                        </span>
                      </button>
                      <p className="truncate font-mono text-[11.5px] text-[#9ca3af]">
                        {row.branch} → {row.branchTarget} · @{row.author}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={row.riskLevel} label={riskLabel(row.riskLevel)} />
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-[#4b5563]">{row.filesChanged}</td>
                    <td className="px-4 py-3 text-[12.5px] text-[#4b5563]">{row.status === "running" ? "…" : row.testsRun}</td>
                    <td className="px-4 py-3">
                      <StatusPill value={row.status} label={verdictLabel(row)} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12px] text-[#6b7280]">{shortDate(row.createdAt)}</td>
                    <td className="px-4 py-3">
                      <RowMenu
                        label={`Actions for PR #${row.prNumber}`}
                        items={[
                          { label: "View details", icon: "visibility", onSelect: () => setDetail(row) },
                          { label: "Re-run analysis", icon: "refresh", disabled: readOnly, onSelect: () => setDetail(row) },
                          { label: "Export report", icon: "download", onSelect: () => exportReport(row) },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnalysePrModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAnalyzed={(row) => {
          setRows((prev) => [row, ...prev.filter((item) => item.id !== row.id)]);
          setDetail(row);
          router.refresh();
        }}
        readOnly={readOnly}
        nextNumber={nextNumber}
        onNeedIntegration={() => router.push("/dashboard/integrations")}
      />

      {detail && (
        <PrDetailDrawer
          row={detail}
          readOnly={readOnly}
          environments={environments}
          onClose={() => setDetail(null)}
          onUpdated={(row) => {
            replace(row);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
