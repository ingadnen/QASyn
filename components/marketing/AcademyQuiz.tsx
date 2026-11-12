"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const QUIZ = [
  { q: "What does the self-healing score weight Text at?", options: ["0.1", "0.2", "0.3", "0.5"], answer: 2 },
  { q: "Which header authenticates MCP agents?", options: ["x-api-key", "Bearer cqa_…", "Cookie qasyn_org", "None"], answer: 1 },
  { q: "What verdict does QASyn emit from evidence?", options: ["Maybe", "Go / No-Go", "Pending forever", "Manual"], answer: 1 },
];

export function AcademyQuiz({ badgeName }: { badgeName: string }) {
  const [answers, setAnswers] = useState<number[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cert, setCert] = useState<{ code: string; score: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const score = QUIZ.filter((q, i) => answers[i] === q.answer).length;
  const passed = score === QUIZ.length;

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ certification: { certCode: string; score: number } }>("/api/marketing/certification", {
        method: "POST",
        json: { badgeName, candidateName: name, candidateEmail: email, score: Math.round((score / QUIZ.length) * 100) },
      });
      setCert({ code: res.certification.certCode, score: res.certification.score });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Certification quiz</p>
      {QUIZ.map((q, i) => (
        <div key={q.q}>
          <p className="text-xs font-medium text-slate-700">{q.q}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {q.options.map((o, j) => (
              <button key={o} type="button" onClick={() => setAnswers(QUIZ.map((_, k) => (k === i ? j : answers[k] ?? -1)))} className={cn("rounded-full border px-2.5 py-1 text-xs", answers[i] === j ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500")}>
                {o}
              </button>
            ))}
          </div>
        </div>
      ))}
      {passed ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="h-9 rounded-lg border border-slate-200 px-2 text-sm" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="h-9 rounded-lg border border-slate-200 px-2 text-sm" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {cert ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">🏅 Certified: <code>{cert.code}</code> (score {cert.score}) — verify at /academy?cert={cert.code}</p>
          ) : (
            <Button size="sm" onClick={() => void issue()} loading={busy} disabled={!name || !email.includes("@")}>Issue certificate</Button>
          )}
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <p className="text-xs text-slate-400">Answer all {QUIZ.length} questions correctly to unlock certification.</p>
      )}
    </div>
  );
}
