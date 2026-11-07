import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Channel Partners" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "COMPANY",
        title: "Channel Partners",
        lede: "System Integrator partners: IBM, Coforge, Red Hat, Wipro and regional leaders.",
        features: [
          F("Tier-1 SI programs", "Joint delivery playbooks"),
        ],
      }}
    />
  );
}
