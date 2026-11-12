import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Test Infrastructure" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "PLATFORM",
        title: "Test Infrastructure",
        lede: "Parallel cloud grid: cross-browser engines and real device farm.",
        features: [
  F("Chrome, Firefox, Safari (WebKit), Edge", "Available in the QASyn platform today."),
  F("iOS 14+ and Android API 21+ devices", "Available in the QASyn platform today."),
  F("Worker pools with concurrency caps", "Available in the QASyn platform today."),
  F("Heartbeat monitoring", "Available in the QASyn platform today."),
  F("Zero-maintenance infrastructure", "Available in the QASyn platform today."),
  F("Multi-tenant grid isolation", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, QASyn scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
