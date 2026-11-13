"use client";

import { useState } from "react";
import { BiviaGroundingCanvas, type GroundingBoxView } from "@/components/dashboard/pages/BiviaGroundingCanvas";
import { CqaIcon, ErrorNote, cqaBtnPrimary, cqaCard, cqaInput, cqaLabel } from "@/components/dashboard/ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

interface GroundResponse {
  targetUrl: string;
  screenshotBase64: string | null;
  screenshotCaptured: boolean;
  domCaptured: boolean;
  result: GroundingBoxView & { confidencePct: number; latencyMs: number };
}

/** Interactive Bivia visual-grounding lab for /dashboard/visual-testing. */
export function BiviaGroundingLab({
  defaultTarget,
  initialBox,
}: {
  defaultTarget: string;
  initialBox: GroundingBoxView;
}) {
  const [targetUrl, setTargetUrl] = useState(defaultTarget);
  const [description, setDescription] = useState("Primary call-to-action button");
  const [box, setBox] = useState<GroundingBoxView>(initialBox);
  const [confidence, setConfidence] = useState(initialBox.confidence ?? 0.88);
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<string>("");

  async function ground() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch<GroundResponse>("/api/dashboard/bivia/ground", {
        method: "POST",
        json: { targetUrl, targetDescription: description.trim() || "Primary call-to-action button" },
      });
      setBox(response.result);
      setConfidence(response.result.confidence ?? 0);
      setImage(
        response.screenshotBase64
          ? response.screenshotBase64.startsWith("data:image/")
            ? response.screenshotBase64
            : `data:image/png;base64,${response.screenshotBase64}`
          : null,
      );
      setMeta(
        `${response.result.provider} · ${response.result.latencyMs} ms · ${response.domCaptured ? "DOM captured" : "synthetic DOM"} · ${
          response.screenshotCaptured ? "screenshot captured" : "visual preview"
        }`,
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cn(cqaCard, "overflow-hidden")} data-testid="bivia-grounding-lab">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0f1f3] px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#111827]">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#ecfeff] text-[15px]">🎯</span>
            QASyn Vision grounding canvas
          </h2>
          <p className="mt-1 text-[11.5px] leading-4 text-[#6b7280]">
            Ground any UI target to a normalized bounding box with a neon overlay. Coordinates are shown exactly as QASyn Vision AI returns them.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfeff] px-2.5 py-1 text-[10.5px] font-semibold text-[#0e7490]">
          <CqaIcon name="my_location" className="text-[13px]" /> 0–1000 canvas
        </span>
      </header>
      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <BiviaGroundingCanvas box={box} confidence={confidence} imageSrc={image} title="QASyn Vision grounding preview" />
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void ground();
          }}
        >
          <label className="block">
            <span className={cqaLabel}>Target URL</span>
            <input className={cqaInput} value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder="https://www.cgi.com" />
          </label>
          <label className="block">
            <span className={cqaLabel}>Target description</span>
            <input
              className={cqaInput}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Primary call-to-action button"
            />
          </label>
          <button type="submit" data-testid="bivia-ground-run" disabled={busy} className={cn(cqaBtnPrimary, "w-full")}>
            <CqaIcon name={busy ? "hourglass_top" : "my_location"} className="text-[16px]" />
            {busy ? "Grounding…" : "🎯 Run QASyn Vision Grounding"}
          </button>
          <ErrorNote error={error} />
          <p className="text-[10.5px] leading-4 text-[#9ca3af]">
            Playwright captures the rendered viewport when available. Offline runs use the calibrated deterministic box.
          </p>
          {meta && <p data-testid="bivia-ground-meta" className="rounded-md bg-[#f8fafc] px-2.5 py-2 text-[10.5px] leading-4 text-[#475569]">{meta}</p>}
        </form>
      </div>
    </section>
  );
}
