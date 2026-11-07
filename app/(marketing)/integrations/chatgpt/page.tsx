import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "ChatGPT Custom Actions" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "INTEGRATIONS",
        title: "ChatGPT Custom Actions",
        lede: "Connect ChatGPT Custom Actions to QASyn endpoints for autonomous test triggers.",
        features: [
          F("OpenAPI spec import for Actions", "Autonomous test triggers"),
        ],
      }}
    />
  );
}
