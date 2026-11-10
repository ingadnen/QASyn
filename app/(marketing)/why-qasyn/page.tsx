import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Why QASyn" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "COMPANY",
        title: "Why QASyn",
        lede: "Autonomous SDLC vs legacy automation: agents that crawl, generate, heal and ship â€” not scripts that rot.",
        features: [
          F("Agents vs recorders", "Healing vs maintenance toil"),
        ],
      }}
    />
  );
}
