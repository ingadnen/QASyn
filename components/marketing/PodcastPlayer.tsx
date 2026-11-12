"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

const EPISODES = [
  { id: "ep1", title: "From recorders to agents: the autonomous SDLC", guest: "QASyn chief architect", minutes: 42 },
  { id: "ep2", title: "Self-healing at scale: fingerprinting explained", guest: "Head of browser infrastructure", minutes: 35 },
  { id: "ep3", title: "Red teaming LLM agents (OWASP Top 10)", guest: "AI safety researcher", minutes: 38 },
  { id: "ep4", title: "MCP for QA: agents that write, run and heal tests", guest: "MCP ecosystem maintainer", minutes: 31 },
];

export function PodcastPlayer() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  function toggle(ep: string, minutes: number) {
    if (playing === ep) {
      setPlaying(null);
      return;
    }
    setPlaying(ep);
    setProgress((p) => ({ ...p, [ep]: Math.min(minutes, (p[ep] ?? 0) + 2) }));
  }
  return (
    <ul className="space-y-3">
      {EPISODES.map((ep) => {
        const done = progress[ep.id] ?? 0;
        return (
          <li key={ep.id} className="rounded-xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" aria-label={playing === ep.id ? "Pause" : "Play"} onClick={() => toggle(ep.id, ep.minutes)} className="flex size-10 items-center justify-center rounded-full bg-brand-600 text-white">
                {playing === ep.id ? "❚❚" : "▶"}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{ep.title}</p>
                <p className="text-xs text-muted">{ep.guest} · {ep.minutes} min</p>
              </div>
              <span className="text-xs text-slate-400">{done}/{ep.minutes} min</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round((done / ep.minutes) * 100)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
