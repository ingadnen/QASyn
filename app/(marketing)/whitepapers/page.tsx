import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Whitepapers" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "RESOURCES",
        title: "Whitepapers",
        lede: "Enterprise research on AI testing, MCP architecture and test healing at scale.",
        features: [
          F("MCP architecture for QA agents", "Multi-layer fingerprinting research"),
          F("Enterprise pilot economics", "Risk-based testing ROI"),
        ],
      }}
    />
  );
}
