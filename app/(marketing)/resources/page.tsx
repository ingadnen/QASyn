import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = { title: "Learning & Content Library" };

const F = (title: string, body: string) => ({ title, body });

export default function Page() {
  return (
    <MarketingPage
      data={{
        kicker: "RESOURCES",
        title: "Learning & Content Library",
        lede: "The complete QA engineering library: blog, eBooks, whitepapers, case studies, podcast, webinars, tutorials and free tools.",
        features: [
          F("Learning Hub & Academy", "Blog & case studies"),
          F("eBooks & whitepapers", "Podcast & webinars"),
          F("Tutorials & free tools", "Glossary A–Z"),
        ],
      }}
    />
  );
}
