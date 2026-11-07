import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Claude Code & MCP Integration" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "INTEGRATIONS",
        title: "Claude Code & MCP Integration",
        lede: "Use Claude Code with the QASyn MCP server over SSE to create tests, run plans and read evidence without leaving your IDE.",
        features: [
          F("SSE transport + JSON-RPC tools/call", "qasyn_create_web_test from natural language prompts"),
          F("qasyn_run_test_plan with Playwright evidence", "Bearer cqa_… token authentication"),
          F("Cursor & Windsurf compatible", "Organisation-scoped tool execution"),
        ],
      }}
    />
  );
}
