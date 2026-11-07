import type { Metadata } from "next";
import { McpClient } from "@/components/dashboard/pages/Forms";
import { Card, PageHeader } from "@/components/dashboard/ui";
import { MCP_TOOLS } from "@/lib/mcp";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "MCP" };
export const dynamic = "force-dynamic";

export default async function McpPage() {
  const ctx = await requireOrgContext();
  const snippet = JSON.stringify(
    {
      mcpServers: {
        qasyn: {
          command: "npx",
          args: ["-y", "@qasyn/mcp"],
          env: { QASYN_API_TOKEN: "cqa_… (create one in Settings → API tokens)", QASYN_WORKSPACE: ctx.org.slug },
        },
      },
    },
    null,
    2,
  );
  return (
    <div className="space-y-6">
      <PageHeader kicker="WORK" title="MCP" description="Connect VS Code, Cursor or Claude Desktop to this workspace. Tools are read-only and scoped to your organisation." />
      <Card title="Available tools">
        <ul className="divide-y divide-slate-100 px-5 py-2">
          {MCP_TOOLS.map((t) => <li key={t.name} className="py-2"><code className="text-sm font-medium text-slate-800">{t.name}</code><p className="text-xs text-slate-500">{t.description}</p></li>)}
        </ul>
      </Card>
      <Card title="Client snippet & tool tester"><div className="px-5 py-4"><McpClient snippet={snippet} /></div></Card>
      <Card title="MCP SSE server (external agents)">
        <div className="space-y-2 px-5 py-4 text-sm text-slate-600">
          <p>Endpoints: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">GET /api/mcp/sse</code> (stream) and <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">POST /api/mcp/sse</code> (JSON-RPC: <code>initialize</code>, <code>tools/list</code>, <code>tools/call</code>).</p>
          <p>Authenticate with a <code>cqa_…</code> API token (create one in Settings → API tokens). 13 tools are exposed, including <code>qasyn_create_web_test</code>, <code>qasyn_run_test_plan</code>, <code>qasyn_get_execution_evidence</code>, <code>qasyn_analyze_pr_impact</code>, <code>qasyn_trigger_api_chain</code>, <code>qasyn_start_crawl</code>, <code>qasyn_run_mobile_test</code>, <code>qasyn_ship_workflow</code> and <code>qasyn_reproduce_bug</code>. Every call is scoped to the token&apos;s organisation.</p>
        </div>
      </Card>
    </div>
  );
}
