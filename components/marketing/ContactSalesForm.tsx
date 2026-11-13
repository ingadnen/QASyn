"use client";

import { useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api";

type LeadKind = "demo" | "contact";

export function ContactSalesForm() {
  const [kind, setKind] = useState<LeadKind>("demo");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reset = params.get("subject") === "password-reset";
    if (reset || params.get("kind") === "contact") setKind("contact");
    if (reset) {
      setMessage((current) => current || "Password reset request for my QASyn workspace account.");
    }
    const emailParam = params.get("email");
    if (emailParam) setEmail(emailParam);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Full name and work email are required.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiFetch("/api/marketing/lead", {
        method: "POST",
        json: {
          kind,
          name,
          email,
          company,
          role,
          message,
          source: `contact-us-${kind}`,
        },
      });
      setSentEmail(email.trim());
      setSent(true);
      setName("");
      setEmail("");
      setCompany("");
      setRole("");
      setMessage("");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-hairline bg-white p-5 shadow-sm sm:p-6" data-testid="contact-lead-form">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          data-testid="contact-kind-demo"
          aria-pressed={kind === "demo"}
          onClick={() => { setKind("demo"); setSent(false); }}
          className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${kind === "demo" ? "border-quantum-500 bg-[#f5f3ff] text-[#4f46e5]" : "border-slate-200 bg-white text-slate-600 hover:border-quantum-300"}`}
        >
          Book a personalized demo
          <span className="mt-1 block text-[11px] font-normal text-slate-500">30 minutes with a solutions architect.</span>
        </button>
        <button
          type="button"
          data-testid="contact-kind-contact"
          aria-pressed={kind === "contact"}
          onClick={() => { setKind("contact"); setSent(false); }}
          className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${kind === "contact" ? "border-quantum-500 bg-[#f5f3ff] text-[#4f46e5]" : "border-slate-200 bg-white text-slate-600 hover:border-quantum-300"}`}
        >
          Contact sales / support
          <span className="mt-1 block text-[11px] font-normal text-slate-500">Pricing, security review or technical help.</span>
        </button>
      </div>

      {sent ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900" data-testid="contact-lead-success">
          <p className="font-semibold">Request received.</p>
          <p className="mt-1">
            Sent to the QASyn team. Our team will reply to <strong>{sentEmail}</strong> within one business day.
          </p>
          <button type="button" onClick={() => setSent(false)} className="mt-3 text-xs font-semibold text-emerald-700 hover:underline">
            Send another request
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Full name *</span>
              <input className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-quantum-400 focus:ring-2 focus:ring-quantum-100" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Cooper" required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Work email *</span>
              <input type="email" data-testid="contact-email" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-quantum-400 focus:ring-2 focus:ring-quantum-100" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Company</span>
              <input className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-quantum-400 focus:ring-2 focus:ring-quantum-100" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc." />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Team size / role</span>
              <input className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-quantum-400 focus:ring-2 focus:ring-quantum-100" value={role} onChange={(e) => setRole(e.target.value)} placeholder="VP Engineering · 40 QA engineers" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Message / goals</span>
            <textarea className="min-h-[110px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-quantum-400 focus:ring-2 focus:ring-quantum-100" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What would you like QASyn to cover first?" />
          </label>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center rounded-lg bg-quantum-600 px-5 text-sm font-semibold text-white hover:bg-quantum-500 disabled:opacity-50">
            {pending ? "Sending…" : kind === "demo" ? "Book my demo" : "Send message"}
          </button>
        </form>
      )}
    </div>
  );
}
