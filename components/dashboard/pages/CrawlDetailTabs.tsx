"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { useAction } from "@/components/dashboard/ui";
import Link from "next/link";

export interface CrawlCase {
  id: string;
  title: string;
  module: string;
  status: string;
}

const QUESTIONNAIRE = [
  "Which credentials should the crawl use for login?",
  "Should checkout be covered end-to-end or only up to payment?",
  "Are there feature-flagged areas to skip?",
];

export function CrawlDetailTabs({ cases, logs, running, crawlId, readOnly }: { cases: CrawlCase[]; logs: string; running: boolean; crawlId: string; readOnly: boolean }) {
  const [tab, setTab] = useState<"cases" | "questionnaire" | "reqdata" | "history" | "metadata" | "gaps">("cases");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const { run, pending, error } = useAction();

  return (
    <div className="space-y-4">
      <Tabs
        label="Crawl sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: "cases", label: "Test Cases" },
          { value: "questionnaire", label: "Questionnaire" },
          { value: "reqdata", label: "Requirement Data" },
          { value: "history", label: "History" },
          { value: "metadata", label: "Metadata" },
          { value: "gaps", label: "Gaps" },
        ]}
      />

      {tab === "cases" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {cases.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No test cases generated yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {cases.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                  <Link href={`/dashboard/test-studio/${c.id}`} className="flex-1 font-medium text-brand-700 hover:underline">{c.title}</Link>
                  <span className="text-xs text-slate-500">{c.module} · {c.status}</span>
                  {c.status === "draft" && (
                    <Button size="sm" variant="secondary" disabled={readOnly} loading={pending === `ap-${c.id}`} onClick={() => void run(`ap-${c.id}`, `/api/dashboard/test-cases/${c.id}`, { method: "PATCH", json: { action: "set", status: "passing" } })}>
                      Approve Draft → Ready
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {error && <p role="alert" className="px-5 py-2 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {tab === "questionnaire" && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {QUESTIONNAIRE.map((q, i) => (
            <label key={q} className="block">
              <span className="text-sm font-medium text-slate-700">{q}</span>
              <textarea
                className="mt-1 h-auto w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={2}
                value={answers[i] ?? ""}
                disabled={readOnly}
                onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                placeholder="Answer the agent…"
              />
            </label>
          ))}
        </div>
      )}

      {tab === "reqdata" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          <p>REQ-00X details: acceptance criteria extracted from the crawl target. Test cases landing below trace back to this requirement.</p>
          <p className="mt-2 text-xs text-slate-500">See Requirements for the full traceability matrix.</p>
        </div>
      )}

      {tab === "history" && (
        <pre className="max-h-64 overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-200">{logs || "No events yet."}</pre>
      )}

      {tab === "metadata" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          <p>Platform: Web Application · Publish: auto-generated · Types: <code>raw JSON log stream</code></p>
          <p className="mt-1 text-xs text-slate-500">Crawl {crawlId}</p>
        </div>
      )}

      {tab === "gaps" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">Forms and routes discovered but not yet covered by a test case (provisional).</p>
          <Button size="sm" className="mt-3" disabled={readOnly} variant="secondary" onClick={() => void run("gap", "/api/dashboard/test-cases", { json: { mode: "ai", module: "Core", criticality: "medium", prompt: "Cover the discovered gaps from the crawl", count: 1 } })}>
            Generate Test Case for Gap
          </Button>
          {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
