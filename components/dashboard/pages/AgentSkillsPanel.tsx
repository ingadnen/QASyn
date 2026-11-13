"use client";

import { useState } from "react";
import { CqaIcon, cqaBtnPrimary, cqaBtnSecondary, Card } from "@/components/dashboard/ui";
import type { AgentSkill } from "@/lib/agent-skills";
import { apiFetch, errorMessage } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Context7Result {
  resolved: boolean;
  score: number;
  library: { name: string; version: string; docsUrl: string };
  rules: string[];
  injectedPrompt: string;
  source: string;
}

/**
 * Agent Skills Library + Context7 resolver shared by Dashboard → Context and
 * Dashboard → MCP. Skills are toggled per organisation and exported as agent
 * instruction files; Context7 resolves task queries to versioned library rules.
 */
export function AgentSkillsPanel({
  skills,
  initialEnabled,
  readOnly,
}: {
  skills: AgentSkill[];
  initialEnabled: string[];
  readOnly: boolean;
}) {
  const [enabled, setEnabled] = useState<string[]>(initialEnabled);
  const [pending, setPending] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<{ path: string; content: string } | null>(null);
  const [query, setQuery] = useState("Playwright accessible locator for a checkout button");
  const [result, setResult] = useState<Context7Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(skill: AgentSkill) {
    const isEnabled = enabled.includes(skill.id);
    setPending(skill.id);
    try {
      const payload = await apiFetch<{ enabled: string[] }>("/api/dashboard/agent-skills", {
        method: "POST",
        json: { action: "toggle", id: skill.id, enabled: !isEnabled },
      });
      setEnabled(payload.enabled);
      toast(`${skill.title} ${isEnabled ? "disabled" : "enabled"}.`, "success");
    } catch (cause) {
      toast(errorMessage(cause), "error");
    } finally {
      setPending(null);
    }
  }

  async function exportSkills(target: "claude" | "copilot" | "opencode") {
    setPending(`export-${target}`);
    try {
      const payload = await apiFetch<{ path: string; content: string }>("/api/dashboard/agent-skills", {
        method: "POST",
        json: { action: "export", target },
      });
      setExportResult(payload);
      toast(`${payload.path} generated. Copy it into the repository.`, "success");
    } catch (cause) {
      toast(errorMessage(cause), "error");
    } finally {
      setPending(null);
    }
  }

  async function resolve(value = query) {
    setLoading(true);
    setError(null);
    try {
      setResult(await apiFetch<Context7Result>("/api/dashboard/context7", { method: "POST", json: { query: value } }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2" data-testid="context-agent-tools">
      <Card title={`Agent Skills Library (${enabled.length}/${skills.length} enabled)`}>
        <div className="space-y-2 px-5 py-4">
          <div className="flex flex-wrap gap-1.5">
            {(["claude", "copilot", "opencode"] as const).map((target) => (
              <button
                key={target}
                type="button"
                data-export={target}
                disabled={readOnly || pending === `export-${target}`}
                onClick={() => void exportSkills(target)}
                className={cn(cqaBtnSecondary, "h-8 px-2.5 text-[11.5px]")}
              >
                <CqaIcon name="download" className="text-[14px]" />
                {target === "claude" ? ".claude/CLAUDE.md" : target === "copilot" ? ".github/copilot-instructions.md" : "opencode.json"}
              </button>
            ))}
          </div>
          {skills.map((skill) => {
            const on = enabled.includes(skill.id);
            return (
              <div
                key={skill.id}
                data-skill={skill.id}
                className={cn("rounded-lg border px-3 py-2", on ? "border-[#c7d2fe] bg-[#faf9ff]" : "border-[#eef0f3]")}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#111827]">
                    <CqaIcon name={skill.icon} className={cn("text-[15px]", on ? "text-[#4f46e5]" : "text-[#9ca3af]")} />
                    {skill.title}
                  </p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={`${on ? "Disable" : "Enable"} ${skill.title}`}
                    disabled={readOnly || pending === skill.id}
                    onClick={() => void toggle(skill)}
                    className={cn("relative h-5 w-9 shrink-0 rounded-full transition disabled:opacity-50", on ? "bg-[#5b4ee8]" : "bg-[#d1d5db]")}
                  >
                    <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition", on ? "left-[18px]" : "left-0.5")} />
                  </button>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-[#6b7280]">{skill.description}</p>
              </div>
            );
          })}
          {exportResult && (
            <div className="pt-1">
              <p className="mb-1 font-mono text-[10.5px] text-[#6b7280]">{exportResult.path}</p>
              <pre className="max-h-40 overflow-auto rounded-lg bg-[#10141c] p-2.5 text-[10.5px] leading-4 text-[#e2e8f0]">
                <code>{exportResult.content}</code>
              </pre>
            </div>
          )}
        </div>
      </Card>

      <Card title="QASyn Framework Intelligence">
        <div className="space-y-2 px-5 py-4" data-testid="context7-resolver">
          <p className="text-[12px] leading-5 text-[#6b7280]">
            Resolve a task to versioned library rules. The resolver feeds test generation and auto-healing with the same
            Playwright, Next.js, Tailwind, Prisma and TypeScript constraints.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <input
              className="h-9 min-w-[220px] flex-1 rounded-lg border border-[#e5e7eb] px-3 text-[12.5px] outline-none focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="QASyn Framework Intelligence query"
            />
            <button type="button" className={cqaBtnPrimary} disabled={loading} onClick={() => void resolve()}>
              <CqaIcon name="search" className="text-[15px]" />
              {loading ? "Resolving…" : "Resolve"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Playwright", "Next.js", "Tailwind CSS", "Prisma", "TypeScript"].map((name) => (
              <button
                key={name}
                type="button"
                className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[10.5px] font-medium text-[#4b5563] hover:bg-[#e9eaee]"
                onClick={() => {
                  const next = `${name} best practice for QASyn tests`;
                  setQuery(next);
                  void resolve(next);
                }}
              >
                {name}
              </button>
            ))}
          </div>
          {error && <p role="alert" className="rounded border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11.5px] text-rose-700">{error}</p>}
          {result && (
            <div className="rounded-lg border border-[#eef0f3] bg-[#fafafa] p-2.5">
              <p className="flex items-center justify-between gap-2 text-[12px] font-semibold text-[#111827]">
                {result.library.name} <span className="font-mono text-[10.5px] font-normal text-[#6b7280]">v{result.library.version}</span>
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] leading-4 text-[#4b5563]">
                {result.rules.map((rule) => <li key={rule}>{rule}</li>)}
              </ul>
              <a href={result.library.docsUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-[10.5px] font-medium text-[#5b4ee8] hover:underline">
                {result.source}
              </a>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
