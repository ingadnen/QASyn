import Link from "next/link";
import { FinQAWidget } from "@/components/sections/FinQAWidget";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="bg-navy-900 px-4 py-2 text-center text-xs text-slate-300">
        <span className="mr-2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">New</span>
        Meet Ship — your autonomous AI quality engineer.{" "}
        <Link href="/ship" className="font-semibold text-white underline-offset-4 hover:underline">
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
