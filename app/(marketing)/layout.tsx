import Link from "next/link";
import { FinQAWidget } from "@/components/sections/FinQAWidget";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/marketing/MarketingNav";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF7] text-[#1C2A33]">
      <div className="border-b border-pw-line bg-[#12242E] px-4 py-2 text-center text-xs text-white">
        <span className="mr-2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">New</span>
        Meet QASyn — your autonomous AI quality engineer.{" "}
        <Link href="/qasyn" className="font-semibold text-white underline underline-offset-4 hover:text-brand-100">
          Try it now →
        </Link>
      </div>
      <MarketingNav />
      <main className="flex-1 bg-[#FAFAF7] text-[#1C2A33]">{children}</main>
      <MarketingFooter />
      <FinQAWidget />
    </div>
  );
}
