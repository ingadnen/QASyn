import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "CodiTOS Code Export" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "PLATFORM",
        title: "CodiTOS Code Export",
        lede: "Zero vendor lock-in: export natural language tests to Playwright, Cypress, Selenium, WebdriverIO.",
        features: [
  F("Playwright TypeScript/JavaScript/Python", "Available in the QASyn platform today."),
  F("Cypress JavaScript/TypeScript", "Available in the QASyn platform today."),
  F("Selenium Java/Python", "Available in the QASyn platform today."),
  F("WebdriverIO JavaScript", "Available in the QASyn platform today."),
  F("Page Object Model generation", "Available in the QASyn platform today."),
  F("GitHub Actions / GitLab CI workflows", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, QASyn scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
