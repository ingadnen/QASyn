import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "12-Week Enterprise Pilot" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "COMPANY",
        title: "12-Week Enterprise Pilot",
        lede: "A scoped pilot on your real codebase with SLA, security review and Go/No-Go exit criteria.",
        features: [
          F("Weeks 1–2: workspace & crawl", "Weeks 3–8: suites + healing"),
          F("Weeks 9–12: CI gates & Ship", "SLA: 99.5% runner availability"),
          F("Security review included", "Exit criteria documented"),
        ],
      }}
    />
  );
}
