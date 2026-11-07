import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "eBooks" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "RESOURCES",
        title: "eBooks",
        lede: "In-depth PDF testing guides, gated by email lead capture.",
        features: [
          F("Autonomous SDLC playbook", "AI testing architecture"),
          F("MCP integration guide", "Self-healing engineering"),
        ],
      }}
    />
  );
}
