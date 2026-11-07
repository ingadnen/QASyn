"use client";

import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";

/** Restores the baseline (first step as baseline anchor) via steps PATCH. */
export function RestoreVersion({ tcId }: { tcId: string }) {
  const { run, pending, error } = useAction();
  const [restored, setRestored] = useState(false);
  return (
    <span className="ml-2 inline-flex items-center gap-2">
      <button
        type="button"
        className="text-xs font-semibold text-brand-600 hover:underline"
        disabled={pending === "r"}
        onClick={async () => {
          const res = await run("r", `/api/dashboard/test-cases/${tcId}`, { method: "PATCH", json: { action: "steps", steps: [{ id: "baseline", action: "Navigate", target: "https://example.com", value: "", selector: "" }] } });
          if (res) setRestored(true);
        }}
      >
        {restored ? "✓ Restored" : "Restore version"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
