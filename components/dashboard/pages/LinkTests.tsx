"use client";
import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";

export function LinkTests({ itemId, testCases, linkedIds, readOnly }: { itemId: string; testCases: Array<{ id: string; title: string }>; linkedIds: string[]; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [selected, setSelected] = useState<Set<string>>(new Set(linkedIds));
  return (
    <div className="mt-2">
      <div className="grid gap-1 sm:grid-cols-2">
        {testCases.slice(0, 30).map((t) => (
          <label key={t.id} className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={selected.has(t.id)}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(t.id); else next.delete(t.id);
                setSelected(next);
              }}
            />
            {t.title}
          </label>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <Button size="sm" loading={pending === "l"} disabled={readOnly} onClick={() => void run("l", `/api/dashboard/requirements/${itemId}`, { method: "PATCH", json: { testCaseIds: [...selected] } })}>
          Save links
        </Button>
        {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
