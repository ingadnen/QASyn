import type { Metadata } from "next";
import { PodcastPlayer } from "@/components/marketing/PodcastPlayer";

export const metadata: Metadata = { title: "Podcast" };
export const dynamic = "force-dynamic";

export default function PodcastPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">Resources · Podcast</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">The Agentic Quality Podcast</h1>
      <p className="mt-2 text-sm text-muted">Conversations with the engineers building autonomous quality engineering.</p>
      <div className="mt-8">
        <PodcastPlayer />
      </div>
    </div>
  );
}
