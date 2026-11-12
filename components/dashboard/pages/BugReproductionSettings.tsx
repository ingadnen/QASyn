"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BugReproductionSettings } from "@/lib/tenant";
import { CqaIcon, cqaBtnPrimary, cqaBtnSecondary, useAction } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

interface Props {
  readOnly: boolean;
  initial: BugReproductionSettings;
  environments: Array<{ id: string; name: string; isDefault: boolean }>;
  dataProfiles: Array<{ id: string; name: string; environmentIds: string[] }>;
  linearConnected: boolean;
}

const inputCls =
  "h-[41px] w-full rounded-md border border-[#d1d5db] bg-white px-3 text-[14px] text-[#0a0a0a] outline-none transition placeholder:text-[#9ca3af] focus:border-[#8b80ff] focus:ring-2 focus:ring-[#e4e1fd] disabled:bg-[#f9fafb] disabled:text-[#6b7280]";
const labelCls = "mb-2 block text-[14px] font-medium text-[#374151]";
const helpCls = "mt-1.5 block text-[12.5px] leading-5 text-[#6b7280]";
const cardCls = "mt-6 rounded-[12px] border border-[#dbdee5] bg-white p-[25px] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]";
const h3Cls = "text-[18px] font-semibold text-[#262626]";

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-[22px] w-[40px] shrink-0 rounded-full transition", checked ? "bg-[#5b4ee8]" : "bg-[#d1d5db]")}
    >
      <span className={cn("absolute top-[3px] size-4 rounded-full bg-white shadow transition", checked ? "left-[21px]" : "left-[3px]")} />
    </button>
  );
}

function CheckRow({ label, copy, checked, onChange }: { label: string; copy: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2.5">
      <input type="checkbox" className="mt-0.5 size-4 rounded border-[#d1d5db] accent-[#5b4ee8]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-[14px] font-medium text-[#374151]">{label}</span>
        <span className="mt-0.5 block text-[12.5px] text-[#6b7280]">{copy}</span>
      </span>
    </label>
  );
}

export function BugReproductionSettingsForm({ readOnly, initial, environments, dataProfiles, linearConnected }: Props) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const defaultEnvId = environments.find((e) => e.isDefault)?.id ?? environments[0]?.id ?? "";
  const [form, setForm] = useState<BugReproductionSettings>({
    ...initial,
    environmentId: initial.environmentId || defaultEnvId,
  });
  const [labels, setLabels] = useState<string[]>(form.triggerLabels);
  const [labelDraft, setLabelDraft] = useState("");
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof BugReproductionSettings>(key: K, value: BugReproductionSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const profilesForEnv = useMemo(
    () => dataProfiles.filter((p) => !form.environmentId || p.environmentIds.length === 0 || p.environmentIds.includes(form.environmentId)),
    [dataProfiles, form.environmentId],
  );

  function addLabel() {
    const value = labelDraft.trim();
    if (!value || labels.includes(value)) return;
    const next = [...labels, value];
    setLabels(next);
    set("triggerLabels", next);
    setLabelDraft("");
  }

  async function save() {
    const payload = { ...form, triggerLabels: labels };
    const res = await run("save", "/api/dashboard/settings/bug-reproduction", { method: "PATCH", json: payload });
    if (res) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="pb-10">
      <h1 className="text-[20px] font-bold leading-7 text-[#101828]">Bug Reproduction Settings</h1>
      <p className="mt-2 max-w-5xl text-[14px] leading-6 text-[#4a5565]">
        Reproduce a bug from a plain-text report — a ticket, a Slack message, anything. The AI parses the report; these settings decide which Environment and Data Profile it reproduces with, and what to fall back to when neither is specified.
      </p>

      <section className={cardCls}>
        <h3 className={h3Cls}>Defaults</h3>
        <p className="mt-2 max-w-4xl text-[13.5px] leading-5 text-[#6b7280]">
          Used when a report doesn&apos;t name a specific Environment or Data Profile. Both are managed under Environments and Data Profiles — this only picks which one Bug Reproduction reaches for by default.
        </p>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Environment</span>
            <select className={inputCls} value={form.environmentId} onChange={(e) => { set("environmentId", e.target.value); set("dataProfileId", ""); }} disabled={readOnly}>
              <option value="">Select an Environment</option>
              {environments.map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}
            </select>
            <span className={helpCls}>The environment reproduction runs against unless the report names one.</span>
          </label>
          <label className="block">
            <span className={labelCls}>Data Profile</span>
            <select className={inputCls} value={form.dataProfileId} onChange={(e) => set("dataProfileId", e.target.value)} disabled={readOnly || !form.environmentId}>
              <option value="">{form.environmentId ? (profilesForEnv.length ? "Select a Data Profile" : "No data profiles for this environment") : "Select an environment first"}</option>
              {profilesForEnv.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <span className={helpCls}>Test-data profile attached to the default environment above.</span>
          </label>
        </div>
      </section>

      <section className={cardCls}>
        <h3 className={h3Cls}>Recognized label formats</h3>
        <p className="mt-2 max-w-4xl text-[13.5px] leading-5 text-[#6b7280]">
          Add either of these to a ticket to pick the exact Environment or Data Profile to reproduce with, instead of the defaults above — the AI matches the value after the colon by name.
        </p>
        <div className="mt-5 overflow-hidden rounded-lg border border-[#e5e7eb]">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#f0f1f3] bg-[#fafafa] text-[12px] text-[#6b7280]">
                <th className="px-4 py-2.5 font-medium">Environment</th>
                <th className="px-4 py-2.5 font-medium">Data Profile</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-3 font-mono text-[12.5px] text-[#374151]">env:value<br />environment:value</td>
                <td className="px-4 py-3 font-mono text-[12.5px] text-[#374151]">dataprofile:value</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={cardCls}>
        <h3 className={h3Cls}>When to reproduce</h3>
        <p className="mt-2 max-w-4xl text-[13.5px] leading-5 text-[#6b7280]">
          Choose which tickets start a reproduction automatically, and which actions trigger one. Applies to Linear, Jira and ClickUp; for ClickUp tasks, trigger labels are task tags.
        </p>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {[
            { value: "label", title: "Only tickets with a trigger label", copy: "Recommended. Nothing runs unless a ticket carries one of the labels below." },
            { value: "every", title: "Every new ticket", copy: "Labels are ignored. Every new ticket is reproduced — set a daily cap below." },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={readOnly}
              onClick={() => set("triggerMode", option.value as BugReproductionSettings["triggerMode"])}
              className={cn(
                "rounded-lg border p-4 text-left transition",
                form.triggerMode === option.value ? "border-[#5b4ee8] bg-[#f7f5ff] ring-1 ring-[#dcd7ff]" : "border-[#e5e7eb] bg-white hover:border-[#c4bdfa]",
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn("flex size-4 items-center justify-center rounded-full border", form.triggerMode === option.value ? "border-[#5b4ee8]" : "border-[#d1d5db]")}>
                  {form.triggerMode === option.value && <span className="size-2 rounded-full bg-[#5b4ee8]" />}
                </span>
                <span className={cn("text-[14px] font-medium", form.triggerMode === option.value ? "text-[#4f46e5]" : "text-[#374151]")}>{option.title}</span>
              </span>
              <span className="mt-2 block text-[12.5px] leading-5 text-[#6b7280]">{option.copy}</span>
            </button>
          ))}
        </div>

        <div className="mt-5">
          <span className={labelCls}>Trigger labels</span>
          <div className="flex min-h-[41px] flex-wrap items-center gap-2 rounded-md border border-[#d1d5db] bg-white px-2 py-1.5">
            {labels.map((label) => (
              <span key={label} className="inline-flex items-center gap-1 rounded bg-[#f3f4f6] px-2 py-1 text-[12.5px] text-[#374151]">
                {label}
                <button
                  type="button"
                  aria-label={`Remove ${label}`}
                  disabled={readOnly}
                  onClick={() => { const next = labels.filter((l) => l !== label); setLabels(next); set("triggerLabels", next); }}
                  className="text-[#9ca3af] hover:text-[#dc2626]"
                >
                  <CqaIcon name="close" className="text-[13px]" />
                </button>
              </span>
            ))}
            <input
              value={labelDraft}
              disabled={readOnly}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLabel(); } }}
              placeholder="Select Linear labels or ClickUp tags"
              className="h-7 min-w-[220px] flex-1 border-0 px-1 text-[13px] outline-none placeholder:text-[#9ca3af]"
            />
          </div>
          <span className={helpCls}>Only tickets with one of these labels are reproduced. ClickUp tasks match them as tags.</span>
          {!linearConnected && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-[#6b7280]">
              <CqaIcon name="info" className="text-[15px]" />
              Connect Linear to choose from your workspace&apos;s labels. You can still type a label name.
              <a href="/dashboard/integrations" className="font-medium text-[#5b4ee8] hover:underline">Try again</a>
            </p>
          )}
        </div>

        <div className="mt-6 border-t border-[#f0f1f3] pt-4">
          <span className="text-[14px] font-medium text-[#374151]">Trigger on</span>
          <div className="mt-1 grid gap-x-8 lg:grid-cols-2">
            <CheckRow label="A new ticket is created" copy="Reproduce as soon as a matching ticket appears." checked={form.triggerOnCreated} onChange={(v) => set("triggerOnCreated", v)} />
            <CheckRow label="A trigger label is added" copy="Reproduce when someone labels an existing ticket." checked={form.triggerOnLabeled} onChange={(v) => set("triggerOnLabeled", v)} />
            <CheckRow label="The title or description is edited" copy="Re-runs when the reporter supplies more detail. Each re-run is a full reproduction." checked={form.triggerOnEdited} onChange={(v) => set("triggerOnEdited", v)} />
            <CheckRow label="Someone comments /reproduce" copy="Always available to a person asking explicitly, label or not." checked={form.triggerOnComment} onChange={(v) => set("triggerOnComment", v)} />
          </div>
        </div>

        <div className="mt-5 border-t border-[#f0f1f3] pt-5">
          <span className="text-[14px] font-medium text-[#374151]">Limits</span>
          <div className="mt-3 grid gap-5 lg:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Max reproductions per ticket</span>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={form.maxPerTicket ?? ""}
                placeholder="No limit"
                onChange={(e) => set("maxPerTicket", e.target.value === "" ? null : Number(e.target.value))}
                disabled={readOnly}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Max reproductions per day</span>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={form.maxPerDay ?? ""}
                placeholder="No limit"
                onChange={(e) => set("maxPerDay", e.target.value === "" ? null : Number(e.target.value))}
                disabled={readOnly}
              />
            </label>
          </div>
          <span className={helpCls}>Leave blank for no limit. Each reproduction runs a full browser session, so a broad trigger on a busy project adds up quickly.</span>
        </div>
      </section>

      <section className={cardCls}>
        <h3 className={h3Cls}>Re-validate fixes</h3>
        <p className="mt-2 max-w-4xl text-[13.5px] leading-5 text-[#6b7280]">
          When a reproduced ticket moves to one of these statuses, re-run its saved test and comment <strong className="font-medium text-[#374151]">Fixed</strong>, <strong className="font-medium text-[#374151]">Not fixed</strong> or <strong className="font-medium text-[#374151]">Could not verify</strong>. Each re-validation is charged as a test run.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <Switch checked={form.revalidate} onChange={(v) => set("revalidate", v)} label="Re-validate automatically" />
          <span className="text-[13px] text-[#6b7280]">Only tickets QASyn reproduced earlier are re-run.</span>
        </div>
      </section>

      {error && <p className="mt-4 text-[12.5px] text-red-600">{error}</p>}
      <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#e5e7eb] pt-5">
        {saved && <span className="text-[12.5px] font-medium text-[#00a63e]">Settings saved</span>}
        <button type="button" className={cn(cqaBtnPrimary, "h-10 px-5 text-[14px]")} onClick={save} disabled={readOnly || pending === "save"}>
          <CqaIcon name="save" className="text-[18px]" />
          {pending === "save" ? "Updating…" : "Update"}
        </button>
      </div>
    </div>
  );
}
