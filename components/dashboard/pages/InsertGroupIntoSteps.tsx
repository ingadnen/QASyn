"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

interface GroupStep {
  id: string;
  action: string;
  target: string;
  value: string;
  selector: string;
}

/** Inserts a reusable Step Group (TestComponent) into the current Studio steps. */
export function InsertGroupIntoSteps({ steps, onInsert, readOnly }: { steps: GroupStep[]; onInsert: (steps: GroupStep[]) => void; readOnly: boolean }) {  const [groups, setGroups] = useState<Array<{ id: string; name: string; stepsJson: string }>>([]);
  useEffect(() => {
    fetch("/api/dashboard/test-components")
      .then((r) => r.json())
      .then((d) => setGroups((d as { components?: Array<{ id: string; name: string; stepsJson: string }> }).components ?? []))
      .catch(() => undefined);
  }, []);
  return (
    <span className="inline-flex items-center gap-2">
      <select
        aria-label="Insert Step Group"
        disabled={readOnly}
        onChange={(e) => {
          const group = groups.find((g) => g.id === e.target.value);
          if (!group) return;
          let parsed: GroupStep[] = [];
          try {
            parsed = JSON.parse(group.stepsJson || "[]");
          } catch {
            parsed = [];
          }
          onInsert(parsed.map((s, i) => ({ ...s, id: `grp-${Date.now()}-${i}` })));
        }}
        className="h-9 max-w-56 rounded-lg border border-slate-200 px-2 text-sm"
      >
        <option value="">Insert Step Group…</option>
        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <Button size="sm" variant="ghost" disabled={readOnly || steps.length === 0} onClick={() => undefined}>↗</Button>
    </span>
  );
}
