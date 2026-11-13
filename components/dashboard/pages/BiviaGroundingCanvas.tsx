"use client";

import { useState } from "react";
import { CqaIcon } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

export interface GroundingBoxView {
  x: number;
  y: number;
  width: number;
  height: number;
  rawBox?: [number, number, number, number];
  space?: string;
  label?: string;
  confidence?: number;
  provider?: string;
  status?: string;
  abstainReason?: string;
}

function confidencePct(value: number | undefined) {
  const raw = Number(value ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.max(0, Math.min(100, raw <= 1 ? raw * 100 : raw));
}

function VisualPreview() {
  return (
    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#f8fafc] via-white to-[#eef2ff]">
      <div className="flex h-7 items-center gap-1 border-b border-[#e5e7eb] bg-white px-2">
        <span className="size-1.5 rounded-full bg-[#fca5a5]" />
        <span className="size-1.5 rounded-full bg-[#fcd34d]" />
        <span className="size-1.5 rounded-full bg-[#86efac]" />
        <span className="ml-2 h-3 flex-1 rounded bg-[#f1f5f9]" />
      </div>
      <div className="grid h-[calc(100%-28px)] grid-cols-[24%_1fr]">
        <div className="space-y-2 border-r border-[#eef0f3] bg-white/70 p-2.5">
          <div className="h-2 w-14 rounded bg-[#cbd5e1]" />
          <div className="h-1.5 w-full rounded bg-[#e2e8f0]" />
          <div className="h-1.5 w-4/5 rounded bg-[#e2e8f0]" />
          <div className="h-1.5 w-3/5 rounded bg-[#e2e8f0]" />
          <div className="mt-3 h-6 rounded-md bg-[#eef2ff]" />
          <div className="h-1.5 w-5/6 rounded bg-[#e2e8f0]" />
          <div className="h-1.5 w-2/3 rounded bg-[#e2e8f0]" />
        </div>
        <div className="space-y-2 p-3">
          <div className="h-2.5 w-32 rounded bg-[#94a3b8]" />
          <div className="h-1.5 w-2/3 rounded bg-[#e2e8f0]" />
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((index) => (
              <div key={index} className="space-y-1.5 rounded-md border border-[#eef0f3] bg-white p-2">
                <div className="h-4 w-4 rounded bg-[#e0e7ff]" />
                <div className="h-1.5 w-4/5 rounded bg-[#e2e8f0]" />
                <div className="h-1.5 w-3/5 rounded bg-[#e2e8f0]" />
              </div>
            ))}
          </div>
          <div className="mt-2 h-1.5 w-full rounded bg-[#e2e8f0]" />
          <div className="h-1.5 w-5/6 rounded bg-[#e2e8f0]" />
        </div>
      </div>
    </div>
  );
}

/**
 * Neon visual-grounding overlay. Coordinates arrive normalized on a 0–1000
 * canvas, so each value is divided by 10 to obtain a percentage. The badge
 * always exposes the raw `[x1, y1, x2, y2]` box from Bivia.
 */
export function BiviaGroundingCanvas({
  box,
  confidence,
  label,
  imageSrc,
  title = "Visual preview",
  className,
  compact = false,
}: {
  box: GroundingBoxView;
  confidence?: number;
  label?: string;
  imageSrc?: string | null;
  title?: string;
  className?: string;
  compact?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const pct = confidencePct(confidence ?? box.confidence);
  const rawBox: [number, number, number, number] =
    Array.isArray(box.rawBox) && box.rawBox.length === 4
      ? box.rawBox
      : [Math.round(box.x), Math.round(box.y), Math.round(box.x + box.width), Math.round(box.y + box.height)];
  const left = Math.max(0, Math.min(100, box.x / 10));
  const top = Math.max(0, Math.min(100, box.y / 10));
  const width = Math.max(1.5, Math.min(100 - left, box.width / 10));
  const height = Math.max(1.5, Math.min(100 - top, box.height / 10));
  const caption = label || box.label || "QASyn Vision grounded target";

  return (
    <figure className={cn("min-w-0", className)} data-testid="bivia-grounding-canvas">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-[#dbe2ea] bg-white shadow-inner">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt={`${title} screenshot`} className="absolute inset-0 size-full object-cover" />
        ) : (
          <VisualPreview />
        )}
        <div className="pointer-events-none absolute inset-0 bg-[#0f172a]/5" />
        <div
          data-testid="bivia-grounding-overlay"
          role="img"
          tabIndex={0}
          aria-label={`QASyn Vision grounded ${caption} at ${rawBox.join(", ")} with ${pct.toFixed(1)}% confidence`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          className={cn(
            "absolute cursor-crosshair rounded-[5px] border-2 border-[#22d3ee] bg-[#22d3ee]/15 outline-none transition duration-150",
            "shadow-[0_0_14px_rgba(34,211,238,0.65),inset_0_0_10px_rgba(34,211,238,0.18)]",
            hovered && "border-[#67e8f9] bg-[#67e8f9]/25 shadow-[0_0_24px_rgba(103,232,249,0.9)]",
          )}
          style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
        >
          <span className="absolute -left-[3px] -top-[3px] size-2 rounded-full border border-white bg-[#22d3ee] shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
          <span className="absolute -right-[3px] -bottom-[3px] size-2 rounded-full border border-white bg-[#22d3ee] shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
          {hovered && (
            <span className="pointer-events-none absolute -top-9 left-0 z-10 max-w-[260px] truncate rounded-md border border-[#155e75] bg-[#083344] px-2 py-1 text-[10.5px] font-medium text-[#cffafe] shadow-lg">
              {caption}
            </span>
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-wrap items-center gap-1.5">
          <span
            data-testid="bivia-grounding-badge"
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#67e8f9]/50 bg-[#083344]/92 px-2.5 py-1 text-[10.5px] font-semibold text-[#cffafe] shadow-[0_4px_18px_rgba(8,51,68,0.35)] backdrop-blur"
          >
            🎯 QASyn Vision Grounded · [{rawBox.join(", ")}] · {pct.toFixed(1)}% confidence
          </span>
          {box.space && (
            <span className="rounded-full bg-white/85 px-2 py-0.5 text-[9.5px] font-medium text-[#475569]">
              {box.space} space
            </span>
          )}
        </div>
      </div>
      {!compact && (
        <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-[#6b7280]">
          <span className="inline-flex min-w-0 items-center gap-1">
            <CqaIcon name="my_location" className="text-[13px] text-[#5b4ee8]" />
            <span className="truncate">{caption}</span>
          </span>
          <span className="text-[#9ca3af]">
            {box.provider ? `${box.provider} · ` : ""}
            {box.status ?? "answered"}
          </span>
        </figcaption>
      )}
    </figure>
  );
}
