import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "AI-Based Self-Healing" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "PLATFORM",
        title: "AI-Based Self-Healing",
        lede: "4-factor multi-layer fingerprinting: 0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position (threshold 0.45).",
        features: [
  F("DOM mutation healing in live execution", "Available in the QASyn platform today."),
  F("Screenshot evidence (Base64) on failure", "Available in the QASyn platform today."),
  F("Auto-repair persisted to stepsJson", "Available in the QASyn platform today."),
  F("Console + network trace correlation", "Available in the QASyn platform today."),
  F("HEALED badge in every report", "Available in the QASyn platform today."),
  F("Full Playwright grid execution", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, ContextQA scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
