import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Careers" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "COMPANY",
        title: "Careers",
        lede: "Culture, perks and open roles in engineering and QA.",
        features: [
          F("Senior AI Test Architect", "Staff Systems Engineer"),
          F("Remote-first culture", "Annual offsites"),
          F("Equity from day one", "Learning budget"),
        ],
      }}
    />
  );
}
