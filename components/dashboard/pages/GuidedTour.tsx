"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Test Suites, new and improved", body: "Suites group your test cases by journey. Create one per module, run it on every change." },
  { title: "Create a suite", body: "Click Create Test Suite and pick cases by tag or module — parallel or sequential." },
  { title: "Latest result", body: "Every suite shows its last verdict (Not Executed, Passed, Failed) — no more guessing." },
  { title: "Folders", body: "Organize suites into folders: Unorganised, or by module like Account Recovery." },
  { title: "Run on demand", body: "Hit Run Suite to execute physically in Playwright — healing included." },
  { title: "Automate", body: "Schedule the suite nightly or wire it into CI as a quality gate." },
];

export function GuidedTour() {
  const [step, setStep] = useState<number | null>(null);
  if (step === null) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
        <p className="text-sm text-slate-700"><strong>Test Suites, new and improved</strong> — take the 6-step tour.</p>
        <Button size="sm" className="ml-auto" onClick={() => setStep(0)}>Explore!</Button>
      </div>
    );
  }
  const current = STEPS[step];
  return (
    <div className="rounded-xl border-2 border-brand-500 bg-white p-4 shadow-xl">
      <p className="text-xs font-semibold tracking-widest text-brand-600 uppercase">Step {step + 1} of {STEPS.length}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{current.title}</p>
      <p className="mt-1 text-sm text-slate-600">{current.body}</p>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex gap-1">{STEPS.map((_, i) => <span key={i} className={cn("size-1.5 rounded-full", i === step ? "bg-brand-600" : "bg-slate-200")} />)}</div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setStep(null)}>Skip</Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(step + 1)}>Next</Button>
          ) : (
            <Button size="sm" onClick={() => setStep(null)}>Done</Button>
          )}
        </div>
      </div>
    </div>
  );
}
