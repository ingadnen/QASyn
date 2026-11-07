import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Automated Root Cause Analysis" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "PLATFORM",
        title: "Automated Root Cause Analysis",
        lede: "Stack trace decompilation, network failure correlation and DOM diff visualization.",
        features: [
  F("Failure classification engine", "Available in the QASyn platform today."),
  F("Probable root cause with file", "line evidence"),
  F("Jira/Linear bug ticket auto-creation", "Available in the QASyn platform today."),
  F("Video + network + console artifacts", "Available in the QASyn platform today."),
  F("Regression vs product bug verdict", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, ContextQA scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
