import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Risk-Based Testing" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "SOLUTIONS",
        title: "Risk-Based Testing",
        lede: "Risk score engine & test case prioritization by failure probability.",
        features: [
  F("Commit churn analysis", "Available in the QASyn platform today."),
  F("Risk score 0–100", "Available in the QASyn platform today."),
  F("Prioritized run triggers", "Available in the QASyn platform today."),
  F("Flakiness-weighted ordering", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, QASyn scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
