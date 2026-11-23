import { cn } from "@/lib/utils";

/**
 * QASyn emblem — Precision Workspace.
 * A teal rounded square with a white proof tick and a light orbit dot.
 */
export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="relative inline-flex size-7 shrink-0">
        <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#0F6B5C" />
          <path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="24.5" cy="8.5" r="2.1" fill="#FAFAF7" />
        </svg>
        <span className="absolute inset-0 rounded-lg ring-1 ring-black/5" aria-hidden="true" />
      </span>
      <span className={cn("text-lg", inverted ? "text-white" : "text-pw-heading")}>
        QA<span className={inverted ? "text-brand-200" : "text-brand-600"}>Syn</span>
      </span>
    </span>
  );
}
