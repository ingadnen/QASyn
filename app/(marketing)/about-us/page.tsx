import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "About Us" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "COMPANY",
        title: "About Us",
        lede: "Our mission: make quality engineering autonomous. One agentic platform from requirement to release.",
        features: [
          F("Born from failing CI pipelines", "Agentic AI since day one"),
        ],
      }}
    />
  );
}
