import { cn } from "@/lib/utils";

export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "brand" | "info";

const TONES: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/10",
  brand: "bg-brand-50 text-brand-700 ring-brand-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
};

const DOTS: Record<BadgeTone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  neutral: "bg-slate-400",
  brand: "bg-brand-500",
  info: "bg-sky-500",
};

export function Badge({
  tone = "neutral",
  dot = false,
  pulse = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span className="relative flex size-1.5">
          {pulse && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", DOTS[tone])} />}
          <span className={cn("relative inline-flex size-1.5 rounded-full", DOTS[tone])} />
        </span>
      )}
      {children}
    </span>
  );
}
