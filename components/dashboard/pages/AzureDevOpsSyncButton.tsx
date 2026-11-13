"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CqaIcon } from "@/components/dashboard/ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export interface AzureSyncSummary {
  ok: boolean;
  mode: "live" | "mirror";
  organization: string;
  project: string;
  counts: {
    pullRequests: number;
    workItems: number;
    testPlans: number;
    testSuites: number;
    testCases: number;
  };
  emptyReposWarning: string | null;
  syncedAt: string;
}

/** Compact quick-sync trigger shared by PRs, requirements, plans, suites and cases. */
export function AzureDevOpsSyncButton({
  className,
  label = "Sync Azure DevOps",
  onSynced,
}: {
  className?: string;
  label?: string;
  onSynced?: (summary: AzureSyncSummary) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function sync() {
    if (pending) return;
    setPending(true);
    try {
      const summary = await apiFetch<AzureSyncSummary>("/api/dashboard/integrations/azure-devops/sync", {
        method: "POST",
        json: {},
      });
      const counts = summary.counts;
      toast(
        `🔄 Azure DevOps synced: ${counts.pullRequests} PRs · ${counts.workItems} Work Items · ${counts.testPlans} Test Plan(s) · ${counts.testSuites} Suite(s) · ${counts.testCases} Test Cases.`,
        "success",
      );
      onSynced?.(summary);
      router.refresh();
    } catch (caught) {
      toast(errorMessage(caught), "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      data-testid="ado-quick-sync-btn"
      onClick={() => void sync()}
      disabled={pending}
      aria-label="Sync Azure DevOps"
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 text-[12.5px] font-medium text-[#374151] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <CqaIcon name={pending ? "progress_activity" : "sync"} className={cn("text-[16px] text-[#0078d4]", pending && "animate-spin")} />
      {pending ? "Syncing…" : label}
    </button>
  );
}
