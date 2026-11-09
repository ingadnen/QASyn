"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";

export function StudioHeaderButtons({ tc, cases, readOnly }: { tc: { id: string; title: string; criticality: string }; cases: Array<{ id: string; title: string }>; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [criticality, setCriticality] = useState(tc.criticality);

  async function addPrereq(id: string) {
    if (!id) return;
    const res = await run("pre", `/api/dashboard/test-cases/${tc.id}`, { method: "PATCH", json: { action: "prerequisites", testCaseIds: [id] } });
    if (res) router.refresh();
  }

  /** Single run entry point: the visible steps list executes and shows per-step results. */
  function launchRun(autoFix = false) {
    window.dispatchEvent(new CustomEvent("qasyn:studio-run", { detail: { autoFix } }));
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Priority"
        value={criticality}
        disabled={readOnly}
        onChange={(e) => {
          setCriticality(e.target.value);
          void run("crit", `/api/dashboard/test-cases/${tc.id}`, { method: "PATCH", json: { action: "edit", criticality: e.target.value } });
        }}
        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="critical">Critical</option>
      </select>
      <select
        aria-label="Add prerequisite"
        className="h-9 w-48 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
        value=""
        disabled={readOnly}
        onChange={(e) => void addPrereq(e.target.value)}
      >
        <option value="">+ Add Prerequisite</option>
        {cases.filter((c) => c.id !== tc.id).map((c) => (
          <option key={c.id} value={c.id}>{c.title}</option>
        ))}
      </select>
      <Button size="sm" variant="secondary" onClick={() => launchRun(true)} disabled={readOnly || pending === "pre"}>Auto-fix rerun</Button>
      <Button size="sm" onClick={() => launchRun(false)} disabled={readOnly}>▶ Run</Button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
