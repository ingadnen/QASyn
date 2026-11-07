import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Contact Us" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "COMPANY",
        title: "Contact Us",
        lede: "Book an enterprise demo, talk to sales, or reach support.",
        features: [
          F("Sales booking calendar", "Enterprise contact form"),
        ],
      }}
    />
  );
}
