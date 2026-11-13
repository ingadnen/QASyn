import type { Metadata } from "next";
import { CareersApplyClient } from "@/components/marketing/CareersApplyClient";

export const metadata: Metadata = { title: "Careers" };

export default function CareersPage() {
  return (
    <div>
      <section className="obsidian-spotlight relative overflow-hidden border-b border-white/5 bg-[#06080f]">
        <div className="quantum-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1440px] px-6 py-16 sm:px-8 lg:px-12">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-quantum-300">CAREERS</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Build the autonomous quality engineering platform.</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-400">
            We are a remote-first team of systems engineers, AI researchers and QA architects. Apply to any open role below and your application is sent directly to <strong className="text-slate-200">adnen.rebhi@qasyn.com</strong>.
          </p>
        </div>
      </section>

      <section className="bg-alabaster py-14 text-[#0F172A]">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">OPEN ROLES</p>
              <h2 className="mt-1 text-2xl font-semibold">Four roles. One quality mission.</h2>
            </div>
            <p className="max-w-md text-sm text-slate-600">Remote-first · equity from day one · annual offsites · learning budget.</p>
          </div>
          <CareersApplyClient />
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["Remote-first", "Work from anywhere with quarterly team offsites."],
              ["Own the stack", "Browser runtime, AI calibration, Test Studio and enterprise integrations."],
              ["Equity & learning", "Equity from day one plus an annual learning and conference budget."],
            ].map(([title, detail]) => (
              <article key={title} className="rounded-2xl border border-hairline bg-white p-4">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
