"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function WebinarsClient() {
  const [email, setEmail] = useState("");
  const [registered, setRegistered] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const webinars = [
    { id: "w1", title: "Self-healing in production: live demo", date: "Nov 20, 2026 · 10:00 UTC", live: true },
    { id: "w2", title: "MCP for QA agents (Cursor + Claude Code)", date: "Nov 27, 2026 · 15:00 UTC", live: true },
    { id: "w3", title: "Red teaming LLM agents (on demand)", date: "On demand", live: false },
  ];
  async function register(id: string) {
    setBusy(true);
    try {
      await apiFetch("/api/marketing/lead", { method: "POST", json: { email, source: "webinar", metadata: { webinar: id } } });
      setRegistered(id);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <label className="block max-w-md">
        <span className="text-xs font-medium text-slate-600">Email for registration</span>
        <input className={cn("mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      </label>
      <ul className="space-y-3">
        {webinars.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{w.title}</p>
              <p className="text-xs text-muted">{w.date} {w.live && <span className="font-semibold text-red-600">· LIVE</span>}</p>
            </div>
            {registered === w.id ? (
              <span className="text-sm font-semibold text-emerald-600">✓ Registered — video player unlocked</span>
            ) : (
              <Button size="sm" onClick={() => void register(w.id)} loading={busy} disabled={!email.includes("@")}>{w.live ? "Register" : "Watch on demand"}</Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
