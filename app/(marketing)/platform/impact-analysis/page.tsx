import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "PR Impact Analysis" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "PLATFORM",
        title: "PR Impact Analysis",
        lede: "Change-to-test impact graphs: see exactly which tests to run on every git commit.",
        features: [
  F("File â†’ module semantic mapping", "Available in the QASyn platform today."),
  F("Minimal regression scope selection", "Available in the QASyn platform today."),
  F("Risk level (low/medium/high)", "Available in the QASyn platform today."),
  F("Go / No-Go merge verdict", "Available in the QASyn platform today."),
  F("Baseline comparison", "Available in the QASyn platform today."),
  F("PR comment evidence", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, QASyn scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
