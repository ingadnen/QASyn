import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Affiche un spinner + un fond animé, et désactive le bouton */
  loading?: boolean;
  /** Libellé affiché pendant le chargement, ex. "Creating organisation..." */
  loadingText?: string;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm shadow-brand-600/30 hover:bg-brand-500 focus-visible:outline-brand-500",
  secondary:
    "border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:outline-brand-500",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-brand-500",
  danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50 focus-visible:outline-red-500",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingText,
  fullWidth = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        loading
          ? "cursor-wait"
          : "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        loading &&
          variant === "primary" &&
          "animate-shimmer bg-gradient-to-r from-brand-700 via-brand-400 to-brand-700 bg-[length:200%_100%]",
        className,
      )}
      {...rest}
    >
      {loading && <Spinner />}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
}
