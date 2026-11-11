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

const KINDS: Array<{ key: keyof BiviaObservatorySummary["counts"]; label: string; icon: string }> = [
  { key: "boolean", label: "Boolean", icon: "toggle_on" },
  { key: "choice", label: "Choice", icon: "list_alt" },
  { key: "ground", label: "Ground", icon: "my_location" },
  { key: "score", label: "Score", icon: "speed" },
  { key: "set", label: "Set", icon: "checklist" },
];

/**
 * Articul8 Bivia 1B token grant observatory. Presentational: the summary is
 * projected server-side from the persistent, git-ignored decision ledger.
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
  const usedLabel = summary.used.toLocaleString("en-US");
  const remainingLabel = summary.remaining.toLocaleString("en-US");
  const progress = summary.used > 0 ? Math.max(1, Math.min(100, summary.usedPct)) : 0;

  return (
    <section
      data-testid="bivia-observatory"
      className={cn(cqaCard, "overflow-hidden", className)}
      aria-label="Articul8 Bivia 1B Token Grant Observatory"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0f1f3] px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#111827]">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#f5f3ff] text-[15px]">🧠</span>
            Articul8 Bivia 1B Token Grant Observatory
          </h2>
          <p className="mt-1 text-[11.5px] leading-4 text-[#6b7280]">
            Every boolean, choice, ground, score and set decision is metered against the workspace grant.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfdf3] px-2.5 py-1 text-[10.5px] font-semibold text-[#067647]">
          <span className="size-1.5 rounded-full bg-[#12b76a]" /> Live ledger
        </span>
      </header>

      <div className="px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11.5px] text-[#6b7280]">Tokens Grant</p>
            <p data-testid="bivia-tokens-grant" className="mt-0.5 text-[24px] font-semibold leading-8 tracking-[-0.01em] text-[#111827]">
              1,000,000,000
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11.5px] text-[#6b7280]">Tokens Used</p>
            <p data-testid="bivia-tokens-used" className="mt-0.5 text-[18px] font-semibold leading-7 text-[#5b4ee8]">
              {usedLabel}
            </p>
            <p className="text-[10.5px] text-[#9ca3af]">{summary.decisions.toLocaleString("en-US")} decision(s)</p>
          </div>
          <div className="text-right">
            <p className="text-[11.5px] text-[#6b7280]">Tokens Remaining</p>
            <p data-testid="bivia-tokens-remaining" className="mt-0.5 text-[18px] font-semibold leading-7 text-[#067647]">
              {remainingLabel}
            </p>
            <p className="text-[10.5px] text-[#9ca3af]">{summary.usedPct < 0.01 && summary.used > 0 ? "<0.01%" : `${summary.usedPct.toFixed(2)}%`} consumed</p>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[10.5px] text-[#9ca3af]">
            <span>Grant utilisation</span>
            <span>
              {usedLabel} / 1,000,000,000 tokens
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#eef0f3]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(summary.usedPct.toFixed(2))}>
            <div className="h-full rounded-full bg-gradient-to-r from-[#8b80ff] to-[#5b4ee8]" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {KINDS.map((kind) => (
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

        <div className={cn("mt-3 grid gap-2", compact ? "sm:grid-cols-2" : "sm:grid-cols-4")}>
          <Metric
            label="Avg Calibration Confidence (%)"
            value={`${summary.avgConfidencePct.toFixed(1)}%`}
            hint="answered decisions"
            testId="bivia-confidence"
            icon="verified"
          />
          <Metric
            label="Abstention Rate (%)"
            value={`${summary.abstentionRatePct.toFixed(1)}%`}
            hint={`${summary.abstained} abstained`}
            testId="bivia-abstention"
            icon="pan_tool"
          />
          <Metric
            label="Avg Latency (ms)"
            value={summary.avgLatencyMs.toLocaleString("en-US")}
            hint={`${summary.providerSplit.api} API · ${summary.providerSplit.fallback} fallback`}
            testId="bivia-latency"
            icon="timer"
          />
          <Metric
            label="Estimated LLM Cost Saved ($)"
            value={`$${summary.estimatedCostSaved.toFixed(2)}`}
            hint={`${summary.imageTokens.toLocaleString("en-US")} image · ${summary.textTokens.toLocaleString("en-US")} text tokens`}
            testId="bivia-cost-saved"
            icon="savings"
          />
        </div>

        {!compact && (
          <p className="mt-3 border-t border-[#f0f1f3] pt-2.5 text-[10.5px] leading-4 text-[#9ca3af]">
            Derived estimates only · the ledger stores no prompt text, image bytes or API key.
            {summary.lastDecisionAt ? ` Last decision ${new Date(summary.lastDecisionAt).toLocaleString("en-US")}.` : " Awaiting the first Bivia decision."}
          </p>
        )}
      </div>
    </section>
  );
}
