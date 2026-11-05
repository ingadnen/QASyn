import { cn } from "@/lib/utils";

export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <defs>
          <linearGradient id="qasyn-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#756af2" />
            <stop offset="100%" stopColor="#3d2ee0" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="url(#qasyn-logo)" />
        <path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={cn("text-lg", inverted ? "text-white" : "text-ink")}>
        QA<span className={inverted ? "text-brand-300" : "text-brand-600"}>Syn</span>
      </span>
    </span>
  );
}
