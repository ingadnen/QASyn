"use client";

import { useState } from "react";
import { LearningCard } from "@/components/dashboard/pages/LearningCard";
import { LEARNING_SECTIONS, sectionStats } from "@/lib/learning";

export function LearningBrowser({ progress, readOnly }: { progress: Record<string, { status: string }>; readOnly: boolean }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const sections = LEARNING_SECTIONS.map((section) => ({
    section,
    modules: query
      ? section.modules.filter(
          (mod) =>
            mod.title.toLowerCase().includes(query) ||
            mod.description.toLowerCase().includes(query) ||
            mod.section.toLowerCase().includes(query),
        )
      : section.modules,
  })).filter((s) => s.modules.length > 0);

  return (
    <div className="space-y-8">
      <div className="max-w-md">
        <label htmlFor="learning-search" className="text-xs font-medium text-slate-600">
          Search modules, guides and tutorials…
        </label>
        <input
          id="learning-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. self-healing, API, QASyn…"
          className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
        />
      </div>
      {sections.length === 0 && <p className="text-sm text-slate-500">No module matches “{q}”.</p>}
      {sections.map(({ section, modules }) => {
        const stats = sectionStats(progress, section);
        return (
          <section key={section.name}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">{section.name}</h2>
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${stats.pct}%` }} />
              </div>
              <span className="text-xs text-slate-500">{stats.done}/{stats.total} · {stats.pct}%</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {modules.map((mod) => (
                <LearningCard key={mod.id} mod={mod} status={progress[mod.id]?.status} readOnly={readOnly} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
