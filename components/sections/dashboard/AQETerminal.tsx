"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api";
import type { LogDTO, LogTag, RunDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const LINE_INTERVAL_MS = 380;

const TAG_STYLES: Record<LogTag, string> = {
  DEPLOY: "text-sky-400",
  TEST: "text-brand-300",
  PR: "text-fuchsia-400",
  BUG: "text-amber-400",
  RCA: "text-orange-400",
  FIX: "text-emerald-400",
  INFO: "text-slate-400",
  WARN: "text-yellow-300",
  FAIL: "text-red-400",
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

type RunOption = Pick<RunDTO, "id" | "release" | "version" | "status">;

/**
 * Terminal AQE ("ship watch --all") : rejoue ligne par ligne les LogLine
 * d'un run (lues en SQL côté serveur, puis via /api/dashboard/runs/:id/logs).
 */
export function AQETerminal({
  runs,
  initialRunId,
  initialLogs,
  project,
}: {
  runs: RunOption[];
  initialRunId: string;
  initialLogs: LogDTO[];
  project: string;
}) {
  const [runId, setRunId] = useState(initialRunId);
  const [logs, setLogs] = useState(initialLogs);
  const [visible, setVisible] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const done = visible >= logs.length;

  // Animation : une ligne de plus toutes les LINE_INTERVAL_MS
  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => setVisible((v) => v + 1), LINE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [visible, done]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible]);

  async function selectRun(id: string) {
    setRunId(id);
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ logs: LogDTO[] }>(`/api/dashboard/runs/${encodeURIComponent(id)}/logs`);
      setLogs(res.logs);
      setVisible(0);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="terminal" className="scroll-mt-6 overflow-hidden rounded-xl border border-navy-700 bg-black shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-navy-950 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-red-500/80" />
            <span className="size-2.5 rounded-full bg-amber-400/80" />
            <span className="size-2.5 rounded-full bg-emerald-500/80" />
          </span>
          <span className="font-mono text-xs text-slate-400">AQE Terminal — {project}</span>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="run-select" className="sr-only">
            Release
          </label>
          <select
            id="run-select"
            value={runId}
            disabled={loading}
            onChange={(e) => selectRun(e.target.value)}
            className="rounded-md border border-white/10 bg-navy-900 px-2 py-1 font-mono text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                Release {r.release} · {r.version}
                {r.status === "FAILED" ? " ✗" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setVisible(0)}
            className="rounded-md px-2 py-1 font-mono text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            ↻ Replay
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="h-80 overflow-y-auto px-4 py-3 font-mono text-[12.5px] leading-6" aria-live="polite">
        <p className="text-slate-300">
          <span className="text-emerald-400">ship</span>
          <span className="text-slate-500">:~$</span> ship watch --all
        </p>
        {logs.slice(0, visible).map((line) => (
          <p key={line.id} className="flex gap-3 whitespace-pre-wrap animate-fade-in">
            <span className="shrink-0 text-slate-600">{formatTime(line.timestamp)}</span>
            <span className={cn("w-14 shrink-0 font-semibold", TAG_STYLES[line.tag])}>{line.tag}</span>
            <span className={line.stream === "stderr" ? "text-red-300" : "text-slate-200"}>{line.message}</span>
          </p>
        ))}
        {loading && <p className="text-slate-500">Loading logs…</p>}
        {error && <p className="text-red-400">{error}</p>}
        <p className="mt-1 flex items-center gap-2 text-slate-500">
          {done ? (
            <>
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Watching for changes
            </>
          ) : (
            <span className="inline-block h-4 w-2 animate-pulse bg-slate-300" />
          )}
        </p>
      </div>
    </div>
  );
}
