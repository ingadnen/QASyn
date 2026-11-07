import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Mobile Testing" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "SOLUTIONS",
        title: "Mobile Testing",
        lede: "Native iOS & Android testing with cloud emulators and real devices.",
        features: [
  F("APK/IPA build upload", "Available in the QASyn platform today."),
  F("Tap/Swipe/Scroll gestures", "Available in the QASyn platform today."),
  F("iOS 14+ / Android API 21+ devices", "Available in the QASyn platform today."),
  F("Device farm logs", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, ContextQA scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
