"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CqaIcon, Modal, cqaBtnGhost, cqaBtnPrimary, cqaBtnSecondary, cqaInput, cqaLabel, useAction } from "@/components/dashboard/ui";

export function PlanRowActions({ planId, planName, readOnly }: { planId: string; planName: string; readOnly: boolean }) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [name, setName] = useState(`${planName} schedule`);
  const [cron, setCron] = useState("0 9 * * *");
  const [timezone, setTimezone] = useState("UTC");

  async function runPlan() {
    await run("run", "/api/dashboard/test-plans/run", { json: { planId } });
    router.refresh();
  }

  async function clonePlan() {
    await run("clone", "/api/dashboard/collections/test-plans", { json: { name: `${planName} (Copy)`, description: "", schedule: "manual", module: "" } });
    router.refresh();
  }

  async function createSchedule(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("schedule", "/api/dashboard/schedules", { json: { testPlanId: planId, name, cronExpression: cron, timezone, enabled: true } });
    if (res) {
      setScheduleOpen(false);
      setError(null);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button type="button" disabled={readOnly} onClick={() => setScheduleOpen(true)} className={cqaBtnGhost}>
        <CqaIcon name="schedule" className="text-[16px]" /> Schedule
      </button>
      <Link href={`/dashboard/plans/test-plans/${planId}?tab=reports`} className={cqaBtnGhost}>
        <CqaIcon name="description" className="text-[16px]" /> Reports
      </Link>
      <button type="button" disabled={readOnly || pending === "clone"} onClick={clonePlan} className={cqaBtnGhost}>
        <CqaIcon name="content_copy" className="text-[16px]" /> Clone
      </button>
      <button type="button" disabled={readOnly || pending === "run"} onClick={runPlan} className={cqaBtnGhost}>
        <CqaIcon name="play_arrow" className="text-[16px]" /> {pending === "run" ? "Running…" : "Run"}
      </button>

      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Schedule test plan">
        <form onSubmit={createSchedule} className="space-y-4">
          <label className="block">
            <span className={cqaLabel}>Schedule name *</span>
            <input className={cqaInput} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block">
            <span className={cqaLabel}>Cron expression *</span>
            <input className={cqaInput} value={cron} onChange={(e) => setCron(e.target.value)} required placeholder="0 9 * * *" />
            <span className="mt-1 block text-[11.5px] text-[#6b7280]">Five fields: minute hour day-of-month month day-of-week.</span>
          </label>
          <label className="block">
            <span className={cqaLabel}>Time zone</span>
            <select className={cqaInput} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              <option>UTC</option>
              <option>America/New_York</option>
              <option>Europe/Paris</option>
              <option>Asia/Dubai</option>
            </select>
          </label>
          {error && <p className="text-[12px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-[#f0f1f3] pt-4">
            <button type="button" className={cqaBtnSecondary} onClick={() => setScheduleOpen(false)}>Cancel</button>
            <button type="submit" className={cqaBtnPrimary} disabled={pending === "schedule"}>{pending === "schedule" ? "Saving…" : "Create schedule"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
