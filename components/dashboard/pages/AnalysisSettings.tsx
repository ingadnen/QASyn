"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisCodeSettings } from "@/lib/tenant";
import { CqaIcon, cqaBtnPrimary, cqaBtnSecondary, useAction } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

interface Props {
  readOnly: boolean;
  initial: AnalysisCodeSettings;
  environments: Array<{ id: string; name: string; isDefault: boolean }>;
}

const inputCls =
  "h-[41px] w-full rounded-md border border-[#d1d5db] bg-white px-3 text-[14px] text-[#0a0a0a] outline-none transition placeholder:text-[#9ca3af] focus:border-[#8b80ff] focus:ring-2 focus:ring-[#e4e1fd]";
const areaCls = cn(inputCls, "h-auto min-h-[92px] resize-y py-2.5 font-mono text-[13px]");
const labelCls = "mb-2 block text-[14px] font-medium text-[#374151]";
const helpCls = "mt-1.5 block text-[12.5px] leading-5 text-[#6b7280]";

function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[22px] w-[40px] shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-[#5b4ee8]" : "bg-[#d1d5db]",
      )}
    >
      <span className={cn("absolute top-[3px] size-4 rounded-full bg-white shadow transition", checked ? "left-[21px]" : "left-[3px]")} />
    </button>
  );
}

export function AnalysisSettings({ readOnly, initial, environments }: Props) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [form, setForm] = useState<AnalysisCodeSettings>({
    ...initial,
    environmentId: initial.environmentId || environments.find((e) => e.isDefault)?.id || environments[0]?.id || "",
  });
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof AnalysisCodeSettings>(key: K, value: AnalysisCodeSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  async function save() {
    const res = await run("save", "/api/dashboard/settings/analysis", { method: "PATCH", json: form });
    if (res) {
      setSaved(true);
      router.refresh();
    }
  }

  const modes = [
    { value: "never", title: "Don't run them", copy: "Analyse and report only. Nothing is executed." },
    { value: "after_merge", title: "After the pull request merges", copy: "Run the affected cases against your chosen environment once the merged build is deployed." },
    { value: "before_merge", title: "Before it merges", copy: "Run against the pull request's own build, so the PR carries real pass/fail before anyone approves it." },
  ] as const;

  return (
    <div className="pb-10">
      <h1 className="text-[20px] font-bold leading-7 text-[#101828]">Analysis Settings</h1>

      <div className="mt-6 rounded-[12px] border border-[#dbdee5] bg-white p-[25px] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]">
        <h3 className="text-[18px] font-semibold text-[#262626]">Targets &amp; Execution per repo</h3>
        <p className="mt-1 text-[13.5px] text-[#6b7280]">Where approved changes land, and where they run.</p>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Base branch filter</span>
            <input className={inputCls} value={form.baseBranches} onChange={(e) => set("baseBranches", e.target.value)} disabled={readOnly} />
            <span className={helpCls}>Only PRs targeting these branches are analyzed. Separate with commas, e.g. main, release/*. Use * for every branch.</span>
          </label>
          <label className="block">
            <span className={labelCls}>Max files per analysis</span>
            <input type="number" min={1} className={inputCls} value={form.maxFiles} onChange={(e) => set("maxFiles", Number(e.target.value))} disabled={readOnly} />
            <span className={helpCls}>Cost/latency guard. Beyond this the run is marked partial.</span>
          </label>
          <label className="block lg:col-span-2">
            <span className={labelCls}>Path scope</span>
            <textarea className={areaCls} value={form.pathScope} onChange={(e) => set("pathScope", e.target.value)} disabled={readOnly} placeholder={"apps/web/**\npackages/ui/**"} />
            <span className={helpCls}>One glob per line. Monorepo subtree scoping — e.g. apps/web/**.</span>
          </label>
        </div>

        <div className="mt-8 border-t border-[#e5e7eb] pt-6">
          <h4 className="text-[15px] font-semibold text-[#262626]">When should we run your tests?</h4>
          <p className="mt-1 text-[13px] text-[#6b7280]">Impact analysis tells you which cases a change affects. This decides whether we also run them.</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {modes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                disabled={readOnly}
                onClick={() => set("runMode", mode.value)}
                className={cn(
                  "rounded-lg border p-4 text-left transition",
                  form.runMode === mode.value ? "border-[#5b4ee8] bg-[#f7f5ff] ring-1 ring-[#dcd7ff]" : "border-[#e5e7eb] bg-white hover:border-[#c4bdfa]",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn("flex size-4 items-center justify-center rounded-full border", form.runMode === mode.value ? "border-[#5b4ee8]" : "border-[#d1d5db]")}>
                    {form.runMode === mode.value && <span className="size-2 rounded-full bg-[#5b4ee8]" />}
                  </span>
                  <span className={cn("text-[14px] font-medium", form.runMode === mode.value ? "text-[#4f46e5]" : "text-[#374151]")}>{mode.title}</span>
                </span>
                <span className="mt-2 block text-[12.5px] leading-5 text-[#6b7280]">{mode.copy}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 max-w-[420px]">
            <label className="block">
              <span className={labelCls}>Environment <span className="text-[#ef4444]">*</span></span>
              <select className={inputCls} value={form.environmentId} onChange={(e) => set("environmentId", e.target.value)} disabled={readOnly}>
                {environments.map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}
              </select>
              <span className={helpCls}>The run uses this environment&apos;s variables, overriding what each case would otherwise use.</span>
            </label>
          </div>

          <div className="mt-5 flex gap-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-[12.5px] leading-5 text-[#92400e]">
            <CqaIcon name="warning" className="mt-0.5 shrink-0 text-[18px]" />
            <p>
              <strong className="font-semibold">Cases with a fixed URL will not test the new build.</strong> The environment above reaches steps that use environment variables. A step with a hard-coded URL, a global, or a URL written into an AI-agent instruction keeps pointing where it already pointed — so it will pass without having tested this deployment.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-[12px] border border-[#dbdee5] bg-white p-[25px] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]" data-testid="bivia-settings">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-[18px] font-semibold text-[#262626]">
              <span aria-hidden="true">✨</span> QASyn Vision AI
            </h3>
            <p className="mt-1 text-[13.5px] text-[#6b7280]">
              Calibrated AI for visual verification, smart locator self-healing and PR impact. QASyn Vision AI answers with a calibrated probability or abstains when evidence is insufficient.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="rounded-full border border-[#ddd6fe] bg-[#f5f3ff] px-2.5 py-1 text-[10.5px] font-semibold text-[#4f46e5]">
              Enterprise AI verification included
            </span>
            <a href="/dashboard/integrations" className="text-[11.5px] font-semibold text-[#5b4ee8] hover:underline">
              Manage QASyn Vision AI credentials →
            </a>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Default mode</span>
            <select className={inputCls} value={form.biviaMode} onChange={(e) => set("biviaMode", e.target.value as AnalysisCodeSettings["biviaMode"])} disabled={readOnly}>
              <option value="fast">fast — low latency</option>
              <option value="deep">deep — higher reasoning</option>
            </select>
            <span className={helpCls}>fast keeps each decision inside the 6-second budget; deep spends more reasoning on ambiguous screens.</span>
          </label>
          <label className="block">
            <span className={labelCls}>Abstention threshold</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              className={inputCls}
              value={form.biviaAbstentionThreshold}
              onChange={(e) => set("biviaAbstentionThreshold", Number(e.target.value))}
              disabled={readOnly}
            />
            <span className={helpCls}>Calibrated probability (0–1) below which QASyn Vision AI abstains instead of guessing. Default 0.35.</span>
          </label>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {([
            ["biviaEnabled", "Use live QASyn Vision AI", "Off keeps the deterministic calibrated fallback, so verification still runs offline."],
            ["biviaVerifyAi", "AI Verification", "Calibrate every AI Assertion step with status, probability and abstain reason."],
            ["biviaMagicLocator", "Smart Locator / Magic UI", "Calibrate the best Playwright locator in Studio."],
            ["biviaPrRisk", "PR impact analysis", "Score PR risk and select the exact impacted regression tests."],
          ] as const).map(([key, title, copy]) => (
            <div key={key} className="flex items-center gap-3 rounded-lg border border-[#eef0f3] px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-[#374151]">{title}</p>
                <p className="mt-0.5 text-[11.5px] leading-5 text-[#6b7280]">{copy}</p>
              </div>
              <Switch checked={form[key]} onChange={(v) => set(key, v)} label={title} disabled={readOnly} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 rounded-[12px] border border-[#dbdee5] bg-white p-[25px] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]">
        <h3 className="text-[18px] font-semibold text-[#262626]">Promotion, Governance &amp; Operations</h3>
        <p className="mt-1 text-[13.5px] text-[#6b7280]">Guardrails for applying changes and reporting back to the PR.</p>

        <div className="mt-5 divide-y divide-[#f0f1f3]">
          <div className="flex items-center gap-3 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[#374151]">Post PR comment</p>
              <p className="mt-0.5 text-[12.5px] text-[#6b7280]">Off leaves only the check.</p>
            </div>
            <Switch checked={form.postPrComment} onChange={(v) => set("postPrComment", v)} label="Post PR comment" />
          </div>
          <div className="flex items-center gap-3 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[#374151]">Post status check</p>
              <p className="mt-0.5 text-[12.5px] text-[#6b7280]">A check run on GitHub, a commit status on GitLab. Advisory either way — it never fails the build.</p>
            </div>
            <Switch checked={form.postStatusCheck} onChange={(v) => set("postStatusCheck", v)} label="Post status check" />
          </div>
        </div>

        <label className="mt-5 block">
          <span className={labelCls}>Suppress paths</span>
          <textarea className={areaCls} value={form.suppressPaths} onChange={(e) => set("suppressPaths", e.target.value)} disabled={readOnly} placeholder={"dist/**\nvendor/**"} />
          <span className={helpCls}>One glob per line. Never analyse generated or vendored code — the biggest source of noise.</span>
        </label>

        <p className="mt-5 text-[12.5px] leading-5 text-[#6b7280]">
          Every value here is snapshotted onto the analysis row at analysis time — the “Decided under” line in each row&apos;s detail renders that snapshot, not live config.
        </p>

        {error && <p className="mt-4 text-[12.5px] text-red-600">{error}</p>}
        <div className="mt-5 flex items-center justify-end gap-3 border-t border-[#f0f1f3] pt-5">
          {saved && <span className="text-[12.5px] font-medium text-[#00a63e]">Settings saved</span>}
          <button type="button" className={cn(cqaBtnPrimary, "h-10 px-5 text-[14px]")} onClick={save} disabled={readOnly || pending === "save"}>
            <CqaIcon name="save" className="text-[18px]" />
            {pending === "save" ? "Updating…" : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}
