"use client";

import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";

export function RcaExport({ runId, title }: { runId: string; title: string }) {
  const { run, pending, error } = useAction();
  const [done, setDone] = useState<string | null>(null);
  async function exportBug(tracker: "jira" | "linear") {
    const res = await run<{ bug: { id: string } }>("bug", "/api/dashboard/ship/bug-repro", {
      json: { title: `RCA: ${title} (${tracker.toUpperCase()})`, description: `Execution run ${runId}\nSee /dashboard/runs/${runId} for full evidence.` },
    });
    if (res?.bug) setDone(tracker);
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => void exportBug("jira")} loading={pending === "bug"}>Export to Jira</Button>
      <Button size="sm" variant="secondary" onClick={() => void exportBug("linear")} loading={pending === "bug"}>Export to Linear</Button>
      {done && <span className="text-sm text-emerald-600">✓ Bug exported to {done === "jira" ? "Jira" : "Linear"}</span>}
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
