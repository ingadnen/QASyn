import type { Metadata } from "next";
import { WebinarsClient } from "@/components/marketing/WebinarsClient";

export const metadata: Metadata = { title: "Webinars" };
export const dynamic = "force-dynamic";

export default function WebinarsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">Resources · Webinars</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Webinars & events</h1>
      <p className="mt-2 text-sm text-muted">Live and on-demand sessions with the ContextQA engineering team.</p>
      <div className="mt-8">
        <WebinarsClient />
      </div>
    </div>
  );
}
