"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CqaIcon,
  ErrorNote,
  Modal,
  cqaBtnPrimary,
  cqaBtnSecondary,
  cqaInput,
  cqaLabel,
} from "@/components/dashboard/ui";
import { apiFetch, errorMessage } from "@/lib/api";
import type { AutopilotResult } from "@/lib/autopilot";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const DEFAULT_PHASES: Array<{ id: AutopilotResult["phases"][number]["id"]; label: string; icon: string; hint: string }> = [
  { id: "crawl", label: "Live DOM crawl", icon: "travel_explore", hint: "Capture the rendered page and map real flows." },
  { id: "security", label: "Strix OWASP / header scan", icon: "shield", hint: "Passive headers, cookies, transport and OWASP surface." },
  { id: "graph", label: "Graphify topology", icon: "account_tree", hint: "Project crawl, DOM and tests into one quality graph." },
  { id: "authoring", label: "QASyn Framework Intelligence + Vision AI authoring", icon: "auto_awesome", hint: "Grounded test cases with AI Verification and scored locators." },
  { id: "execution", label: "Studio execution", icon: "play_circle", hint: "Run the new cases immediately in Test Studio." },
];

/**
 * One-click Quality Autopilot launcher. The modal keeps all five phases
 * visible while the server orchestrates them and links every artifact.
 */
export function AutopilotButton({
  defaultTarget = "https://www.cgi.com",
  readOnly = false,
  className,
  variant = "primary",
}: {
  defaultTarget?: string;
  readOnly?: boolean;
  className?: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(defaultTarget);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AutopilotResult | null>(null);

  async function launch() {
    if (pending) return;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const response = await apiFetch<AutopilotResult>("/api/dashboard/autopilot", {
        method: "POST",
        json: { targetUrl: target.trim() },
      });
      setResult(response);
      toast(
        `🚀 Quality Autopilot complete · ${response.testCases.length} test case(s) · Strix ${response.security.grade} · ${response.execution.passed}/${response.execution.total} passed`,
        "success",
      );
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  const phaseById = new Map(result?.phases.map((phase) => [phase.id, phase]) ?? []);
  const completed = result?.phases.filter((phase) => phase.status === "completed").length ?? 0;

  return (
    <>
      <button
        type="button"
        data-testid="autopilot-open"
        onClick={() => setOpen(true)}
        disabled={readOnly}
        className={cn(variant === "primary" ? cqaBtnPrimary : cqaBtnSecondary, "h-9 px-3.5 text-[12.5px]", className)}
      >
        <CqaIcon name="rocket_launch" className="text-[17px]" /> 🚀 Launch Quality Autopilot
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="🚀 Quality Autopilot" size="xl">
        <div className="space-y-4">
          <p className="text-[12.5px] leading-5 text-[#6b7280]">
            One click runs five live phases end to end: crawl the rendered app, scan its OWASP surface, build the Graphify
            topology, author QASyn Vision-calibrated test cases and execute them immediately in Test Studio.
          </p>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className={cqaLabel}>Target URL</span>
              <input
                className={cqaInput}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="https://www.cgi.com"
                data-testid="autopilot-target"
              />
            </label>
            <div className="flex items-end gap-1.5">
              {["https://gmailad.contextqa.com", "https://www.cgi.com"].map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setTarget(url)}
                  className="h-[38px] rounded-md border border-[#e5e7eb] bg-white px-2.5 text-[10.5px] font-medium text-[#4b5563] transition hover:border-[#c7d2fe] hover:bg-[#f5f3ff]"
                >
                  {url.replace("https://", "")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="autopilot-run"
              onClick={() => void launch()}
              disabled={readOnly || pending || !target.trim()}
              className={cn(cqaBtnPrimary, "h-9 px-4")}
            >
              <CqaIcon name={pending ? "hourglass_top" : "rocket_launch"} className="text-[17px]" />
              {pending ? "Autopilot running…" : result ? "Run again" : "🚀 Launch Quality Autopilot"}
            </button>
            {result && (
              <span className="rounded-full bg-[#ecfdf3] px-2.5 py-1 text-[11px] font-semibold text-[#067647]">
                {completed}/5 phases completed
              </span>
            )}
            {result && (
              <Link href={result.links.graphify} className="text-[11.5px] font-semibold text-[#5b4ee8] hover:underline">
                Open Graphify map
              </Link>
            )}
          </div>

          <ErrorNote error={error} />

          <ol className="space-y-2" data-testid="autopilot-phases">
            {DEFAULT_PHASES.map((definition, index) => {
              const phase = phaseById.get(definition.id);
              const running = pending && !result && index === 0;
              return (
                <li
                  key={definition.id}
                  data-testid={`autopilot-phase-${definition.id}`}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition",
                    phase?.status === "failed"
                      ? "border-[#fecdca] bg-[#fef3f2]"
                      : phase?.status === "completed"
                        ? "border-[#abefc6] bg-[#f0fdf4]"
                        : running
                          ? "border-[#c7d2fe] bg-[#eef2ff]"
                          : "border-[#eef0f3] bg-[#fcfcfd]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                      phase?.status === "failed"
                        ? "bg-[#fee4e2] text-[#b42318]"
                        : phase?.status === "completed"
                          ? "bg-[#dcfae6] text-[#067647]"
                          : running
                            ? "animate-pulse bg-[#e0e7ff] text-[#4f46e5]"
                            : "bg-[#f1f5f9] text-[#64748b]",
                    )}
                  >
                    {phase?.status === "completed" ? "✓" : phase?.status === "failed" ? "!" : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#111827]">
                        <CqaIcon name={definition.icon} className="text-[14px] text-[#5b4ee8]" /> {definition.label}
                      </span>
                      <span className="text-[10.5px] font-medium text-[#9ca3af]">
                        {pending && !result ? (running ? "running…" : "queued") : phase ? phase.metric : "waiting"}
                      </span>
                      {phase?.href && (
                        <Link href={phase.href} className="text-[10.5px] font-semibold text-[#5b4ee8] hover:underline">
                          Open
                        </Link>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#6b7280]">{phase?.detail ?? definition.hint}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          {result && (
            <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3" data-testid="autopilot-results">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="text-[12px] font-semibold text-[#111827]">Autopilot artifacts</span>
                  <p className="mt-0.5 text-[11px] font-medium text-[#4b5563]">
                    {result.testCases.length} grounded test case(s) authored · {result.execution.passed}/{result.execution.total} test case(s) passed in Test Studio
                  </p>
                </div>
                <Link
                  href={`/dashboard/test-cases?search=${encodeURIComponent((() => {
                    try {
                      return new URL(result.targetUrl).host;
                    } catch {
                      return result.targetUrl;
                    }
                  })())}`}
                  data-testid="autopilot-view-all"
                  className="text-[11px] font-semibold text-[#5b4ee8] hover:underline"
                >
                  View All in Test Cases →
                </Link>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-2 py-0.5 text-[10.5px] font-medium text-[#4b5563]">
                  Strix {result.security.grade} · {result.security.score}/100
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10.5px] font-medium text-[#4b5563]">
                  {result.graph.nodes} nodes · {result.graph.edges} edges
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10.5px] font-medium text-[#4b5563]">
                  {result.execution.passed}/{result.execution.total} passed
                </span>
              </div>

              <ul className="mt-3 divide-y divide-[#eef0f3] overflow-hidden rounded-lg border border-[#e5e7eb] bg-white" data-testid="autopilot-test-case-list">
                {result.testCases.map((testCase, index) => {
                  const status = testCase.status === "passing" ? "Passed" : testCase.status === "failing" ? "Failed" : testCase.status;
                  return (
                    <li key={testCase.id} data-testid="autopilot-test-case" className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <span className="rounded bg-[#eef2ff] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#4f46e5]">
                        {testCase.code || `TC-${String(index + 1).padStart(3, "0")}`}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-[#111827]" title={testCase.title}>
                        {testCase.title}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          status === "Passed" ? "bg-[#ecfdf3] text-[#067647]" : status === "Failed" ? "bg-[#fef3f2] text-[#b42318]" : "bg-[#f3f4f6] text-[#4b5563]",
                        )}
                      >
                        {status}
                      </span>
                      <Link
                        href={testCase.studioUrl || testCase.href}
                        data-testid="autopilot-test-link"
                        className="text-[10.5px] font-semibold text-[#4f46e5] hover:underline"
                      >
                        Open in Studio →
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <Link
                  href={result.links.security}
                  data-testid="autopilot-strix-link"
                  className="inline-flex items-center gap-1 rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-[11px] font-semibold text-[#374151] hover:bg-[#f9fafb]"
                >
                  <CqaIcon name="shield" className="text-[13px]" /> Open Strix report
                </Link>
                <Link
                  href={result.links.graphify}
                  data-testid="autopilot-graph-link"
                  className="inline-flex items-center gap-1 rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-[11px] font-semibold text-[#374151] hover:bg-[#f9fafb]"
                >
                  <CqaIcon name="account_tree" className="text-[13px]" /> Open Graphify map
                </Link>
                <Link
                  href={result.links.crawl}
                  className="inline-flex items-center gap-1 rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-[11px] font-semibold text-[#374151] hover:bg-[#f9fafb]"
                >
                  <CqaIcon name="travel_explore" className="text-[13px]" /> Open crawl
                </Link>
              </div>
              <p className="mt-2 text-[10.5px] text-[#9ca3af]">
                Crawl {result.crawlId} · completed {new Date(result.completedAt).toLocaleTimeString("en-US")}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
