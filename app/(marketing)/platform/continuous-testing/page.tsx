import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Continuous Testing" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "PLATFORM",
        title: "Continuous Testing",
        lede: "Always-on orchestration: release gates, CI/CD blocking and automated rollbacks.",
        features: [
  F("Nightly regression scheduling", "Available in the QASyn platform today."),
  F("Cron-based execution windows", "Available in the QASyn platform today."),
  F("CI quality gates", "Available in the QASyn platform today."),
  F("Canary release validation", "Available in the QASyn platform today."),
  F("Automatic rollback alerts", "Available in the QASyn platform today."),
  F("Webhooks into CI pipelines", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, QASyn scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
