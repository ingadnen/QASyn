import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Enterprise Applications Testing" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "PLATFORM",
        title: "Enterprise Applications Testing",
        lede: "SAP, Oracle, Workday & custom ERP automation with pre-built object models.",
        features: [
  F("SAP GUI/Fiori transactions", "Available in the QASyn platform today."),
  F("Oracle Cloud workflows", "Available in the QASyn platform today."),
  F("Workday HR processes", "Available in the QASyn platform today."),
  F("ServiceNow incident flows", "Available in the QASyn platform today."),
  F("Custom ERP object models", "Available in the QASyn platform today."),
  F("BAPI/RFC validation", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, QASyn scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
