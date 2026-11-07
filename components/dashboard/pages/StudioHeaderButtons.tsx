"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";

export function StudioHeaderButtons({ tc, readOnly }: { tc: { id: string; title: string; criticality: string }; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [criticality, setCriticality] = useState(tc.criticality);
  const [prereq, setPrereq] = useState("");

  async function runTest() {
    const res = await run("run", `/api/dashboard/test-cases/${tc.id}`, { method: "PATCH", json: { action: "run" } });
    if (res) router.refresh();
  }
  async function autofix() {
    const res = await run("fix", `/api/dashboard/test-cases/${tc.id}`, { method: "PATCH", json: { action: "run_steps" } });
    if (res) router.refresh();
  }
  async function addPrereq() {
    if (!prereq) return;
    const res = await run("pre", `/api/dashboard/test-cases/${prereq}`, { method: "PATCH", json: { action: "edit", title: tc.title } });
    if (res) router.refresh();
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
      <input aria-label="Prerequisite TC id" className="h-9 w-36 rounded-lg border border-slate-200 px-2 text-sm" placeholder="Prerequisite TC-…" value={prereq} disabled={readOnly} onChange={(e) => setPrereq(e.target.value)} />
      <Button size="sm" variant="secondary" onClick={() => void addPrereq()} disabled={readOnly || !prereq}>+ Add Prerequisite</Button>
      <Button size="sm" variant="secondary" onClick={() => void autofix()} loading={pending === "fix"} disabled={readOnly}>Auto-fix rerun</Button>
      <Button size="sm" onClick={() => void runTest()} loading={pending === "run"} loadingText="Running…" disabled={readOnly}>▶ Run</Button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
