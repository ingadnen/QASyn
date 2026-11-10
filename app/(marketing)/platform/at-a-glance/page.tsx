import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Single Unified Platform vs Multi-Tool Stacks" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "PLATFORM",
        title: "Single Unified Platform vs Multi-Tool Stacks",
        lede: "One platform replaces recorder tools, grid providers, self-healing add-ons and four disconnected dashboards.",
        features: [
  F("Architecture & AI", "single unified platform, CodiTOS code generation, agentic AI, multi-layer fingerprinting, MCP server"),
  F("Test types", "Chrome/Firefox/Safari/Edge, cloud emulators, REST/GraphQL/SOAP/gRPC, SAP GUI/Fiori/S/4HANA, Salesforce Lightning/Classic/CPQ, native pixel detection, WCAG 2.2, OWASP Top 10"),
  F("Operations", "12-week pilot, single platform license, credits-based usage"),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, QASyn scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
