import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Web Automation" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "SOLUTIONS",
        title: "Web Automation",
        lede: "Cross-browser testing across Chrome, Firefox, Safari and Edge with self-healing.",
        features: [
  F("NLP step authoring", "Available in the QASyn platform today."),
  F("Playwright browser grid", "Available in the QASyn platform today."),
  F("Auto-healing selectors", "Available in the QASyn platform today."),
  F("Video & trace evidence", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, QASyn scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
