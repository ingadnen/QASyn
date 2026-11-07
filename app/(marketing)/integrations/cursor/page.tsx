import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Cursor IDE Rules & MCP" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "INTEGRATIONS",
        title: "Cursor IDE Rules & MCP",
        lede: "Cursor IDE rules, mcp.json configuration and background test runner.",
        features: [
          F(".", "c"),
          F("m", "c"),
          F("B", "a"),
          F("C", "o"),
        ],
      }}
    />
  );
}
