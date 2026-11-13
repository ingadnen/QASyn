import type { BiviaObservatorySummary } from "@/lib/bivia-telemetry";
import { CqaIcon, cqaCard } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

function Metric({
  label,
  value,
  hint,
  testId,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  testId?: string;
  icon?: string;
}) {
  return (
    <div className="rounded-lg border border-[#eef0f3] bg-[#fcfcfd] px-3 py-2.5">
      <p className="flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-[0.05em] text-[#9ca3af]">
        {icon && <CqaIcon name={icon} className="text-[13px] text-[#5b4ee8]" />}
        {label}
      </p>
      <p data-testid={testId} className="mt-1 text-[17px] font-semibold leading-6 text-[#111827]">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[10.5px] text-[#9ca3af]">{hint}</p>}
    </div>
  );
}

const CAPABILITIES: Array<{ key: keyof BiviaObservatorySummary["counts"]; label: string; icon: string }> = [
  { key: "boolean", label: "Visual assertions", icon: "toggle_on" },
  { key: "choice", label: "Guided choices", icon: "list_alt" },
  { key: "ground", label: "Locator grounding", icon: "my_location" },
  { key: "score", label: "Risk scoring", icon: "speed" },
  { key: "set", label: "Test selection", icon: "checklist" },
];

/**
 * Customer-facing QASyn AI telemetry. Internal model/token details stay in the
 * server ledger; this surface only exposes commercial product outcomes.
 */
export function BiviaObservatory({
  summary,
  compact = false,
  className,
}: {
  summary: BiviaObservatorySummary;
  compact?: boolean;
  className?: string;
}) {
  const verifications = summary.decisions;
  const selfHealed = summary.counts.ground;
  const hoursSaved = Math.round(verifications * 0.12 * 10) / 10;
  const qaCostSaved = Math.round(hoursSaved * 65);

  return (
    <section
      data-testid="bivia-observatory"
      className={cn(cqaCard, "overflow-hidden", className)}
      aria-label="QASyn Autonomous AI Execution & Calibration Telemetry"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0f1f3] px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#111827]">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#f5f3ff] text-[15px]">✨</span>
            QASyn Autonomous AI Execution &amp; Calibration Telemetry
          </h2>
          <p className="mt-1 text-[11.5px] leading-4 text-[#6b7280]">
            Every visual verification, calibrated decision and self-healed selector is measured in real time.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfdf3] px-2.5 py-1 text-[10.5px] font-semibold text-[#067647]">
          <span className="size-1.5 rounded-full bg-[#12b76a]" /> Live telemetry
        </span>
      </header>

      <div className="px-4 py-4">
        <div className={cn("grid gap-2", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4")}>
          <Metric
            label="AI Visual Verifications Run"
            value={verifications.toLocaleString("en-US")}
            hint="passed, failed and abstained checks"
            testId="qasyn-ai-verifications"
            icon="visibility"
          />
          <Metric
            label="Avg Calibration Confidence"
            value={`${summary.avgConfidencePct.toFixed(1)}%`}
            hint="answered decisions"
            testId="bivia-confidence"
            icon="verified"
          />
          <Metric
            label="Self-Healed Selectors"
            value={selfHealed.toLocaleString("en-US")}
            hint="locators re-grounded automatically"
            testId="qasyn-self-healed"
            icon="healing"
          />
          <Metric
            label="Estimated Manual QA Saved"
            value={`${hoursSaved.toFixed(1)} h · $${qaCostSaved.toLocaleString("en-US")}`}
            hint="hours · cost saved at $65/hour"
            testId="bivia-cost-saved"
            icon="savings"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {CAPABILITIES.map((kind) => (
            <span
              key={kind.key}
              data-testid={`bivia-kind-${kind.key}`}
              className="inline-flex items-center gap-1 rounded-md border border-[#eef0f3] bg-[#fafafa] px-2 py-1 text-[10.5px] font-medium text-[#4b5563]"
            >
              <CqaIcon name={kind.icon} className="text-[13px] text-[#5b4ee8]" />
              {kind.label} <span className="font-semibold text-[#111827]">{summary.counts[kind.key].toLocaleString("en-US")}</span>
            </span>
          ))}
        </div>

        {!compact && (
          <p className="mt-3 border-t border-[#f0f1f3] pt-2.5 text-[10.5px] leading-4 text-[#9ca3af]">
            Derived from QASyn&apos;s persistent AI decision ledger. No prompt text, screenshots or credentials are stored.
            {summary.lastDecisionAt ? ` Last AI decision ${new Date(summary.lastDecisionAt).toLocaleString("en-US")}.` : " Awaiting the first QASyn Vision AI decision."}
          </p>
        )}
      </div>
    </section>
  );
}
