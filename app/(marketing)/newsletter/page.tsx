import type { Metadata } from "next";
import { NewsletterSubscribe } from "@/components/marketing/NewsletterSubscribe";

export const metadata: Metadata = { title: "Newsletter" };
export const dynamic = "force-dynamic";

const EDITIONS = [
  { id: "jan", title: "January: MCP everywhere", date: "Jan 2026" },
  { id: "feb", title: "February: self-healing in production", date: "Feb 2026" },
  { id: "mar", title: "March: red teaming LLM agents", date: "Mar 2026" },
  { id: "apr", title: "April: the autonomous SDLC", date: "Apr 2026" },
  { id: "may", title: "May: QASyn 2.0 release pipeline", date: "May 2026" },
  { id: "jun", title: "June: visual regression at scale", date: "Jun 2026" },
];

export default function NewsletterPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">Resources · Newsletter</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">The QA Brief</h1>
      <p className="mt-2 text-sm text-muted">Monthly agentic QA engineering digest — 1,200+ subscribers. No spam.</p>
      <div className="mt-6">
        <NewsletterSubscribe />
      </div>
      <ul className="mt-8 space-y-3">
        {EDITIONS.map((e) => (
          <li key={e.id} className="rounded-xl border border-line bg-white p-4">
            <p className="text-sm font-semibold text-ink">{e.title}</p>
            <p className="text-xs text-muted">{e.date}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
