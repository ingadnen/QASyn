import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "AI Insights & Analytics" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "PLATFORM",
        title: "AI Insights & Analytics",
        lede: "Predictive failure intelligence, flaky test detection and execution velocity.",
        features: [
  F("Pass-rate trend intelligence", "Available in the QASyn platform today."),
  F("Flakiness index per test case", "Available in the QASyn platform today."),
  F("Module coverage radar", "Available in the QASyn platform today."),
  F("Release quality trends", "Available in the QASyn platform today."),
  F("CSV/PDF export", "Available in the QASyn platform today."),
  F("Scheduled report delivery", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, ContextQA scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
