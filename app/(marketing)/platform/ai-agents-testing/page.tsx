import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "AI Agent Testing" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "PLATFORM",
        title: "AI Agent Testing",
        lede: "Hallucination, drift, tool-calls and guardrails — LLM-as-a-judge evaluation.",
        features: [
  F("Multi-turn dialogue evaluation", "Available in the QASyn platform today."),
  F("Hallucination benchmarks vs knowledge base", "Available in the QASyn platform today."),
  F("Prompt injection defense (OWASP LLM Top 10)", "Available in the QASyn platform today."),
  F("Tool-call schema verification", "Available in the QASyn platform today."),
  F("Latency SLA tracking", "Available in the QASyn platform today."),
  F("Persona simulation", "Available in the QASyn platform today."),
        ],
        faqs: [{"q":"How does self-healing work?","a":"When a selector fails, ContextQA scores every candidate element (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 it repairs the selector in place and flags the step HEALED."},{"q":"Which browsers are supported?","a":"Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid, plus iOS 14+ and Android API 21+ devices."}],
      }}
    />
  );
}
