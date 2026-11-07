import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Community" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "COMPANY",
        title: "Community",
        lede: "Ambassador Program, QA Discord/Slack hub and local meetups.",
        features: [
          F("Ambassador perks", "Discord & Slack hub"),
          F("Local meetups", "Open-source contributions"),
        ],
      }}
    />
  );
}
