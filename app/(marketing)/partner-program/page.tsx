import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Partner Program" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "COMPANY",
        title: "Partner Program",
        lede: "Technology & solution partner application with tier benefits.",
        features: [
          F("Tier benefits table", "Marketplace listings"),
        ],
      }}
    />
  );
}
