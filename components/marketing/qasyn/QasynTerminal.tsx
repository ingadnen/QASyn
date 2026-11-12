"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface TerminalLine {
  time: string;
  tag: string;
  message: string;
  stream: "stdout" | "stderr";
}

const TAG_COLORS: Record<string, string> = {
  DEPLOY: "text-sky-300",
  TEST: "text-term-mint",
  PR: "text-violet-300",
  BUG: "text-rose-300",
  RCA: "text-amber-300",
  FIX: "text-emerald-300",
  WARN: "text-orange-300",
  FAIL: "text-red-400",
  INFO: "text-term-dim",
};

/** Terminal "qasyn watch --all" rejoué ligne par ligne (boucle). */
export function QasynTerminal({ lines, intervalMs = 650 }: { lines: TerminalLine[]; intervalMs?: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const done = shown >= lines.length;
    const id = setTimeout(() => setShown(done ? 0 : shown + 1), done ? 4000 : intervalMs);
    return () => clearTimeout(id);
  }, [shown, lines.length, intervalMs]);

  return (
    <div className="overflow-hidden rounded-[15px] bg-term-950 shadow-2xl shadow-black/30 ring-1 ring-black/40">
      <div className="flex items-center gap-2 bg-term-800 px-4 py-3">
        <span className="size-3 rounded-full bg-[#ff6058]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-xs text-term-dim">qasyn — acme/storefront</span>
      </div>
      <div className="h-[340px] overflow-hidden p-5 font-mono text-[12.5px] leading-relaxed" aria-live="off">
        <p className="text-[#eff4fb]">
          <span className="text-term-mint">$</span> qasyn watch --all
        </p>
        {lines.slice(0, shown).map((line, i) => (
          <p key={i} className={cn("animate-fade-in", line.stream === "stderr" ? "text-red-300/90" : "text-term-text")}>
            <span className="text-term-dim">{line.time}</span>{" "}
            <span className={cn("inline-block w-14 font-semibold", TAG_COLORS[line.tag] ?? "text-term-text")}>{line.tag}</span>
            {line.message}
          </p>
        ))}
        <span className="inline-block h-4 w-2 animate-blink bg-term-mint align-middle" />
      </div>
    </div>
  );
}
