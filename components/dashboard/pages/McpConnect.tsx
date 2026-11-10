"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CqaIcon,
  cqaBtnPrimary,
  cqaBtnSecondary,
  cqaCard,
  cqaIconBtn,
  cqaInput,
  cqaLabel,
} from "@/components/dashboard/ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { can } from "@/lib/rbac";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** Local MCP endpoints served by this QASyn instance. */
const MCP_SSE = "http://localhost:3000/api/mcp/sse";
const MCP_JSONRPC = "http://localhost:3000/api/mcp";
const TOKEN_PLACEHOLDER = "cqa_REPLACE_WITH_YOUR_TOKEN";

export interface McpTokenRow {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

type ClientKey =
  | "claude-code"
  | "claude-desktop"
  | "cursor"
  | "vscode"
  | "windsurf"
  | "openai"
  | "custom";

interface ClientDefinition {
  key: ClientKey;
  name: string;
  description: string;
  icon: string;
  file: string;
  steps: string[];
}

const CLIENTS: ClientDefinition[] = [
  {
    key: "claude-code",
    name: "Claude Code",
    description: "CLI coding agent — terminal",
    icon: "code",
    file: "Terminal / .mcp.json",
    steps: [
      "Run the command once in the project where Claude Code runs.",
      "Open /mcp inside Claude Code and confirm qasyn is connected.",
    ],
  },
  {
    key: "claude-desktop",
    name: "Claude Desktop",
    description: "Chat assistant — desktop",
    icon: "smart_toy",
    file: "claude_desktop_config.json",
    steps: [
      "Open Settings → Developer → Edit Config.",
      "Paste the configuration, save and restart Claude Desktop.",
    ],
  },
  {
    key: "cursor",
    name: "Cursor",
    description: "Code editor — IDE",
    icon: "edit_square",
    file: ".cursor/mcp.json",
    steps: [
      "Create .cursor/mcp.json at the project root (or ~/.cursor/mcp.json for every project).",
      "Open Cursor Settings → MCP and enable the qasyn server.",
    ],
  },
  {
    key: "vscode",
    name: "VS Code Copilot",
    description: "Agent mode — VS Code",
    icon: "terminal",
    file: ".vscode/mcp.json",
    steps: [
      "Add .vscode/mcp.json to the workspace.",
      "Run “MCP: List Servers” from the Command Palette and start qasyn.",
    ],
  },
  {
    key: "windsurf",
    name: "Windsurf",
    description: "Cascade agent — IDE",
    icon: "air",
    file: "~/.codeium/windsurf/mcp_config.json",
    steps: [
      "Open the Windsurf MCP configuration file.",
      "Paste the JSON and click Refresh in the Cascade MCP panel.",
    ],
  },
  {
    key: "openai",
    name: "OpenAI / ChatGPT",
    description: "Connector — web & desktop",
    icon: "forum",
    file: "ChatGPT connector",
    steps: [
      "Open ChatGPT Settings → Connectors → Advanced → Developer mode.",
      "Create a connector named QASyn and paste the SSE URL including the token query parameter.",
    ],
  },
  {
    key: "custom",
    name: "Custom SSE",
    description: "Any MCP-compatible client",
    icon: "cable",
    file: "JSON-RPC over HTTP",
    steps: [
      "Point the client at the SSE endpoint and send the bearer token.",
      "Send initialize, then tools/list and tools/call as JSON-RPC 2.0.",
    ],
  },
];

interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  icon: string;
  sample: Record<string, unknown>;
}

/** The six tools featured on this page; all are executable below. */
const TOOLS: ToolDefinition[] = [
  {
    name: "qasyn_get_quality_summary",
    label: "Quality summary",
    description: "Coverage, pass rate, regressions, bugs and cost avoided.",
    icon: "monitoring",
    sample: {},
  },
  {
    name: "qasyn_list_test_cases",
    label: "List test cases",
    description: "Test cases with module, criticality and status.",
    icon: "fact_check",
    sample: {},
  },
  {
    name: "qasyn_run_test_case",
    label: "Run a test case",
    description: "Execute one test case and return its status and evidence.",
    icon: "play_circle",
    sample: { testCaseId: "" },
  },
  {
    name: "qasyn_start_crawl",
    label: "Start a crawl",
    description: "Crawl the organisation website and map new flows.",
    icon: "travel_explore",
    sample: {},
  },
  {
    name: "qasyn_analyze_pr",
    label: "Analyze a PR",
    description: "Map changed files, select impacted tests and decide Go/No-Go.",
    icon: "merge",
    sample: {
      prNumber: 812,
      branch: "feat/checkout-wallet",
      title: "Add wallet payments to checkout",
      files: ["src/checkout/wallet.tsx", "src/api/payments/route.ts", "src/billing/invoice.ts"],
    },
  },
  {
    name: "qasyn_list_bugs",
    label: "List bugs",
    description: "Reproduced bugs with root cause and severity.",
    icon: "bug_report",
    sample: {},
  },
];

const ROLE_GUIDES: Array<{
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  tools: string[];
  prompts: string[];
}> = [
  {
    key: "admin",
    title: "Admin",
    subtitle: "Full workspace access",
    icon: "shield_person",
    tools: ["qasyn_get_quality_summary", "qasyn_list_test_cases", "qasyn_list_bugs", "qasyn_analyze_pr"],
    prompts: [
      "Summarise quality for this workspace and list the top three risks.",
      "Which critical test cases are failing, and which bugs do they map to?",
      "Analyse the latest open PR and tell me whether it is safe to merge.",
    ],
  },
  {
    key: "qa",
    title: "QA",
    subtitle: "Test lifecycle",
    icon: "fact_check",
    tools: ["qasyn_list_test_cases", "qasyn_run_test_case", "qasyn_list_bugs", "qasyn_start_crawl"],
    prompts: [
      "List the critical test cases in the Checkout module.",
      "Run test case <id> and show me the failure evidence.",
      "Crawl the website and list the flows that have no test yet.",
    ],
  },
  {
    key: "engineer",
    title: "Engineer / Dev",
    subtitle: "PR, code and tunnels",
    icon: "code",
    tools: ["qasyn_analyze_pr", "qasyn_run_test_case", "qasyn_get_quality_summary", "qasyn_list_bugs"],
    prompts: [
      "Analyse PR #812 and return the blast radius and impacted tests.",
      "Run the impacted checkout tests and post the verdict.",
      "Show me the open bugs with a root cause in auth/refresh.",
    ],
  },
  {
    key: "ba",
    title: "Manager / Simple user (BA / FA)",
    subtitle: "Requirements, review and reporting",
    icon: "description",
    tools: ["qasyn_get_quality_summary", "qasyn_list_test_cases", "qasyn_list_bugs"],
    prompts: [
      "Which requirements have no passing test coverage?",
      "Summarise this release in business terms for the steering committee.",
      "List the reproduced bugs that affect the checkout journey.",
    ],
  },
];

function jsonBlock(value: string) {
  return value;
}

function clientSnippet(key: ClientKey, token: string): { title: string; body: string; language: string } {
  const auth = `Bearer ${token}`;
  switch (key) {
    case "claude-code":
      return {
        title: "Register the server",
        language: "bash",
        body: `claude mcp add --transport sse qasyn ${MCP_SSE} \\\n  --header "Authorization: ${auth}"`,
      };
    case "claude-desktop":
      return {
        title: "claude_desktop_config.json",
        language: "json",
        body: JSON.stringify(
          {
            mcpServers: {
              qasyn: {
                url: MCP_SSE,
                headers: { Authorization: auth },
              },
            },
          },
          null,
          2,
        ),
      };
    case "cursor":
      return {
        title: ".cursor/mcp.json",
        language: "json",
        body: JSON.stringify(
          {
            mcpServers: {
              qasyn: {
                url: MCP_SSE,
                headers: { Authorization: auth },
              },
            },
          },
          null,
          2,
        ),
      };
    case "vscode":
      return {
        title: ".vscode/mcp.json",
        language: "json",
        body: JSON.stringify(
          {
            servers: {
              qasyn: {
                type: "sse",
                url: MCP_SSE,
                headers: { Authorization: auth },
              },
            },
          },
          null,
          2,
        ),
      };
    case "windsurf":
      return {
        title: "mcp_config.json",
        language: "json",
        body: JSON.stringify(
          {
            mcpServers: {
              qasyn: {
                serverUrl: MCP_SSE,
                headers: { Authorization: auth },
              },
            },
          },
          null,
          2,
        ),
      };
    case "openai":
      return {
        title: "Connector URL",
        language: "text",
        body: `${MCP_SSE}?token=${token}`,
      };
    default:
      return {
        title: "JSON-RPC over HTTP",
        language: "bash",
        body: [
          `# initialize`,
          `curl -s ${MCP_JSONRPC} \\`,
          `  -H "Authorization: ${auth}" \\`,
          `  -H "Content-Type: application/json" \\`,
          `  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'`,
          ``,
          `# list tools`,
          `curl -s ${MCP_JSONRPC} \\`,
          `  -H "Authorization: ${auth}" \\`,
          `  -H "Content-Type: application/json" \\`,
          `  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'`,
        ].join("\n"),
      };
  }
}

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

function CopyButton({ id, value, label }: { id: string; value: string; label?: string }) {
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      className={cn(cqaBtnSecondary, "h-8 shrink-0 px-2.5 text-[11.5px]")}
      onClick={() => void copy(id, value)}
      aria-label={label ?? "Copy"}
    >
      <CqaIcon name={copied === id ? "check" : "content_copy"} className="text-[15px]" />
      {copied === id ? "Copied" : label ?? "Copy"}
    </button>
  );
}

function CodePanel({ title, body, id }: { title: string; body: string; id: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] font-medium text-[#6b7280]">{title}</p>
        <CopyButton id={id} value={body} />
      </div>
      <pre className="max-h-[340px] overflow-auto rounded-lg bg-[#10141c] p-3 text-[11.5px] leading-5 text-[#e2e8f0]">
        <code>{jsonBlock(body)}</code>
      </pre>
    </div>
  );
}

export function McpConnect({ tokens: initialTokens, role: userRole }: { tokens: McpTokenRow[]; role: string }) {
  const [tokens, setTokens] = useState<McpTokenRow[]>(initialTokens);
  const [activeTokenId, setActiveTokenId] = useState<string>(initialTokens[0]?.id ?? "");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeClient, setActiveClient] = useState<ClientKey>("claude-code");
  const [activeRole, setActiveRole] = useState("admin");
  const [toolName, setToolName] = useState(TOOLS[0].name);
  const [argsText, setArgsText] = useState(JSON.stringify(TOOLS[0].sample, null, 2));
  const [response, setResponse] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const canGenerate = can(userRole, "mcpTokens");

  const token = generatedToken && activeTokenId === tokens[0]?.id ? generatedToken : TOKEN_PLACEHOLDER;
  const client = CLIENTS.find((item) => item.key === activeClient) ?? CLIENTS[0];
  const snippet = useMemo(() => clientSnippet(client.key, token), [client.key, token]);
  const role = ROLE_GUIDES.find((item) => item.key === activeRole) ?? ROLE_GUIDES[0];
  const tool = TOOLS.find((item) => item.name === toolName) ?? TOOLS[0];

  useEffect(() => {
    setArgsText(JSON.stringify(tool.sample, null, 2));
    setResponse(null);
    setRunError(null);
  }, [tool]);

  async function generateToken() {
    setGenerating(true);
    try {
      const result = await apiFetch<{
        token: string;
        apiToken: { id: string; name: string; tokenPrefix: string; scopesJson: string; createdAt: string; lastUsedAt: string | null };
      }>("/api/dashboard/api-tokens", {
        method: "POST",
        json: {
          name: `MCP · ${new Date().toLocaleDateString()}`,
          scopes: ["mcp:read", "mcp:run"],
          expiresInDays: 90,
          ipAllowlist: [],
        },
      });
      const row: McpTokenRow = {
        id: result.apiToken.id,
        name: result.apiToken.name,
        tokenPrefix: result.apiToken.tokenPrefix,
        scopes: ["mcp:read", "mcp:run"],
        createdAt: result.apiToken.createdAt,
        lastUsedAt: null,
      };
      setTokens((prev) => [row, ...prev]);
      setGeneratedToken(result.token);
      setActiveTokenId(row.id);
      toast("MCP token generated. Copy it now — it is shown only once.", "success");
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setGenerating(false);
    }
  }

  async function runTool() {
    setRunning(true);
    setRunError(null);
    setResponse(null);
    try {
      let args: Record<string, unknown> = {};
      if (argsText.trim()) args = JSON.parse(argsText) as Record<string, unknown>;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (generatedToken && activeTokenId === tokens[0]?.id) headers.Authorization = `Bearer ${generatedToken}`;
      const started = performance.now();
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: { name: toolName, arguments: args },
        }),
      });
      const payload = (await res.json()) as Record<string, unknown>;
      const elapsed = Math.round(performance.now() - started);
      setResponse(JSON.stringify({ status: res.status, elapsedMs: elapsed, ...payload }, null, 2));
    } catch (error) {
      setRunError(errorMessage(error));
    } finally {
      setRunning(false);
    }
  }

  const selectedToken = tokens.find((row) => row.id === activeTokenId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.01em] text-[#111827]">Connect QASyn</h1>
          <p className="mt-1 max-w-3xl text-[13.5px] leading-5 text-[#6b7280]">
            Use QASyn from Claude Code, Claude Desktop, Cursor, VS Code Copilot, Windsurf, OpenAI/ChatGPT or any
            MCP-compatible client. All six QASyn tools execute against this workspace.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ecfdf3] px-3 py-1 text-[12px] font-semibold text-[#067647]">
          <span className="size-1.5 rounded-full bg-[#17b26a]" /> MCP server online
        </span>
      </div>

      <section className={cn(cqaCard, "p-4")} aria-label="MCP endpoint and token">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div>
            <p className={cqaLabel}>SSE endpoint</p>
            <div className="flex items-center gap-2">
              <code
                data-testid="mcp-endpoint"
                className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-3 py-2 font-mono text-[12px] text-[#374151]"
              >
                {MCP_SSE}
              </code>
              <CopyButton id="sse" value={MCP_SSE} />
            </div>
            <p className="mt-1.5 text-[11.5px] leading-4 text-[#9ca3af]">
              JSON-RPC fallback: <span className="font-mono text-[#6b7280]">{MCP_JSONRPC}</span>. Authenticate with an
              organisation-scoped <span className="font-mono">cqa_…</span> token.
            </p>
          </div>

          <div>
            <p className={cqaLabel}>API token</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={cn(cqaInput, "h-9 min-w-[190px] flex-1")}
                value={activeTokenId}
                onChange={(event) => setActiveTokenId(event.target.value)}
                aria-label="MCP API token"
              >
                {tokens.length === 0 && <option value="">No token yet</option>}
                {tokens.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} · {row.tokenPrefix}…
                  </option>
                ))}
              </select>
              <button
                type="button"
                data-testid="mcp-token-generate"
                className={cqaBtnPrimary}
                onClick={() => void generateToken()}
                disabled={generating || !canGenerate}
                title={canGenerate ? undefined : "Your role can use MCP but cannot create API tokens."}
              >
                <CqaIcon name="key" className="text-[16px]" />
                {generating ? "Generating…" : "Generate token"}
              </button>
            </div>
            <p className="mt-1.5 text-[11.5px] leading-4 text-[#9ca3af]">
              {!canGenerate
                ? "Your role can use the MCP tools with this dashboard session; token creation is limited to Admin, QA and Engineer roles."
                : generatedToken
                  ? "Your new token is embedded in the snippets below. It is shown only once."
                  : selectedToken
                    ? `Using ${selectedToken.tokenPrefix}… — the secret is not stored. Generate a token to embed it.`
                    : "Generate a token to embed it in the snippets below."}
            </p>
          </div>
        </div>

        {generatedToken && (
          <div className="mt-3 rounded-lg border border-[#abefc6] bg-[#ecfdf3] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11.5px] font-semibold text-[#067647]">New token — copy it now</p>
              <CopyButton id="token" value={generatedToken} label="Copy token" />
            </div>
            <code data-testid="mcp-token-value" className="mt-1.5 block break-all font-mono text-[12px] text-[#065f46]">
              {generatedToken}
            </code>
          </div>
        )}
      </section>

      <section className={cn(cqaCard, "overflow-hidden")} aria-label="MCP client setup">
        <div className="grid lg:grid-cols-[250px_minmax(0,1fr)]">
          <nav aria-label="MCP clients" className="border-b border-[#f0f1f3] bg-[#fafafa] p-2 lg:border-b-0 lg:border-r">
            <p className="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
              Clients
            </p>
            {CLIENTS.map((item) => (
              <button
                key={item.key}
                type="button"
                data-client={item.key}
                onClick={() => setActiveClient(item.key)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition",
                  activeClient === item.key
                    ? "bg-white text-[#111827] shadow-sm ring-1 ring-[#e5e7eb]"
                    : "text-[#4b5563] hover:bg-white/70",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md",
                    activeClient === item.key ? "bg-[#f5f3ff] text-[#5b4ee8]" : "bg-white text-[#6b7280]",
                  )}
                >
                  <CqaIcon name={item.icon} className="text-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-medium">{item.name}</span>
                  <span className="block truncate text-[10.5px] text-[#9ca3af]">{item.description}</span>
                </span>
              </button>
            ))}
          </nav>

          <div className="space-y-4 p-4 lg:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#f5f3ff] text-[#5b4ee8]">
                <CqaIcon name={client.icon} className="text-[21px]" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold text-[#111827]">{client.name}</h2>
                <p className="text-[11.5px] text-[#9ca3af]">
                  {client.file} · about 2 minutes to set up
                </p>
              </div>
            </div>

            <ol className="space-y-1.5">
              {client.steps.map((step, index) => (
                <li key={step} className="flex gap-2 text-[12.5px] leading-5 text-[#4b5563]">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[10.5px] font-semibold text-[#4f46e5]">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <CodePanel title={snippet.title} body={snippet.body} id={`client-${client.key}`} />

            {client.key === "openai" && (
              <p className="text-[11.5px] leading-4 text-[#6b7280]">
                The token is passed as a query parameter because ChatGPT connectors cannot set custom headers.
                Rotate the token from Settings → API Tokens if it is exposed.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className={cn(cqaCard, "p-4")} aria-label="MCP tool runner">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold text-[#111827]">Run a tool</h2>
            <p className="mt-0.5 text-[12px] text-[#6b7280]">
              Sends a real JSON-RPC <span className="font-mono">tools/call</span> request to this workspace.
            </p>
          </div>
          <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 font-mono text-[10.5px] text-[#4b5563]">
            {toolName}
          </span>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-1.5">
            {TOOLS.map((item) => (
              <button
                key={item.name}
                type="button"
                data-tool={item.name}
                onClick={() => setToolName(item.name)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition",
                  toolName === item.name
                    ? "border-[#a9a1f7] bg-[#f5f4ff]"
                    : "border-transparent hover:border-[#e5e7eb] hover:bg-[#fafafa]",
                )}
              >
                <CqaIcon
                  name={item.icon}
                  className={cn("mt-0.5 text-[17px]", toolName === item.name ? "text-[#5b4ee8]" : "text-[#9ca3af]")}
                />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium text-[#111827]">{item.label}</span>
                  <span className="block font-mono text-[10px] text-[#9ca3af]">{item.name}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <p className={cqaLabel}>
                Arguments for <span className="font-mono text-[11.5px]">{tool.name}</span>
              </p>
              <textarea
                className={cn(cqaInput, "h-28 resize-y py-2 font-mono text-[11.5px]")}
                value={argsText}
                onChange={(event) => setArgsText(event.target.value)}
                aria-label="Tool arguments"
                spellCheck={false}
              />
              <p className="mt-1 text-[11px] text-[#9ca3af]">{tool.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="mcp-tool-run"
                className={cqaBtnPrimary}
                onClick={() => void runTool()}
                disabled={running}
              >
                <CqaIcon name="play_arrow" className="text-[17px]" />
                {running ? "Running…" : "Run tool"}
              </button>
              <CopyButton
                id="rpc"
                value={JSON.stringify(
                  {
                    jsonrpc: "2.0",
                    id: 1,
                    method: "tools/call",
                    params: { name: tool.name, arguments: JSON.parse(argsText || "{}") },
                  },
                  null,
                  2,
                )}
                label="Copy request"
              />
            </div>

            {runError && (
              <div role="alert" className="rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[12px] text-[#b42318]">
                {runError}
              </div>
            )}
            {response && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">JSON-RPC response</p>
                  <span className="rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[10px] font-semibold text-[#067647]">
                    live
                  </span>
                </div>
                <pre
                  data-testid="mcp-tool-response"
                  className="max-h-[320px] overflow-auto rounded-lg bg-[#10141c] p-3 font-mono text-[11px] leading-5 text-[#e2e8f0]"
                >
                  {response}
                </pre>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={cn(cqaCard, "p-4")} aria-label="Role guides">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold text-[#111827]">Role guides</h2>
            <p className="mt-0.5 text-[12px] text-[#6b7280]">
              What each role should ask its agent to do with QASyn.
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {ROLE_GUIDES.map((item) => (
              <button
                key={item.key}
                type="button"
                data-role={item.key}
                onClick={() => setActiveRole(item.key)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11.5px] font-medium transition",
                  activeRole === item.key
                    ? "bg-[#5b4ee8] text-white"
                    : "bg-[#f3f4f6] text-[#4b5563] hover:bg-[#e9eaee]",
                )}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="rounded-lg border border-[#eef0f3] bg-[#fafafa] p-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-white text-[#5b4ee8] shadow-sm">
                <CqaIcon name={role.icon} className="text-[18px]" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-[#111827]">{role.title}</p>
                <p className="text-[11px] text-[#9ca3af]">{role.subtitle}</p>
              </div>
            </div>
            <p className="mt-3 text-[10.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">
              Recommended tools
            </p>
            <ul className="mt-1.5 space-y-1">
              {role.tools.map((name) => (
                <li key={name} className="flex items-center gap-1.5 font-mono text-[11px] text-[#4b5563]">
                  <CqaIcon name="check_circle" className="text-[14px] text-[#17b26a]" filled />
                  {name}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">Example prompts</p>
            <ul className="mt-1.5 space-y-1.5">
              {role.prompts.map((prompt) => (
                <li
                  key={prompt}
                  className="flex items-start justify-between gap-2 rounded-lg border border-[#eef0f3] px-3 py-2 text-[12px] leading-5 text-[#374151]"
                >
                  <span>{prompt}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-4 text-[#9ca3af]">
              Admin can access every tool. QA owns the test lifecycle. Engineers focus on PRs, code and tunnels. Managers,
              BAs and FAs use read-only reporting tools and never destructive billing or token actions.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
