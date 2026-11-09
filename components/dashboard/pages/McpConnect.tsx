"use client";

import { useEffect, useState } from "react";
import { CqaIcon, cqaBtnPrimary, cqaBtnSecondary, cqaCard, cqaIconBtn } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

const MCP_URL = "https://mcp.contextqa.com/mcp";
const DOCS_URL = "https://mcp.contextqa.com/docs";

const AGENT_PROMPT =
  "Install the ContextQA skills. If you're in Claude Code, run claude plugin marketplace add indivatools/contextqa-skills, then claude plugin install contextqa@contextqa — that installs all thirteen skills and wires up the hosted ContextQA MCP server in one step. If you're in another agent, run npx skills add indivatools/contextqa-skills and select your agent, then point your MCP client at https://mcp.contextqa.com/mcp (setup per client: https://mcp.contextqa.com/docs). Use one installation method. The first MCP tool call opens a browser to sign in — keep the redirect tab open until it finishes. You can read the master skill directly at https://github.com/indivatools/contextqa-skills/blob/main/skills/contextqa/SKILL.md (raw: https://raw.githubusercontent.com/indivatools/contextqa-skills/main/skills/contextqa/SKILL.md). Then use the ContextQA skill when working on tests for this project, and run /cqa-init once to confirm the connection and see what the tenant holds.";

const CODEX_CONFIG = `[mcp_servers.contextqa]\nurl = "https://mcp.contextqa.com/mcp"`;
const CLAUDE_CODE_CONFIG = `{\n  "mcpServers": {\n    "contextqa": {\n      "type": "http",\n      "url": "https://mcp.contextqa.com/mcp"\n    }\n  }\n}`;
const CLAUDE_CODE_COMMAND = "claude mcp add --transport http contextqa https://mcp.contextqa.com/mcp";
const CURSOR_CONFIG = `{\n  "mcpServers": {\n    "contextqa": {\n      "url": "https://mcp.contextqa.com/mcp"\n    }\n  }\n}`;

type ClientKey = "chatgpt" | "claude" | "codex" | "claude-code" | "cursor";

interface Client {
  key: ClientKey;
  name: string;
  description: string;
  icon: string;
}

const CLIENTS: Client[] = [
  { key: "chatgpt", name: "ChatGPT", description: "Chat assistant · Desktop & web", icon: "forum" },
  { key: "claude", name: "Claude", description: "Chat assistant · Desktop & web", icon: "smart_toy" },
  { key: "codex", name: "Codex", description: "Coding agent · Terminal", icon: "terminal" },
  { key: "claude-code", name: "Claude Code", description: "Coding agent · Terminal", icon: "code" },
  { key: "cursor", name: "Cursor", description: "Code editor · IDE", icon: "edit_square" },
];

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }
  return { copied, copy };
}

function CodeLine({ value, copied, onCopy, id }: { value: string; copied: boolean; onCopy: () => void; id: string }) {
  return (
    <div className="flex items-start gap-2">
      <pre className="min-w-0 flex-1 overflow-x-auto rounded-md bg-[#10141c] px-3 py-2 text-[11.5px] leading-5 text-[#e2e8f0]"><code>{value}</code></pre>
      <button type="button" className={cn(cqaIconBtn, "mt-1 shrink-0")} aria-label="Copy" onClick={onCopy}>
        <CqaIcon name={copied ? "check" : "content_copy"} className="text-[16px]" />
      </button>
    </div>
  );
}

function SegmentTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-[#f3f4f6] p-[3px]">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          onClick={() => onChange(tab)}
          className={cn(
            "rounded-md px-2.5 py-[3px] text-[11px] font-medium transition",
            active === tab ? "bg-[#5b4ee8] text-white" : "text-[#6b7280] hover:text-[#111827]",
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function ClientPanel({ client }: { client: Client }) {
  const { copied, copy } = useCopy();
  const [method, setMethod] = useState("Command");

  useEffect(() => {
    setMethod("Command");
  }, [client.key]);

  const header = (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-lg bg-[#f5f3ff] text-[#5b4ee8]">
        <CqaIcon name={client.icon} className="text-[21px]" />
      </span>
      <div>
        <h2 className="text-[15px] font-semibold text-[#111827]">{client.name}</h2>
        <p className="text-[11.5px] text-[#9ca3af]">{client.description} · about 2 minutes to set up</p>
      </div>
    </div>
  );

  if (client.key === "chatgpt" || client.key === "claude") {
    const isClaude = client.key === "claude";
    return (
      <div className="space-y-4">
        {header}
        <div>
          <h3 className="text-[13px] font-semibold text-[#111827]">Add the ContextQA connector</h3>
          <p className="mt-1.5 text-[12.5px] leading-5 text-[#6b7280]">
            Name the {isClaude ? "custom " : ""}connector ContextQA, paste the server URL and {isClaude ? "click Add" : "choose Connect"}.{" "}
            {isClaude
              ? "Claude opens the ContextQA sign-in; complete OAuth and return."
              : "ChatGPT opens the ContextQA sign-in in your browser; complete OAuth and return."}
          </p>
        </div>
        <CodeLine value={MCP_URL} id={`${client.key}-url`} copied={copied === `${client.key}-url`} onCopy={() => void copy(`${client.key}-url`, MCP_URL)} />
        <button type="button" className={cqaBtnPrimary} onClick={() => void copy(`${client.key}-all`, MCP_URL)}>
          <CqaIcon name="content_copy" className="text-[16px]" />
          {copied === `${client.key}-all` ? "Copied" : "Copy configuration"}
        </button>
      </div>
    );
  }

  if (client.key === "codex") {
    const isProject = method === "Project";
    const value = isProject ? CODEX_CONFIG : "codex mcp add contextqa --url https://mcp.contextqa.com/mcp";
    return (
      <div className="space-y-4">
        {header}
        <div>
          <h3 className="text-[13px] font-semibold text-[#111827]">Register the ContextQA server</h3>
          <div className="mt-2">
            <SegmentTabs tabs={["Command", "Project"]} active={method} onChange={setMethod} />
          </div>
          <p className="mt-2 text-[12.5px] leading-5 text-[#6b7280]">
            {isProject
              ? "Applies only inside this trusted project. Do not put OAuth credentials in config.toml."
              : "Run once in the terminal where Codex runs. This writes the server to your user-level Codex configuration."}
          </p>
          {isProject && <p className="mt-2 font-mono text-[11.5px] text-[#374151]">.codex/config.toml</p>}
          <div className="mt-2">
            <CodeLine value={value} id="codex" copied={copied === "codex"} onCopy={() => void copy("codex", value)} />
          </div>
          <p className="mt-2 text-[11.5px] leading-4 text-[#6b7280]">
            {isProject ? (
              <>After saving, run <code className="rounded bg-[#f3f4f6] px-1">codex mcp login contextqa</code> and restart the active Codex session.</>
            ) : (
              <>Verify and authenticate: <code className="rounded bg-[#f3f4f6] px-1">codex mcp get contextqa</code>, then <code className="rounded bg-[#f3f4f6] px-1">codex mcp login contextqa</code>, then <code className="rounded bg-[#f3f4f6] px-1">codex mcp list</code>.</>
            )}
          </p>
        </div>
        <button type="button" className={cqaBtnPrimary} onClick={() => void copy("codex-all", value)}>
          <CqaIcon name="content_copy" className="text-[16px]" />
          {copied === "codex-all" ? "Copied" : "Copy configuration"}
        </button>
      </div>
    );
  }

  if (client.key === "claude-code") {
    const isProject = method === "Project";
    const value = isProject ? CLAUDE_CODE_CONFIG : CLAUDE_CODE_COMMAND;
    return (
      <div className="space-y-4">
        {header}
        <div>
          <h3 className="text-[13px] font-semibold text-[#111827]">Register the ContextQA server</h3>
          <div className="mt-2">
            <SegmentTabs tabs={["Command", "Project"]} active={method} onChange={setMethod} />
          </div>
          <p className="mt-2 text-[12.5px] leading-5 text-[#6b7280]">
            {isProject ? "Project-scoped servers may require workspace trust or approval." : "Run once in your project."}
          </p>
          {isProject && <p className="mt-2 font-mono text-[11.5px] text-[#374151]">.mcp.json</p>}
          <div className="mt-2">
            <CodeLine value={value} id="claude-code" copied={copied === "claude-code"} onCopy={() => void copy("claude-code", value)} />
          </div>
          <p className="mt-2 text-[11.5px] leading-4 text-[#6b7280]">
            Use <code className="rounded bg-[#f3f4f6] px-1">/mcp</code> inside Claude Code to inspect status or complete authentication.
          </p>
        </div>
        <button type="button" className={cqaBtnPrimary} onClick={() => void copy("claude-code-all", value)}>
          <CqaIcon name="content_copy" className="text-[16px]" />
          {copied === "claude-code-all" ? "Copied" : "Copy configuration"}
        </button>
      </div>
    );
  }

  const isProject = method === "Project";
  return (
    <div className="space-y-4">
      {header}
      <div>
        <h3 className="text-[13px] font-semibold text-[#111827]">Add the ContextQA configuration</h3>
        <div className="mt-2">
          <SegmentTabs tabs={["Global", "Project"]} active={method} onChange={setMethod} />
        </div>
        <p className="mt-2 text-[12.5px] leading-5 text-[#6b7280]">
          {isProject ? "Applies only to this project." : "Applies to every Cursor project on this machine."}
        </p>
        <p className="mt-1 font-mono text-[11.5px] text-[#374151]">{isProject ? ".cursor/mcp.json" : "~/.cursor/mcp.json"}</p>
        <div className="mt-2">
          <CodeLine value={CURSOR_CONFIG} id="cursor" copied={copied === "cursor"} onCopy={() => void copy("cursor", CURSOR_CONFIG)} />
        </div>
        <p className="mt-2 text-[11.5px] leading-4 text-[#6b7280]">
          Then open Cursor Settings → MCP, find ContextQA and choose Login or Connect to complete OAuth.
        </p>
      </div>
      <button type="button" className={cqaBtnPrimary} onClick={() => void copy("cursor-all", CURSOR_CONFIG)}>
        <CqaIcon name="content_copy" className="text-[16px]" />
        {copied === "cursor-all" ? "Copied" : "Copy configuration"}
      </button>
    </div>
  );
}

export function McpConnect() {
  const [active, setActive] = useState<ClientKey>("chatgpt");
  const [skillOpen, setSkillOpen] = useState(false);
  const [skill, setSkill] = useState<string>("");
  const [loadingSkill, setLoadingSkill] = useState(false);
  const { copied, copy } = useCopy();
  const client = CLIENTS.find((item) => item.key === active) ?? CLIENTS[0];

  async function loadSkill() {
    if (skill) return skill;
    setLoadingSkill(true);
    try {
      const response = await fetch("/contextqa-skill.md");
      const text = await response.text();
      setSkill(text);
      return text;
    } catch {
      const fallback = "Skill preview is unavailable right now.";
      setSkill(fallback);
      return fallback;
    } finally {
      setLoadingSkill(false);
    }
  }

  async function downloadSkill() {
    const content = await loadSkill();
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "SKILL.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.01em] text-[#111827]">Connect ContextQA</h1>
        <p className="mt-1 max-w-3xl text-[13.5px] leading-5 text-[#6b7280]">
          Use ContextQA from ChatGPT, Claude, Cursor, Codex or another MCP-compatible client.
        </p>
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noreferrer"
          className={cn(cqaBtnSecondary, "mt-3")}
        >
          <CqaIcon name="description" className="text-[16px]" /> Documentation
        </a>
      </div>

      <section className={cn(cqaCard, "p-4")}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Agent skill</p>
            <h2 className="mt-1 text-[18px] font-semibold text-[#111827]">Use ContextQA with your AI agent</h2>
            <p className="mt-2 max-w-2xl text-[12.5px] leading-5 text-[#6b7280]">
              Download the ContextQA skill and give it to any compatible AI agent. It teaches the agent how and when to use
              ContextQA to investigate test failures, reproduce bugs and work with your testing workflows.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className={cqaBtnPrimary} onClick={() => void downloadSkill()} disabled={!skill && loadingSkill}>
                <CqaIcon name="download" className="text-[16px]" /> Download skill
              </button>
              <button
                type="button"
                className={cqaBtnSecondary}
                onClick={() => {
                  setSkillOpen(true);
                  void loadSkill();
                }}
              >
                View skill
              </button>
              <button type="button" className={cqaBtnSecondary} onClick={() => void copy("agent-prompt", AGENT_PROMPT)}>
                <CqaIcon name="content_copy" className="text-[16px]" />
                {copied === "agent-prompt" ? "Agent prompt copied" : "Copy agent prompt"}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-[#6b7280]">
              <CqaIcon name="encrypted" className="text-[15px] text-[#9ca3af]" />
              No ContextQA credentials in the file
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSkillOpen(true)}
            className="rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-3 text-left transition hover:border-[#cbc6fb]"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-white text-[#5b4ee8] shadow-sm">
                <CqaIcon name="draft" className="text-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[#111827]">SKILL.md</p>
                <p className="text-[10.5px] text-[#9ca3af]">Platform-independent</p>
              </div>
              <CqaIcon name="open_in_full" className="ml-auto text-[16px] text-[#9ca3af]" />
            </div>
            <p className="mt-2 line-clamp-3 text-[10.5px] leading-4 text-[#9ca3af]">
              ---
              <br />
              name: contextqa
              <br />
              license: MIT
            </p>
          </button>
        </div>
      </section>

      <section className={cn(cqaCard, "overflow-hidden")}>
        <div className="grid lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav aria-label="MCP clients" className="border-b border-[#f0f1f3] bg-[#fafafa] p-2 lg:border-b-0 lg:border-r">
            <p className="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Clients</p>
            {CLIENTS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActive(item.key)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition",
                  active === item.key ? "bg-white text-[#111827] shadow-sm ring-1 ring-[#e5e7eb]" : "text-[#4b5563] hover:bg-white/70",
                )}
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", active === item.key ? "bg-[#f5f3ff] text-[#5b4ee8]" : "bg-white text-[#6b7280]")}>
                  <CqaIcon name={item.icon} className="text-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-medium">{item.name}</span>
                  <span className="block truncate text-[10.5px] text-[#9ca3af]">{item.description}</span>
                </span>
              </button>
            ))}
          </nav>
          <div className="p-4 lg:p-5">
            <ClientPanel key={client.key} client={client} />
          </div>
        </div>
      </section>

      {skillOpen && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Skill preview">
          <button type="button" aria-label="Close skill preview" className="flex-1 bg-[#0f172a]/40" onClick={() => setSkillOpen(false)} />
          <aside className="flex h-full w-full max-w-[720px] flex-col bg-white shadow-[-24px_0_60px_rgba(15,23,42,0.18)]">
            <header className="flex items-start justify-between gap-3 border-b border-[#e5e7eb] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-[#f5f3ff] text-[#5b4ee8]">
                  <CqaIcon name="draft" className="text-[19px]" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-[#111827]">SKILL.md</p>
                  <p className="text-[11px] text-[#9ca3af]">Read-only · Platform-independent · No credentials included</p>
                </div>
              </div>
              <button type="button" className={cqaIconBtn} aria-label="Close" onClick={() => setSkillOpen(false)}>
                <CqaIcon name="close" className="text-[18px]" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="text-[12px] leading-4 text-[#6b7280]">
                This skill teaches your agent when and how to use the ContextQA tools available through your MCP connection.
                It contains instructions only; it never includes credentials or workspace data.
              </p>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3 text-[11.5px] leading-[18px] text-[#374151]">
                {loadingSkill ? "Loading skill…" : skill}
              </pre>
            </div>
            <footer className="flex items-center justify-between gap-3 border-t border-[#e5e7eb] px-5 py-3">
              <p className="max-w-[360px] text-[11px] leading-4 text-[#9ca3af]">
                Add this skill to any agent that supports the Agent Skills format.
              </p>
              <button type="button" className={cqaBtnPrimary} onClick={downloadSkill}>
                <CqaIcon name="download" className="text-[16px]" /> Download skill
              </button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
