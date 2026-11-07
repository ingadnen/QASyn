import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Media Coverage" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "COMPANY",
        title: "Media Coverage",
        lede: "Press releases, news features and brand media kit.",
        features: [
          F("2026 launch announcement", "Agentic QA funding round"),
          F("Press kit download", "Brand assets"),
        ],
      }}
    />
  );
}
