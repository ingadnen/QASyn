"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  /** Élément affiché à droite du champ (indicateur de statut…) */
  trailing?: React.ReactNode;
  /** Préfixe affiché à gauche (ex. "https://") */
  leading?: React.ReactNode;
}

export function Input({ label, hint, error, trailing, leading, id, className, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div
        className={cn(
          "mt-1.5 flex items-center rounded-lg border bg-white shadow-sm transition focus-within:ring-4",
          error
            ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-100"
            : "border-slate-200 focus-within:border-brand-400 focus-within:ring-brand-100",
        )}
      >
        {leading && <span className="pl-3 text-sm text-slate-400">{leading}</span>}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-10 w-full min-w-0 flex-1 rounded-lg bg-transparent px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          {...rest}
        />
        {trailing && <span className="flex shrink-0 items-center pr-3">{trailing}</span>}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <div id={`${inputId}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
