"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  value: string;
  maxLength: number;
  error?: string | null;
  hint?: React.ReactNode;
}

/** Zone de texte avec compteur de caractères. */
export function Textarea({ label, value, maxLength, error, hint, id, className, ...rest }: TextareaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const ratio = value.length / maxLength;

  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div
        className={cn(
          "mt-1.5 rounded-xl border bg-white shadow-sm transition focus-within:ring-4",
          error
            ? "border-red-300 focus-within:ring-red-100"
            : "border-slate-200 focus-within:border-brand-400 focus-within:ring-brand-100",
        )}
      >
        <textarea
          id={inputId}
          value={value}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          className="block min-h-48 w-full resize-y rounded-xl bg-transparent px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none"
          {...rest}
        />
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs">
          <span className="text-slate-400">{hint}</span>
          <span
            className={cn(
              "tabular-nums",
              ratio >= 1 ? "text-red-600" : ratio > 0.9 ? "text-amber-600" : "text-slate-400",
            )}
          >
            {value.length.toLocaleString("en-US")} / {maxLength.toLocaleString("en-US")}
          </span>
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
