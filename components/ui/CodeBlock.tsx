"use client";

import { useEffect, useState } from "react";

/**
 * Bloc de code sombre avec bouton "Copy".
 * `code` est affiché (éventuellement masqué), `copyText` est copié dans le presse-papiers.
 */
export function CodeBlock({ code, copyText, title }: { code: string; copyText?: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText ?? code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-navy-700 bg-navy-950 shadow-md">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">{title}</span>
        <button
          type="button"
          onClick={copy}
          className="rounded-md px-2 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed text-slate-200">
        {code.split("\n").map((line, i) => (
          <div key={i} className={line.startsWith("#") ? "text-slate-500" : undefined}>
            {!line.startsWith("#") && <span className="mr-2 select-none text-brand-400">$</span>}
            {line}
          </div>
        ))}
      </pre>
    </div>
  );
}
