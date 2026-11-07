import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Visual Regression" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "SOLUTIONS",
        title: "Visual Regression",
        lede: "Pixel-level visual regression with smart diffing and approval workflows.",
        features: [
  F("Baseline capture & hash", "Available in the QASyn platform today."),
  F("Mismatch percentage", "Available in the QASyn platform today."),
  F("Approve/reject review", "Available in the QASyn platform today."),
  F("Side-by-side diff overlay", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, ContextQA scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
