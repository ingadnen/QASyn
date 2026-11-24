"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface SyncReport {
  provider: string;
  name: string;
  mode: "live" | "simulated";
  note: string;
  newEvents: number;
}

interface SyncStatus {
  intervalSeconds: number;
  realtimeSync: boolean;
  connectedCount: number;
  lastSyncAt: string | null;
}

export function LiveSyncBadge({ readOnly }: { readOnly: boolean }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [reports, setReports] = useState<SyncReport[] | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/integrations/sync-live", { cache: "no-store" });
      if (!response.ok) return;
      setStatus((await response.json()) as SyncStatus);
    } catch {
      // Polling failure: keep the last known state.
    }
  }, []);

  useEffect(() => {
    void load();
    const intervalMs = Math.max((status?.intervalSeconds ?? 5), 2) * 1000;
    const timer = setInterval(() => void load(), intervalMs);
    return () => clearInterval(timer);
  }, [load, status?.intervalSeconds]);

  async function syncNow() {
    setSyncing(true);
    try {
      const response = await fetch("/api/dashboard/integrations/sync-live", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        const data = (await response.json()) as { reports: SyncReport[] };
        setReports(data.reports);
        await load();
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="relative group flex items-center gap-2">
      {status?.realtimeSync && status.connectedCount > 0 && (
        <span
          data-testid="live-integration-sync-badge"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          ⚡ Real-Time Sync Active
          <span className="text-emerald-600/70">· {status.intervalSeconds}s</span>
        </span>
      )}
      <button
        type="button"
        data-testid="sync-all-now"
        onClick={() => void syncNow()}
        disabled={readOnly || syncing}
        className={cn(
          "rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-slate-50",
          (readOnly || syncing) && "cursor-not-allowed opacity-50",
        )}
      >
        {syncing ? "Syncing…" : "Sync All Now"}
      </button>
      {reports && reports.length > 0 && (
        <div className="absolute right-0 top-full z-40 mt-2 hidden w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl group-hover:block">
          <p className="mb-1 text-xs font-semibold text-slate-700">Last sync pass</p>
          <ul className="space-y-1">
            {reports.map((report) => (
              <li key={report.provider} className="text-[11px] text-slate-500">
                <span className="font-medium text-slate-700">{report.name}</span>{" "}
                <span className={report.mode === "live" ? "text-emerald-600" : "text-amber-600"}>({report.mode})</span>{" "}
                — {report.note}
                {report.newEvents > 0 && <span className="ml-1 font-semibold text-brand-600">+{report.newEvents}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
