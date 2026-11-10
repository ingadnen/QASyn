import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Model Context Protocol Server" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "PLATFORM",
        title: "Model Context Protocol Server",
        lede: "Connect Cursor, Claude Code and Windsurf via SSE with 13 production tools.",
        features: [
  F("JSON-RPC tools/list + tools/call", "Available in the QASyn platform today."),
  F("qasyn_create_web_test, qasyn_run_test_plan…", "Available in the QASyn platform today."),
  F("Bearer cqa_… token authentication", "Available in the QASyn platform today."),
  F("Organisation-scoped tool execution", "Available in the QASyn platform today."),
  F("SSE heartbeat streaming", "Available in the QASyn platform today."),
  F("External agent support", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, QASyn scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
