"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type TabId = "grounding" | "pr" | "types";

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "grounding", label: "QASyn Vision Grounding", icon: "🎯" },
  { id: "pr", label: "PR Gatekeeper", icon: "🛡️" },
  { id: "types", label: "11-Type Engine", icon: "🧬" },
];

const TEST_TYPES = [
  "Functional",
  "End-to-End (E2E)",
  "Regression",
  "Smoke",
  "Sanity",
  "Load",
  "Performance",
  "Security",
  "Penetration",
  "API",
  "Accessibility",
] as const;

const TYPE_STEPS: Record<(typeof TEST_TYPES)[number], string[]> = {
  Functional: ["Navigate to target", "Verify URL / page shell", "Click primary navigation", "AI Assertion on heading", "Verify secondary controls", "AI Assertion on end-to-end state"],
  "End-to-End (E2E)": ["Navigate to target", "Verify entry point", "Click primary journey", "AI Assertion on journey state", "Verify downstream controls", "AI Assertion on final state"],
  Regression: ["Navigate to target", "Verify baseline URL", "Click regression surface", "AI Assertion on baseline behaviour", "Verify secondary section", "AI Assertion on state integrity"],
  Smoke: ["Navigate to target", "Verify page reachable", "Click primary control", "AI Assertion on smoke signal", "Verify critical controls", "AI Assertion on deploy health"],
  Sanity: ["Navigate to target", "Verify fixed surface", "Click the repaired control", "AI Assertion on fix scope", "Verify adjacent controls", "AI Assertion on no collateral change"],
  Load: ["Navigate under load", "Verify TTFB < 800ms · DCL < 2500ms", "Click route under load", "AI Assertion on CLS + paint", "Verify render-blocking budget", "AI Assertion on sustained responsiveness"],
  Performance: ["Navigate to target", "Verify TTFB < 800ms · DCL < 2500ms", "Click primary route transition", "AI Assertion on CLS + responsive paint", "Verify performance budget", "AI Assertion on sustained responsiveness"],
  Security: ["Navigate to target", "API Call: HSTS · CSP · X-Frame-Options", "Verify Secure + HttpOnly cookies", "AI Assertion on OWASP Top-10", "Verify HSTS max-age + frame-ancestors", "AI Assertion on no mixed content"],
  Penetration: ["Navigate to target", "Verify sanitised input surfaces", "Enter benign XSS/SQLi probe", "AI Assertion on escaping + CSP/WAF", "Verify no raw script reflection", "AI Assertion on no SQL error leakage"],
  API: ["Navigate to target", "API Call: GET + 200 / content-type", "Verify response payload structure", "AI Assertion on contract + latency", "Verify problem+json envelope", "AI Assertion on pagination/rate limits"],
  Accessibility: ["Navigate to target", "Verify WCAG landmarks + alt", "Keyboard focus primary control", "AI Assertion on AA contrast + labels", "Verify meaningful alt attributes", "AI Assertion on zero critical violations"],
};

function GroundingPanel() {
  return (
    <div className="space-y-3">
      <div className="relative h-44 overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(135deg,#0b1120,#111a2e)]">
        <div className="quantum-grid absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="absolute left-4 top-4 h-4 w-28 rounded bg-white/10" />
        <div className="absolute left-4 top-11 h-2.5 w-44 rounded bg-white/[0.07]" />
        <div className="absolute left-4 top-16 h-2.5 w-36 rounded bg-white/[0.07]" />
        <div className="absolute bottom-5 left-4 h-8 w-24 rounded-md bg-gradient-to-r from-brand-600 to-brand-400 opacity-80" />
        <div className="absolute bottom-[18%] left-[8%] right-[12%] top-[26%] rounded-md border-2 border-quantum-400 shadow-[0_0_24px_rgba(15,107,92,0.55),inset_0_0_18px_rgba(15,107,92,0.18)]">
          <span className="absolute -top-6 left-0 rounded bg-brand-600 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-white">QASYN AI · 96.8%</span>
          <span className="absolute -bottom-2 -right-2 size-2.5 rounded-full bg-quantum-400 shadow-[0_0_10px_rgba(15,107,92,0.9)]" />
        </div>
      </div>
      <div className="rounded-lg border border-black/40 bg-term-950 p-3 font-mono text-[10.5px] leading-5">
        <p className="text-term-dim"># broken legacy selector</p>
        <p className="text-rose-300 line-through">page.locator("#broken-legacy-selector-999")</p>
        <p className="mt-1 text-term-mint">✨ page.getByRole(&apos;button&apos;, &#123; name: /Start free/i &#125;)</p>
        <p className="mt-1 text-term-text">grounding: [320, 180, 960, 420] · calibrated 96.8%</p>
      </div>
    </div>
  );
}

function PrPanel() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-black/40 bg-term-950 p-3 font-mono text-[10.5px] leading-5">
        <p className="text-quantum-300">POST /api/webhooks/ci-pr</p>
        <p className="text-term-text">{`{ "prNumber": 402, "changedFiles": ["src/checkout/loan.ts"],`}</p>
        <p className="text-term-text">{`  "previewUrl": "https://www.bdc.ca", "createTests": true }`}</p>
        <p className="mt-1 text-term-mint">200 · verdict: APPROVED · Smoke:4 / Regression:6</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-pw-line bg-pw-bg p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-pw-muted">Blast radius</p>
          <p className="mt-1 text-xl font-semibold text-amber-700">2.9<span className="text-xs text-pw-muted">/10</span></p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stitch-surface-high">
            <span className="block h-full w-[29%] rounded-full bg-gradient-to-r from-brand-500 to-amber-500" />
          </div>
        </div>
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-brand-700">Gate verdict</p>
          <p className="mt-1 text-sm font-semibold text-brand-800">✅ APPROVED FOR MERGE</p>
          <p className="mt-1 text-[10.5px] text-pw-muted">per-step screenshots attached</p>
        </div>
      </div>
    </div>
  );
}

function TypesPanel() {
  const [selected, setSelected] = useState<(typeof TEST_TYPES)[number]>("Penetration");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {TEST_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setSelected(type)}
            aria-pressed={selected === type}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10.5px] font-medium transition",
              selected === type
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-pw-line bg-pw-bg text-pw-muted hover:border-brand-300 hover:text-brand-700",
            )}
          >
            {type}
          </button>
        ))}
      </div>
      <ol className="space-y-1.5 rounded-lg border border-black/40 bg-term-950 p-3">
        {TYPE_STEPS[selected].map((step, index) => (
          <li key={step} className="flex items-start gap-2 text-[11px] leading-5 text-term-text">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-quantum-500/15 font-mono text-[9px] font-bold text-quantum-300">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Phase 11 hero: interactive, tabbed live-command showcase. */
export function HeroShowcase() {
  const [tab, setTab] = useState<TabId>("grounding");
  return (
    <div data-testid="marketing-hero-showcase" className="rounded-lg border border-pw-line bg-white p-3 shadow-lg shadow-black/5">
      <div className="flex items-center justify-between gap-2 border-b border-pw-line pb-2.5">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="size-2 rounded-full bg-[#ff6058]" />
          <span className="size-2 rounded-full bg-[#febc2e]" />
          <span className="size-2 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="QASyn capability showcase">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition",
                tab === item.id ? "bg-brand-600 text-white" : "text-pw-muted hover:text-brand-700",
              )}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
        <span className="hidden rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[9.5px] font-semibold text-brand-700 sm:inline">
          ● LIVE
        </span>
      </div>
      <div className="pt-3">
        {tab === "grounding" && <GroundingPanel />}
        {tab === "pr" && <PrPanel />}
        {tab === "types" && <TypesPanel />}
      </div>
    </div>
  );
}
