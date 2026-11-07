import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Performance & Accessibility" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "SOLUTIONS",
        title: "Performance & Accessibility",
        lede: "Core Web Vitals, Lighthouse and WCAG 2.2 AA/AAA compliance.",
        features: [
  F("LCP/FCP/CLS/TTFB/TTI budgets", "Available in the QASyn platform today."),
  F("WCAG 2.1 AA audit engine", "Available in the QASyn platform today."),
  F("Contrast & label checks", "Available in the QASyn platform today."),
  F("Trend tracking", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, ContextQA scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
