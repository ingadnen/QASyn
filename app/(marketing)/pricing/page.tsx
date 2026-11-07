import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Pricing" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "COMPANY",
        title: "Pricing",
        lede: "Transparent tiers: Free Pilot (12 weeks), Team and Enterprise custom.",
        features: [
          F("Free pilot: 3,000 credits", "Team: $49/mo per project"),
          F("Enterprise: custom + SLA", "Credits: $0.025 per credit"),
        ],
      }}
    />
  );
}
