"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildCrawlLogs, hostFromUrl } from "@/lib/crawl";
import type { CrawlLogLine, LogTag } from "@/lib/types";
import { cn } from "@/lib/utils";

export const TAG_STYLES: Record<LogTag, string> = {
  DEPLOY: "text-sky-400",
  TEST: "text-brand-300",
  PR: "text-fuchsia-400",
  BUG: "text-amber-400",
  RCA: "text-orange-400",
  FIX: "text-emerald-400",
  INFO: "text-slate-400",
  WARN: "text-yellow-300",
  FAIL: "text-red-400",
  CRAWL: "text-sky-300",
  MAP: "text-violet-300",
  DONE: "text-emerald-400",
};

function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Dark "AQE Terminal" streaming CRAWL lines for a target URL.
 * Live mode replays the deterministic transcript against the elapsed time since `startedAt`.
 */
export function CrawlTerminal({
  targetUrl,
  startedAt,
  status = "running",
  logs,
  className,
  height = "h-56",
  compact = false,
}: {
  targetUrl: string | null;
  startedAt: string | null;
  status?: "running" | "completed" | "failed" | "idle";
  logs?: CrawlLogLine[];
  className?: string;
  height?: string;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => (logs && logs.length > 0 ? logs : targetUrl ? buildCrawlLogs(targetUrl) : []), [logs, targetUrl]);
  const live = status === "running" && Boolean(targetUrl);
  const start = startedAt ? new Date(startedAt).getTime() : now;
  const elapsed = now - start;
  const visible = live ? (mounted ? lines.filter((l) => l.offsetMs <= elapsed) : []) : lines;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [live]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible.length]);

  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/10 bg-term-950 shadow-xl", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-white/5 bg-term-800 px-3.5 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-[#ff6058]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="truncate font-mono text-[11px] text-term-text">AQE Terminal</span>
        </div>
        {targetUrl && (
          <span suppressHydrationWarning className="flex items-center gap-1.5 truncate font-mono text-[11px] text-term-dim">
            {live && <span className="size-1.5 animate-pulse rounded-full bg-term-mint" />}
            {live ? `Crawling ${hostFromUrl(targetUrl)} · ${formatElapsed(elapsed)}` : status === "completed" ? "Crawl complete" : hostFromUrl(targetUrl)}
          </span>
        )}
      </div>
      <div ref={scrollRef} className={cn("overflow-y-auto px-3.5 py-2.5 font-mono leading-6", compact ? "text-[11px]" : "text-[12px]", height)} aria-live="polite">
        {!targetUrl ? (
          <p className="text-term-dim">
            <span className="text-term-mint">aqe</span>:~$ waiting for a URL to crawl…
            <span className="ml-1 inline-block h-3.5 w-1.5 animate-blink bg-term-text align-middle" />
          </p>
        ) : (
          <>
            {visible.map((line, i) => (
              <p key={`${i}-${line.offsetMs}`} className="flex gap-2.5 animate-fade-in">
                <span className={cn("w-12 shrink-0 font-semibold", TAG_STYLES[line.tag] ?? "text-slate-400")}>{line.tag}</span>
                <span className="min-w-0 break-words text-term-text">{line.message}</span>
              </p>
            ))}
            {live && <span className="inline-block h-3.5 w-1.5 animate-blink bg-term-text align-middle" />}
          </>
        )}
      </div>
    </div>
  );
}
