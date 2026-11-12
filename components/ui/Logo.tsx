import { cn } from "@/lib/utils";

/**
 * QASyn emblem — Obsidian Quantum Precision.
 * A cyan → indigo crystal with an emerald proof tick and a calibrated orbit dot.
 */
export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="relative inline-flex size-7 shrink-0">
        <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
          <defs>
            <linearGradient id="qasyn-logo" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="52%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
            <radialGradient id="qasyn-logo-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="16" cy="16" r="15" fill="url(#qasyn-logo-glow)" />
          <rect x="2" y="2" width="28" height="28" rx="9" fill="url(#qasyn-logo)" />
          <path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="24.5" cy="8.5" r="2.1" fill="#34d399" />
        </svg>
        <span className="absolute inset-0 rounded-[9px] ring-1 ring-white/20" aria-hidden="true" />
      </span>
      <span className={cn("text-lg", inverted ? "text-white" : "text-ink")}>
        QA<span className={inverted ? "text-quantum-300" : "text-quantum-600"}>Syn</span>
      </span>
    </span>
  );
}
