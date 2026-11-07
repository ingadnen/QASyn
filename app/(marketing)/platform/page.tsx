import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Complete Platform Overview & Unified Architecture" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "PLATFORM",
        title: "Complete Platform Overview & Unified Architecture",
        lede: "The agentic AI testing platform. One place to write, heal, and run tests across web, mobile, API, and AI agents.",
        features: [
  F("Multi-app studios in one workspace", "Available in the QASyn platform today."),
  F("Context Graph knowledge engine", "Available in the QASyn platform today."),
  F("Autonomous Ship pipeline", "Available in the QASyn platform today."),
  F("MCP server for AI coding agents", "Available in the QASyn platform today."),
  F("Physical Playwright execution", "Available in the QASyn platform today."),
  F("Immutable evidence trail", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, ContextQA scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
