"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CqaIcon } from "@/components/dashboard/ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface GitHubSyncReport {
  provider: string;
  mode: "live" | "simulated";
  newNotifications: number;
}

interface GitHubSyncSummary {
  ok: boolean;
  reports: GitHubSyncReport[];
  newNotifications: number;
}

/** Quick-sync trigger for GitHub pull requests (mirrors AzureDevOpsSyncButton). */
export function GitHubSyncButton({
  className,
  label = "Sync GitHub",
  onSynced,
}: {
  className?: string;
  label?: string;
  onSynced?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function sync() {
    if (pending) return;
    setPending(true);
    try {
      const summary = await apiFetch<GitHubSyncSummary>("/api/dashboard/integrations/sync-live", {
        method: "POST",
        json: { provider: "GITHUB" },
      });
      const report = summary.reports?.[0];
      const mode = report?.mode === "live" ? "live" : "simulated";
      toast(`🐙 GitHub synced (${mode}): ${summary.newNotifications} new notification(s).`, "success");
      onSynced?.();
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
      data-testid="github-quick-sync-btn"
      onClick={() => void sync()}
      disabled={pending}
      aria-label="Sync GitHub"
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 text-[12.5px] font-medium text-[#374151] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <CqaIcon name={pending ? "progress_activity" : "sync"} className={cn("text-[16px] text-[#24292f]", pending && "animate-spin")} />
      {pending ? "Syncing…" : label}
    </button>
  );
}
