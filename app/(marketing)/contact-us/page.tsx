import type { Metadata } from "next";
import { ContactSalesForm } from "@/components/marketing/ContactSalesForm";

export const metadata: Metadata = { title: "Contact Us" };

const CONTACTS = [
  { label: "Sales & Demos", email: "adnen.rebhi@qasyn.com", detail: "Book a personalized walkthrough of crawl, AI authoring, Vision AI and PR gates." },
  { label: "General Inquiries", email: "adnen.rebhi@qasyn.com", detail: "Partnerships, press, security reviews and procurement questions." },
  { label: "Enterprise Support", email: "adnen.rebhi@qasyn.com", detail: "Existing customers can reach the on-call quality engineering team." },
];

export default function ContactPage() {
  return (
    <div>
      <section className="obsidian-spotlight relative overflow-hidden border-b border-white/5 bg-[#06080f]">
        <div className="quantum-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1440px] px-6 py-16 sm:px-8 lg:px-12">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-quantum-300">CONTACT QASYN</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Book a demo or talk to our quality engineering team.</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-400">
            Tell us about your stack, release process and coverage goals. A solutions architect will reply from <strong className="text-slate-200">adnen.rebhi@qasyn.com</strong> within one business day.
          </p>
        </div>
      </section>

      <section className="bg-alabaster py-14 text-[#0F172A]">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-6 sm:px-8 lg:grid-cols-[1fr_1.15fr] lg:px-12">
          <div className="space-y-3">
            {CONTACTS.map((contact) => (
              <article key={contact.label} className="rounded-2xl border border-hairline bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-[#0F172A]">{contact.label}</h2>
                <a href={`mailto:${contact.email}`} className="mt-1 inline-block text-sm font-semibold text-quantum-600 hover:underline">{contact.email}</a>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{contact.detail}</p>
              </article>
            ))}
            <div className="rounded-2xl border border-hairline bg-[#0b1120] p-5 text-slate-300">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-quantum-300">ENTERPRISE</p>
              <p className="mt-2 text-sm leading-relaxed">SSO/SAML, private execution, custom SLAs and invoice/PO procurement are available on the Enterprise plan.</p>
            </div>
          </div>
          <ContactSalesForm />
        </div>
      </section>
    </div>
  );
}
