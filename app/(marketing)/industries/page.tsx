import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Vertical Solutions" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "INDUSTRIES",
        title: "Vertical Solutions",
        lede: "Industry-specific compliance and workflows.",
        features: [
  F("FinTech (PCI-DSS)", "Available in the QASyn platform today."),
  F("Healthcare (HIPAA)", "Available in the QASyn platform today."),
  F("E-Commerce & Retail", "Available in the QASyn platform today."),
  F("Telecommunications", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, QASyn scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
