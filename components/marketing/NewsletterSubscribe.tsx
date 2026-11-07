"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function NewsletterSubscribe() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await apiFetch("/api/marketing/lead", { method: "POST", json: { email, source: "newsletter" } });
      setDone(true);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }
  if (done) return <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">✓ Subscribed — welcome to The QA Brief.</p>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); void go(); }} className="flex gap-2">
      <input className={cn("h-11 min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 text-sm")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      <Button type="submit" loading={busy} disabled={!email.includes("@")}>Subscribe</Button>
    </form>
  );
}
