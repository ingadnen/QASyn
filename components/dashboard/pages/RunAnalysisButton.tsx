"use client";

import { CqaIcon, cqaBtnSecondary, useAction } from "@/components/dashboard/ui";
import { useRouter } from "next/navigation";

export function RunAnalysisButton({ disabled, label = "Run analysis", compact }: { disabled?: boolean; label?: string; compact?: boolean }) {
  const router = useRouter();
  const { run, pending, error } = useAction();

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        title={disabled ? "Connect GitHub or GitLab in Integrations first" : label}
        disabled={disabled || pending === "a"}
        onClick={async () => {
          await run("a", "/api/dashboard/code-analysis");
          router.refresh();
        }}
        className={compact ? "inline-flex size-9 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#5b4ee8] hover:bg-[#f9fafb] disabled:opacity-50" : cqaBtnSecondary}
        aria-label={label}
      >
        <CqaIcon name="add" className="text-[16px]" />
        {!compact && (pending === "a" ? "Analysing…" : label)}
      </button>
      {error && <span role="alert" className="text-[11.5px] text-red-600">{error}</span>}
    </span>
  );
}
