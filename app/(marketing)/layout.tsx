import Link from "next/link";
import { FinQAWidget } from "@/components/sections/FinQAWidget";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#06080f] text-slate-100">
      <div className="border-b border-white/5 bg-[#05070e] px-4 py-2 text-center text-xs text-slate-300">
        <span className="mr-2 rounded-full bg-gradient-to-r from-quantum-500 to-cobalt-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">New</span>
        Meet QASyn — your autonomous AI quality engineer.{" "}
        <Link href="/qasyn" className="font-semibold text-quantum-300 underline-offset-4 hover:text-white hover:underline">
          Try it now →
        </Link>
      </div>
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
      <FinQAWidget />
    </div>
  );
}
