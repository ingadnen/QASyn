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
    </div>
  );
}
