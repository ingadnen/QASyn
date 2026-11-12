import type { Metadata } from "next";
import { FreeTools } from "@/components/marketing/FreeTools";

export const metadata: Metadata = { title: "Free tools" };
export const dynamic = "force-dynamic";

export default function FreeToolsPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">Resources · Free tools</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Free browser utilities</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Four live tools: NLP step builder, selector healer, payload assertions and regex tester.</p>
      <div className="mt-8">
        <FreeTools />
      </div>
    </div>
  );
}
