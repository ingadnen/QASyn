"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CqaIcon, Modal, cqaBtnPrimary, cqaBtnSecondary, useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";
import type { LearningModule } from "@/lib/learning";
import { cn } from "@/lib/utils";

const TABS = ["1. Concept & Architecture", "2. Step-by-Step Guide", "3. Code / NLP / CLI Example", "4. Interactive Check"];

export function LearningCard({ mod, status, readOnly }: { mod: LearningModule; status?: string; readOnly: boolean }) {
  const { run, pending } = useAction();
  const router = useRouter();
  const [done, setDone] = useState(status === "completed");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const [checkAnswer, setCheckAnswer] = useState<string | null>(null);

  async function setStatus(s: "in_progress" | "completed") {
    const res = await run("l", "/api/dashboard/learning/progress", { json: { moduleId: mod.id, status: s } });
    if (res) {
      setDone(s === "completed");
      router.refresh();
      if (s === "completed") setOpen(false);
    }
  }

  return (
    <>
      <article className={cn("flex flex-col rounded-xl border bg-white p-4 shadow-sm transition", done ? "border-emerald-200" : "border-slate-200 hover:border-brand-300")}>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-700 uppercase">{mod.kind}</span>
          <span className="text-xs text-slate-400">{mod.minutes} min</span>
          {done && <span className="ml-auto text-xs font-semibold text-emerald-600">✓ Completed</span>}
        </div>
        <h3 className="mt-2 text-sm font-semibold text-slate-900">{mod.title}</h3>
        <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{mod.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" data-learning-module-id={mod.id} onClick={() => { setTab(0); setCheckAnswer(null); setOpen(true); }} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500" data-testid="learning-open-tutorial">
            {mod.cta} →
          </button>
          <Link href={mod.href} className="text-xs font-medium text-slate-500 hover:text-brand-600">Launch in Workspace →</Link>
          {!done ? (
            <Button variant="ghost" size="sm" disabled={readOnly} loading={pending === "l"} onClick={() => void setStatus("completed")}>Mark complete</Button>
          ) : (
            <Button variant="ghost" size="sm" disabled={readOnly} loading={pending === "l"} onClick={() => void setStatus("in_progress")}>Reopen</Button>
          )}
        </div>
      </article>

      <Modal open={open} onClose={() => setOpen(false)} title={mod.title} size="lg">
        <div className="space-y-4" data-testid="learning-tutorial-modal">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((label, index) => (
              <button key={label} type="button" onClick={() => setTab(index)} className={cn("rounded-full px-2.5 py-1 text-[10.5px] font-semibold", tab === index ? "bg-[#5b4ee8] text-white" : "bg-[#f3f4f6] text-[#4b5563]")}>{label}</button>
            ))}
          </div>

          {tab === 0 && (
            <div className="space-y-3 text-[12.5px] leading-5 text-[#4b5563]">
              <p><strong className="text-[#111827]">Concept.</strong> {mod.description}</p>
              <p><strong className="text-[#111827]">Architecture.</strong> QASyn connects {mod.section.toLowerCase()} capabilities to the shared quality graph: crawl evidence, generated cases, execution runs, QASyn Vision AI verification and audit records.</p>
              <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3">
                <p className="font-mono text-[11px] text-[#5b4ee8]">Crawl → Author → Execute → Heal → Gate → Report</p>
                <p className="mt-1 text-[11px] text-[#6b7280]">Every artifact is persisted in SQLite and linked to the same workspace.</p>
              </div>
            </div>
          )}

          {tab === 1 && (
            <ol className="space-y-2 text-[12.5px] text-[#4b5563]">
              <li><strong>1.</strong> Open the relevant workspace module from the Learning Hub.</li>
              <li><strong>2.</strong> Create or import the resource described in this module.</li>
              <li><strong>3.</strong> Run it once and inspect the real per-step PNG evidence.</li>
              <li><strong>4.</strong> Confirm the quality gate and audit trail before moving on.</li>
            </ol>
          )}

          {tab === 2 && (
            <pre className="overflow-x-auto rounded-lg bg-[#0f172a] p-3 text-[11px] leading-5 text-[#cbd5e1]">{`# ${mod.title}
qasyn navigate "${mod.href.replace("/dashboard/", "")}"
qasyn verify --target "primary heading" --screenshot png
qasyn run --evidence step-by-step --vision-ai
qasyn gate --report release-quality`}</pre>
          )}

          {tab === 3 && (
            <div className="space-y-3">
              <p className="text-[12.5px] text-[#4b5563]">Interactive check: which artifact proves this module ran successfully?</p>
              <div className="flex flex-wrap gap-2">
                {["A real per-step PNG + run metadata", "A manual note", "A screenshot from another workspace"].map((option) => (
                  <button key={option} type="button" onClick={() => setCheckAnswer(option)} className={cn("rounded-lg border px-3 py-2 text-[11.5px]", checkAnswer === option ? "border-[#5b4ee8] bg-[#eef2ff] text-[#4f46e5]" : "border-[#e5e7eb] bg-white text-[#4b5563]")}>{option}</button>
                ))}
              </div>
              {checkAnswer && (
                <p className={checkAnswer.startsWith("A real") ? "text-[12px] font-medium text-emerald-700" : "text-[12px] font-medium text-amber-700"}>
                  {checkAnswer.startsWith("A real") ? "Correct — QASyn persists real screenshots and run metadata for every step." : "Try again: proof must come from the actual run evidence in this workspace."}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f0f1f3] pt-3">
            <Link href={mod.href} className={cqaBtnSecondary}>Launch in Workspace →</Link>
            <div className="flex gap-2">
              <button type="button" className={cqaBtnSecondary} onClick={() => setOpen(false)}>Close</button>
              <button type="button" data-testid="learning-mark-complete" className={cqaBtnPrimary} disabled={readOnly || done || pending === "l"} onClick={() => void setStatus("completed")}>
                <CqaIcon name="check_circle" className="text-[16px]" /> ✓ Mark Module Complete
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
