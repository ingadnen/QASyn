"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CqaIcon, Modal, StatusPill, cqaBtnGhost, cqaBtnPrimary, cqaBtnSecondary, cqaCard, cqaIconBtn, useAction } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

export interface PlanExecutionRow {
  id: string;
  status: string;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string | null;
  total: number;
  passed: number;
  failed: number;
  notExecuted: number;
  autoFixed: number;
  durationMs: number;
  cases: Array<{ id: string; status: string }>;
  viewport?: string;
}
export interface PlanCaseRow {
  id: string;
  code: string;
  title: string;
  status: string;
  module: string;
  lastRunAt: string | null;
}
export interface PlanSuiteRow {
  id: string;
  code: string;
  name: string;
  casesCount: number;
  platform: string;
}
export interface PlanScheduleRow {
  id: string;
  name: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  nextFireAt: string | null;
}
export interface PlanSettingsData {
  parallelNodes: number;
  captureScreenshots: string;
  pageLoadTimeout: number;
  elementTimeout: number;
  knowledgeBaseId: string;
  environment: string;
  showScrollbars: boolean;
  clickPressHold: boolean;
  hideOnDashboard: boolean;
  sendNotification: boolean;
  notificationEmails: string[];
  proxyId: string;
  remoteBrowserId: string;
  recovery: {
    majorStepFailure: string;
    stepPrereqFailure: string;
    testCasePrereqFailure: string;
    testCaseAbort: string;
    suitePrereqFailure: string;
  };
}
export interface PlanDetailData {
  id: string;
  code: string;
  planId: string;
  name: string;
  description: string;
  environment: string;
  browsers: string[];
  passRate: number;
  lastRunAt: string | null;
  createdAt: string;
  settings: PlanSettingsData;
}

interface Props {
  plan: PlanDetailData;
  suites: PlanSuiteRow[];
  cases: PlanCaseRow[];
  executions: PlanExecutionRow[];
  schedules: PlanScheduleRow[];
  allSuites: Array<{ id: string; code: string; name: string; casesCount: number; platform: string }>;
  environments: Array<{ id: string; name: string }>;
  knowledge: Array<{ id: string; title: string }>;
  proxies: Array<{ id: string; name: string }>;
  remotes: Array<{ id: string; name: string }>;
  currentUserEmail: string;
  orgSlug: string;
  defaultTab: Tab;
  readOnly: boolean;
}

const TABS = ["overview", "runs", "reports", "schedules", "cicd", "settings", "execution-history", "history"] as const;
export type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  runs: "Runs",
  reports: "Reports",
  schedules: "Schedules",
  cicd: "CI / CD",
  settings: "Settings",
  "execution-history": "Execution History",
  history: "Version History",
};

const inputCls =
  "h-[41px] w-full rounded-md border border-[#d1d5db] bg-white px-3 text-[14px] text-[#0a0a0a] outline-none transition placeholder:text-[#9ca3af] focus:border-[#8b80ff] focus:ring-2 focus:ring-[#e4e1fd] disabled:bg-[#f9fafb] disabled:text-[#6b7280]";
const labelCls = "mb-2 block text-[14px] font-medium text-[#374151]";
const upperLabelCls = "mb-2 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6b7280]";

function fmtRunDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}
function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtFull(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function duration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const core = `${m}m ${String(s).padStart(2, "0")}s`;
  return h ? `${h}h ${core}` : core;
}
function runStatusLabel(status: string) {
  if (status === "PASSED") return "Passed";
  if (status === "FAILED") return "Failed";
  if (status === "RUNNING") return "Running";
  return "Not Executed";
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative h-[22px] w-[40px] shrink-0 rounded-full transition disabled:opacity-50", checked ? "bg-[#5b4ee8]" : "bg-[#d1d5db]")}
    >
      <span className={cn("absolute top-[3px] size-4 rounded-full bg-white shadow transition", checked ? "left-[21px]" : "left-[3px]")} />
    </button>
  );
}

const DEFAULT_RECOVERY = {
  majorStepFailure: "abort",
  stepPrereqFailure: "continue",
  testCasePrereqFailure: "abort_plan",
  testCaseAbort: "reuse_session",
  suitePrereqFailure: "stop",
};

export function TestPlanDetail({
  plan,
  suites,
  cases,
  executions,
  schedules,
  allSuites,
  environments,
  knowledge,
  proxies,
  remotes,
  currentUserEmail,
  orgSlug,
  defaultTab,
  readOnly,
}: Props) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [menuOpen, setMenuOpen] = useState(false);
  const [suiteOpen, setSuiteOpen] = useState(false);
  const [suiteIds, setSuiteIds] = useState<string[]>(suites.map((s) => s.id));
  const [suiteQuery, setSuiteQuery] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleName, setScheduleName] = useState(`${plan.name} schedule`);
  const [scheduleCron, setScheduleCron] = useState("0 9 * * 1");
  const [scheduleTz, setScheduleTz] = useState("UTC");
  const [runQuery, setRunQuery] = useState("");
  const [reportQuery, setReportQuery] = useState("");
  const [reportFilterOpen, setReportFilterOpen] = useState(false);
  const [reportStatus, setReportStatus] = useState<"all" | "passed" | "failed" | "not_executed">("all");
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [scheduleQuery, setScheduleQuery] = useState("");
  const [calendarMenuOpen, setCalendarMenuOpen] = useState(false);
  const [calendarView, setCalendarView] = useState<"month" | "week" | "day">("month");
  const [matrixMode, setMatrixMode] = useState<"matrix" | "summary">("matrix");
  const [matrixWindow, setMatrixWindow] = useState(10);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [settings, setSettings] = useState<PlanSettingsData>({ ...plan.settings, recovery: { ...DEFAULT_RECOVERY, ...plan.settings.recovery } });
  const [saved, setSaved] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [proxyOpen, setProxyOpen] = useState(false);

  const latest = executions[0] ?? null;
  const latestStatus = latest ? runStatusLabel(latest.status) : "Not Executed";
  const latestPassed = latest?.passed ?? cases.filter((c) => c.status === "passing").length;
  const latestFailed = latest?.failed ?? cases.filter((c) => c.status === "failing" || c.status === "flaky").length;
  const latestNotExecuted = latest?.notExecuted ?? 0;
  const latestTotal = latest?.total ?? cases.length;
  const latestPercent = latest && latest.total ? Math.round((latest.passed / latest.total) * 100) : 0;
  const runNumber = executions.length;

  const filteredRuns = executions.filter((e) => !runQuery.trim() || `#${executions.indexOf(e) + 1} ${runStatusLabel(e.status)}`.toLowerCase().includes(runQuery.trim().toLowerCase()));

  const filteredAllSuites = allSuites.filter((s) => !suiteQuery.trim() || `${s.code} ${s.name}`.toLowerCase().includes(suiteQuery.trim().toLowerCase()));

  const displayedRuns = executions.slice(0, matrixWindow);
  const matrixCases = useMemo(() => {
    const seen = new Set<string>();
    return cases.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [cases]);

  function setSetting<K extends keyof PlanSettingsData>(key: K, value: PlanSettingsData[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }
  function setRecovery(key: keyof PlanSettingsData["recovery"], value: string) {
    setSettings((prev) => ({ ...prev, recovery: { ...prev.recovery, [key]: value } }));
    setSaved(false);
  }

  async function runPlan() {
    const res = await run("run", "/api/dashboard/test-plans/run", { json: { planId: plan.id } });
    if (res) router.refresh();
  }

  async function clonePlan() {
    const res = await run<{ item: { id: string } }>("clone", "/api/dashboard/collections/test-plans", {
      json: { name: `${plan.name} (Copy)`, description: plan.description, schedule: "manual", module: "" },
    });
    if (res?.item) router.push(`/dashboard/plans/test-plans/${res.item.id}`);
  }

  async function saveSuites() {
    const res = await run("suites", `/api/dashboard/test-plans/${plan.id}`, { method: "PATCH", json: { suiteIds } });
    if (res) {
      setSuiteOpen(false);
      router.refresh();
    }
  }

  async function saveSettings() {
    const res = await run("save", `/api/dashboard/test-plans/${plan.id}`, { method: "PATCH", json: { environment: settings.environment, settings } });
    if (res) {
      setSaved(true);
      router.refresh();
    }
  }

  async function addSchedule(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("schedule", "/api/dashboard/schedules", {
      json: { testPlanId: plan.id, name: scheduleName.trim(), cronExpression: scheduleCron.trim(), timezone: scheduleTz, enabled: true },
    });
    if (res) {
      setScheduleOpen(false);
      router.refresh();
    }
  }

  async function deleteSchedule(id: string) {
    const res = await run("schedule", `/api/dashboard/schedules/${id}`, { method: "DELETE" });
    if (res) router.refresh();
  }

  function addEmail() {
    const email = emailDraft.trim();
    if (!email || !email.includes("@") || settings.notificationEmails.includes(email)) return;
    setSetting("notificationEmails", [...settings.notificationEmails, email]);
    setEmailDraft("");
  }

  function exportCsv() {
    const header = ["Test case", "Code", ...displayedRuns.map((e) => `#${executions.indexOf(e) + 1} ${fmtDay(e.startedAt)}`), "Pass rate"];
    const rows = matrixCases.map((c) => {
      const statuses = displayedRuns.map((e) => e.cases.find((x) => x.id === c.id)?.status ?? "not_executed");
      const passed = statuses.filter((s) => s === "passed").length;
      return [c.title, c.code, ...statuses, `${Math.round((passed / Math.max(statuses.length, 1)) * 100)}%`];
    });
    const csv = [header, ...rows].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan.name.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}-execution-history.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const monthLabel = calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const prevMonthDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 0).getDate();
  const scheduleDays = new Set(schedules.filter((s) => s.nextFireAt).map((s) => new Date(s.nextFireAt as string).getDate()));
  const calendarCells = Array.from({ length: 42 }, (_, i) => {
    const dayNumber = i - startOffset + 1;
    if (dayNumber < 1) return { day: prevMonthDays + dayNumber, muted: true, current: false };
    if (dayNumber > daysInMonth) return { day: dayNumber - daysInMonth, muted: true, current: false };
    return { day: dayNumber, muted: false, current: true };
  });

  const filteredSchedules = schedules.filter((s) =>
    !scheduleQuery.trim() || `${s.name} ${s.cronExpression} ${s.timezone}`.toLowerCase().includes(scheduleQuery.trim().toLowerCase()),
  );
  const filteredReportExecutions = executions.filter((e) => {
    if (reportStatus === "all") return true;
    return runStatusLabel(e.status).toLowerCase().replace(/\s+/g, "_") === reportStatus;
  });
  const compareRuns = selectedRuns
    .map((id) => executions.find((e) => e.id === id))
    .filter((e): e is PlanExecutionRow => Boolean(e));
  const now = new Date();
  const focusDate =
    now.getFullYear() === calendarMonth.getFullYear() && now.getMonth() === calendarMonth.getMonth()
      ? now
      : new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const weekAnchor = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const weekStart = new Date(weekAnchor);
  weekStart.setDate(weekAnchor.getDate() - weekAnchor.getDay());
  const weekCells = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return { day: date.getDate(), current: date.getMonth() === calendarMonth.getMonth(), muted: date.getMonth() !== calendarMonth.getMonth(), isToday: sameDay(date, now) };
  });
  const focusSchedules = schedules.filter((s) => s.nextFireAt && sameDay(new Date(s.nextFireAt), focusDate));

  function toggleCompareRun(id: string) {
    setSelectedRuns((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id].slice(-2)));
  }

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-7 text-[#101828]">{plan.name}</h1>
          <p className="mt-1 text-[12.5px] text-[#6b7280]">{plan.description || `${plan.browsers.join(", ")} · ${plan.environment}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void runPlan()} disabled={readOnly || pending === "run"} className={cn(cqaBtnPrimary, "h-9 px-4")}>
            <CqaIcon name="play_arrow" className="text-[17px]" /> {pending === "run" ? "Running…" : "Run Now"}
          </button>
          <div className="relative">
            <button type="button" aria-label="Plan actions" onClick={() => setMenuOpen((v) => !v)} className={cn(cqaIconBtn, "size-9 border border-[#e5e7eb] bg-white")}>
              <CqaIcon name="more_vert" className="text-[19px]" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
                <button type="button" onClick={() => { setTab("reports"); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb]"><CqaIcon name="description" className="text-[17px]" /> Reports</button>
                <button type="button" onClick={() => { setTab("schedules"); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb]"><CqaIcon name="schedule" className="text-[17px]" /> Schedules</button>
                <button type="button" onClick={() => { setTab("settings"); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb]"><CqaIcon name="settings" className="text-[17px]" /> Settings</button>
                <button type="button" onClick={() => { setMenuOpen(false); void clonePlan(); }} disabled={readOnly} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb] disabled:opacity-50"><CqaIcon name="content_copy" className="text-[17px]" /> Clone</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={cn(cqaCard, "mt-4 flex flex-wrap items-stretch divide-y divide-[#f0f1f3] md:divide-x md:divide-y-0")}>
        <div className="flex min-w-[92px] flex-col justify-center px-5 py-3">
          <p className="text-[20px] font-bold leading-6 text-[#111827]">{suites.length}</p>
          <p className="mt-0.5 text-[11.5px] text-[#6b7280]">Suites</p>
        </div>
        <div className="flex min-w-[104px] flex-col justify-center px-5 py-3">
          <p className="text-[20px] font-bold leading-6 text-[#111827]">{cases.length}</p>
          <p className="mt-0.5 text-[11.5px] text-[#6b7280]">Test cases</p>
        </div>
        <div className="flex min-w-[128px] flex-col justify-center px-5 py-3">
          <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#374151]"><CqaIcon name="schedule" className="text-[16px] text-[#6b7280]" /> {schedules.length ? schedules[0].name : "Never"}</p>
          <p className="mt-0.5 text-[11.5px] text-[#6b7280]">Latest run</p>
        </div>
        <div className="flex min-w-[144px] flex-col justify-center px-5 py-3">
          <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#374151]"><CqaIcon name="auto_fix_high" className="text-[16px] text-[#6b7280]" /> {latest ? `#${runNumber}` : "—"}</p>
          <p className="mt-0.5 text-[11.5px] text-[#6b7280]">Latest after auto-fix</p>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-[12.5px]">
          <span><strong className="text-[15px] font-bold text-[#111827]">{latestPassed}</strong> <span className="text-[#6b7280]">Passed</span></span>
          <span><strong className="text-[15px] font-bold text-[#111827]">{latestFailed}</strong> <span className="text-[#6b7280]">Failed</span></span>
          <span><strong className="text-[15px] font-bold text-[#111827]">{latestNotExecuted}</strong> <span className="text-[#6b7280]">Not Executed</span></span>
        </div>
        <div className="flex items-center px-5 py-3">
          <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium", latestStatus === "Passed" ? "border-[#b9f8cf] bg-[#f0fdf4] text-[#00a63e]" : latestStatus === "Failed" ? "border-[#fecaca] bg-[#fef2f2] text-[#dc2626]" : "border-[#e5e7eb] bg-[#f9fafb] text-[#6b7280]")}>
            <CqaIcon name={latestStatus === "Passed" ? "task_alt" : latestStatus === "Failed" ? "cancel" : "schedule"} className="text-[16px]" />
            {latestStatus}
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-5 overflow-x-auto border-b border-[#e5e7eb]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "whitespace-nowrap border-b-2 pb-2.5 pt-1 text-[13.5px] transition",
              tab === t ? "border-[#5b4ee8] font-medium text-[#5b4ee8]" : "border-transparent text-[#6b7280] hover:text-[#111827]",
            )}
          >
            {TAB_LABELS[t]}
            {t === "schedules" && <span className="ml-1.5 rounded bg-[#f3f4f6] px-1.5 py-[1px] text-[10.5px] font-medium text-[#6b7280]">{schedules.length}</span>}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-3 text-[12.5px] text-red-600">{error}</p>}

      {tab === "overview" && (
        <div className="mt-5 space-y-5">
          <div className={cn(cqaCard, "p-5")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-[#262626]">Plan summary</h2>
              <div className="flex items-center gap-3 text-[12px] text-[#6b7280]">
                <span>Plan ID: {plan.planId}</span>
                <button type="button" aria-label="Copy plan ID" onClick={() => void navigator.clipboard?.writeText(plan.planId)} className="text-[#9ca3af] hover:text-[#374151]"><CqaIcon name="content_copy" className="text-[15px]" /></button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "START", value: latest ? fmtFull(latest.startedAt) : "—", sub: "Latest run" },
                { label: "END", value: latest?.finishedAt ? fmtFull(latest.finishedAt) : "—", sub: "Latest run" },
                { label: "CI/CD TRIGGER", value: latest ? latest.triggeredBy.charAt(0).toUpperCase() + latest.triggeredBy.slice(1) : "—", sub: "Latest run" },
                { label: "VIEWPORT", value: latest?.viewport || (settings.captureScreenshots === "None" ? "1440×900" : settings.captureScreenshots), sub: latest ? "Latest run" : "Default" },
              ].map((box) => (
                <div key={box.label} className="rounded-lg border border-[#f0f1f3] bg-[#fcfcfd] px-4 py-3">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">{box.label}</p>
                  <p className="mt-1 text-[13px] font-medium text-[#374151]">{box.value}</p>
                  {box.sub && <p className="mt-0.5 text-[11px] text-[#9ca3af]">{box.sub}</p>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold text-[#262626]">Suites in plan <span className="font-normal text-[#6b7280]">({suites.length})</span></h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setSuiteIds(suites.map((s) => s.id)); setSuiteOpen(true); }} disabled={readOnly} className={cn(cqaBtnSecondary, "h-8 px-3 text-[12.5px]")}>
                  <CqaIcon name="add" className="text-[16px]" /> Add Test Suite
                </button>
              </div>
            </div>
            <div className={cn(cqaCard, "overflow-hidden")}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#f0f1f3] bg-white">
                      {["#", "SUITE", "CASES", "BROWSER/DEVICE", "ACTIONS"].map((h) => (
                        <th key={h} className="whitespace-nowrap px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#6b7280]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-[13px] text-[#374151]">
                    {suites.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-[13px] text-[#9ca3af]">No suites in this plan yet.</td></tr>
                    )}
                    {suites.map((s, i) => (
                      <tr key={s.id} className="border-b border-[#f3f4f6] bg-white last:border-0 hover:bg-[#fafafa]">
                        <td className="px-4 py-3 tabular-nums text-[#6b7280]">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 text-[10.5px] font-medium text-[#9ca3af]">{s.code}</span>
                            <Link href={`/dashboard/plans/suites/${s.id}`} className="font-medium text-[#1f2937] hover:text-[#5b4ee8]">{s.name}</Link>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#4a5565]">{s.casesCount} cases</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#9ca3af]">—</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center gap-3">
                            <CqaIcon name="schedule" className="text-[17px] text-[#9ca3af]" />
                            <Link href={`/dashboard/plans/suites/${s.id}`} className="font-medium text-[#5b4ee8] hover:underline">View Test Cases</Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[#f0f1f3] px-4 py-2.5 text-[12px] text-[#6b7280]">
                <span>Rows per page</span>
                <span className="tabular-nums">1–{suites.length} of {suites.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "runs" && (
        <div className="mt-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
              <input type="search" value={runQuery} onChange={(e) => setRunQuery(e.target.value)} placeholder="Search" aria-label="Search runs" className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]" />
            </div>
            <button type="button" onClick={() => router.refresh()} aria-label="Refresh" className={cn(cqaIconBtn, "size-9 border border-[#e5e7eb] bg-white")}><CqaIcon name="refresh" className="text-[18px]" /></button>
          </div>
          <h2 className="mb-3 text-[14px] font-semibold text-[#262626]">Recent runs</h2>
          <div className="space-y-2">
            {filteredRuns.length === 0 && (
              <div className={cn(cqaCard, "px-5 py-12 text-center")}>
                <p className="text-[14px] font-medium text-[#374151]">No runs yet</p>
                <p className="mt-1 text-[12.5px] text-[#9ca3af]">Click Run Now to execute this plan.</p>
              </div>
            )}
            {filteredRuns.map((e) => {
              const index = executions.indexOf(e) + 1;
              const percent = e.total ? Math.round((e.passed / e.total) * 100) : 0;
              return (
                <button key={e.id} type="button" onClick={() => setTab("reports")} className={cn(cqaCard, "flex w-full flex-wrap items-center gap-4 px-4 py-3 text-left transition hover:border-[#c4bdfa]")}>
                  <span className="w-10 text-[14px] font-semibold text-[#111827]">#{index}</span>
                  <span className="w-24 text-[12.5px] text-[#6b7280]">{fmtDay(e.startedAt)}</span>
                  <span className="w-20 text-[12.5px] tabular-nums text-[#4a5565]">{duration(e.durationMs)}</span>
                  <StatusPill value={runStatusLabel(e.status)} />
                  <span className="ml-auto text-[13px] font-semibold text-[#111827]">{percent}%</span>
                  <CqaIcon name="chevron_right" className="text-[18px] text-[#9ca3af]" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === "reports" && (
        <div className="mt-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-[15px] font-semibold text-[#262626]">Run History</h2>
            <div className="relative min-w-[200px]">
              <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[17px] text-[#9ca3af]" />
              <input type="search" value={reportQuery} onChange={(e) => setReportQuery(e.target.value)} placeholder="Search" aria-label="Search run history" className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-[13px] outline-none" />
            </div>
            <button type="button" aria-label="Refresh" onClick={() => router.refresh()} className={cn(cqaIconBtn, "size-9 border border-[#e5e7eb] bg-white")}><CqaIcon name="refresh" className="text-[18px]" /></button>
            <div className="relative">
              <button
                type="button"
                aria-label="Filter runs"
                aria-expanded={reportFilterOpen}
                onClick={() => setReportFilterOpen((value) => !value)}
                className={cn(
                  cqaIconBtn,
                  "size-9 border bg-white",
                  reportStatus !== "all" ? "border-[#c4bdfa] text-[#5b4ee8]" : "border-[#e5e7eb]",
                )}
              >
                <CqaIcon name="filter_list" className="text-[18px]" />
              </button>
              {reportFilterOpen && (
                <>
                  <button type="button" aria-label="Close filters" onClick={() => setReportFilterOpen(false)} className="fixed inset-0 z-20 cursor-default" />
                  <div className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
                    {([
                      ["all", "All runs"],
                      ["passed", "Passed"],
                      ["failed", "Failed"],
                      ["not_executed", "Not Executed"],
                    ] as Array<[typeof reportStatus, string]>).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setReportStatus(value);
                          setReportFilterOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] hover:bg-[#f9fafb]",
                          reportStatus === value ? "font-medium text-[#5b4ee8]" : "text-[#374151]",
                        )}
                      >
                        {label}
                        {reportStatus === value && <CqaIcon name="check" className="text-[16px]" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={cn(cqaCard, "mb-4 flex flex-wrap items-center gap-3 px-4 py-2.5 text-[12.5px] text-[#6b7280]")}>
            <span>
              Select 2 runs to compare
              {selectedRuns.length > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#f5f3ff] px-2 py-0.5 text-[11.5px] font-medium text-[#5b4ee8]">
                  {selectedRuns.length} selected
                  <button type="button" aria-label="Clear run selection" onClick={() => setSelectedRuns([])} className="hover:text-[#111827]">
                    <CqaIcon name="close" className="text-[13px]" />
                  </button>
                </span>
              )}
            </span>
            <button
              type="button"
              disabled={selectedRuns.length !== 2}
              onClick={() => setCompareOpen(true)}
              className={cn(cqaBtnSecondary, "ml-auto h-8 px-3 text-[12.5px]")}
            >
              Compare
            </button>
          </div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-[#262626]">Test Case Results</h3>
            <button type="button" disabled={readOnly || pending === "run"} onClick={() => void runPlan()} className={cn(cqaBtnSecondary, "h-8 px-3 text-[12.5px]")}>
              <CqaIcon name="refresh" className="text-[15px]" /> Rerun
            </button>
          </div>

          {executions.length === 0 ? (
            <div className={cn(cqaCard, "px-5 py-12 text-center")}>
              <p className="text-[14px] font-medium text-[#374151]">No reports yet</p>
              <p className="mt-1 text-[12.5px] text-[#9ca3af]">Run this plan to produce a report.</p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
              <div className="space-y-4">
                {filteredReportExecutions.length === 0 && (
                  <div className={cn(cqaCard, "px-5 py-10 text-center")}>
                    <p className="text-[13.5px] font-medium text-[#374151]">No runs match this filter</p>
                    <p className="mt-1 text-[12px] text-[#9ca3af]">Choose “All runs” in the filter menu to see every execution.</p>
                  </div>
                )}
                {filteredReportExecutions.map((e) => {
                  const index = executions.indexOf(e) + 1;
                  const percent = e.total ? Math.round((e.passed / e.total) * 100) : 0;
                  const visibleCases = matrixCases.filter((c) => !reportQuery.trim() || `${c.code} ${c.title}`.toLowerCase().includes(reportQuery.trim().toLowerCase()));
                  return (
                    <div key={e.id} className="space-y-3">
                      <div className={cn(cqaCard, "p-4")}>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-md border border-[#e5e7eb] bg-[#f9fafb] px-2 py-1 text-[12px] font-semibold text-[#374151]">Run #{index}</span>
                          <StatusPill value={runStatusLabel(e.status)} label={runStatusLabel(e.status)} />
                          <label className="inline-flex items-center gap-1.5 text-[11.5px] text-[#6b7280]">
                            <input
                              type="checkbox"
                              aria-label={`Select run ${index} for comparison`}
                              checked={selectedRuns.includes(e.id)}
                              onChange={() => toggleCompareRun(e.id)}
                              className="size-3.5 accent-[#5b4ee8]"
                            />
                            Compare
                          </label>
                          <span className="text-[12.5px] text-[#6b7280]">Initial: {runStatusLabel(e.status)}</span>
                          <span className="ml-auto text-[12.5px] text-[#4a5565]">Latest outcomes <strong className="text-[#111827]">{e.passed} of {e.total}</strong> passed</span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-[#6b7280]">
                          <span className="inline-flex items-center gap-1.5"><CqaIcon name="calendar_today" className="text-[15px]" /> {fmtDay(e.startedAt)}, {new Date(e.startedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                          <span className="inline-flex items-center gap-1.5"><CqaIcon name="hourglass_empty" className="text-[15px]" /> {duration(e.durationMs)}</span>
                          <span className="inline-flex items-center gap-1.5"><CqaIcon name="bolt" className="text-[15px]" /> {e.triggeredBy.charAt(0).toUpperCase() + e.triggeredBy.slice(1)}</span>
                          <span className="inline-flex items-center gap-1.5"><CqaIcon name="hub" className="text-[15px]" /> Distributed</span>
                          <span className="ml-auto text-[12px] font-semibold text-[#374151]">{percent}%</span>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <span className="w-28 text-[11.5px] text-[#6b7280]">Initial execution</span>
                          <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-[#f3f4f6]">
                            <span className="bg-[#00a63e]" style={{ width: `${(e.passed / Math.max(e.total, 1)) * 100}%` }} />
                            <span className="bg-[#dc2626]" style={{ width: `${(e.failed / Math.max(e.total, 1)) * 100}%` }} />
                          </div>
                          <span className="inline-flex items-center gap-2 text-[11.5px]"><span className="text-[#00a63e]">{e.passed}</span><span className="text-[#dc2626]">{e.failed}</span></span>
                          <CqaIcon name="chevron_right" className="text-[17px] text-[#9ca3af]" />
                        </div>
                        <div className="mt-3 rounded-lg border border-[#f0f1f3] bg-[#fcfcfd] px-3 py-2.5">
                          <p className="flex items-center gap-2 text-[12.5px] font-medium text-[#374151]"><CqaIcon name="auto_fix_high" className="text-[16px] text-[#5b4ee8]" /> Auto-fix <span className="font-normal text-[#6b7280]">{e.autoFixed} of {e.failed} recovered</span></p>
                          <p className="mt-1 text-[11.5px] leading-5 text-[#6b7280]">Auto-fix finished · Analysed {e.failed} failed cases · {e.autoFixed} recovered by auto-fix · the other {Math.max(e.failed - e.autoFixed, 0)} need a person or the application team.</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[12px]">
                        {[
                          ["All", e.total],
                          ["Passed", e.passed],
                          ["Failed", e.failed],
                          ["Not executed", e.notExecuted],
                        ].map(([label, value]) => (
                          <span key={String(label)} className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-[#4a5565]">{label} <strong className="text-[#111827]">{String(value)}</strong></span>
                        ))}
                      </div>

                      <div className={cn(cqaCard, "overflow-hidden")}>
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="border-b border-[#f0f1f3] bg-white">
                              {["Test Case", "Latest result", "Status"].map((h) => <th key={h} className="px-4 py-2.5 text-[11.5px] font-medium text-[#6b7280]">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody className="text-[12.5px] text-[#374151]">
                            {visibleCases.map((c) => {
                              const status = e.cases.find((x) => x.id === c.id)?.status ?? "not_executed";
                              return (
                                <tr key={c.id} className="border-b border-[#f3f4f6] last:border-0">
                                  <td className="px-4 py-2">
                                    <span className="mr-2 text-[10px] font-medium text-[#9ca3af]">{c.code}</span>
                                    <Link href={`/dashboard/test-studio/${c.id}`} className="hover:text-[#5b4ee8]">{c.title}</Link>
                                  </td>
                                  <td className="px-4 py-2">
                                    <span className={cn("inline-flex items-center gap-1.5", status === "passed" ? "text-[#00a63e]" : status === "failed" ? "text-[#dc2626]" : "text-[#9ca3af]")}>
                                      <CqaIcon name={status === "passed" ? "task_alt" : status === "failed" ? "highlight_off" : "error_outline"} className="text-[16px]" />
                                      {status === "passed" ? "Passed" : status === "failed" ? "Failed" : "Not executed"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-[#6b7280]">{c.module || "Unorganised"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>

              {latest && (
                <div className="space-y-4">
                  <div className={cn(cqaCard, "p-4")}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-[14px] font-semibold text-[#262626]">#{runNumber} Run Details</h3>
                      <button type="button" onClick={() => void navigator.clipboard?.writeText(`Run #${runNumber}`)} aria-label="Copy run details" className="text-[#9ca3af] hover:text-[#374151]"><CqaIcon name="content_copy" className="text-[16px]" /></button>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[12.5px]"><span className="text-[#6b7280]">Total</span><strong className="text-[#111827]">{latest.total}</strong></div>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Inner: Initial</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Outer: After auto-fix</p>
                    <table className="mt-2 w-full text-left text-[12px]">
                      <thead><tr className="border-b border-[#f0f1f3] text-[#6b7280]"><th className="py-1.5 font-medium">Status</th><th className="py-1.5 font-medium">Initial</th><th className="py-1.5 font-medium">After auto-fix</th></tr></thead>
                      <tbody>
                        <tr className="border-b border-[#f3f4f6]"><td className="py-1.5 text-[#4a5565]">Passed</td><td className="py-1.5">{latest.passed}</td><td className="py-1.5">{latest.passed}</td></tr>
                        <tr className="border-b border-[#f3f4f6]"><td className="py-1.5 text-[#4a5565]">Failed</td><td className="py-1.5">{latest.failed}</td><td className="py-1.5">{latest.failed}</td></tr>
                        <tr><td className="py-1.5 text-[#4a5565]">Not Executed</td><td className="py-1.5">{latest.notExecuted}</td><td className="py-1.5">{latest.notExecuted}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <div className={cn(cqaCard, "p-4")}>
                    <p className="text-[12px] text-[#6b7280]">Total Test Cases Count</p>
                    <p className="text-[20px] font-bold text-[#111827]">{latest.total}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-[#374151]"><CqaIcon name="auto_fix_high" className="text-[16px] text-[#5b4ee8]" /> Auto-fixed <strong className="ml-auto text-[#111827]">{latest.autoFixed}</strong></p>
                    <h3 className="mt-4 text-[13px] font-semibold text-[#262626]">Failure Analysis<span className="ml-1 font-normal text-[#6b7280]">Latest outcomes</span></h3>
                    <div className="mt-2 divide-y divide-[#f3f4f6] text-[12.5px]">
                      {[["Test Needs Update", Math.max(latest.failed - 4, 0)], ["Test Data Issue", 3], ["App Bug", 1]].map(([label, count]) => (
                        <div key={String(label)} className="flex items-center justify-between py-2"><span className="text-[#4a5565]">{label}</span><span className="inline-flex items-center gap-1 font-medium text-[#111827]">{String(count)}<CqaIcon name="chevron_right" className="text-[15px] text-[#9ca3af]" /></span></div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-[#6b7280]"><CqaIcon name="filter_list" className="text-[14px]" /> Click a category to filter its cases</div>
                  </div>

                  <div className={cn(cqaCard, "p-4 text-[12.5px]")}>
                    {[
                      ["Triggered By", latest.triggeredBy.charAt(0).toUpperCase() + latest.triggeredBy.slice(1)],
                      ["Start Time", fmtFull(latest.startedAt)],
                      ["End Time", latest.finishedAt ? fmtFull(latest.finishedAt) : "—"],
                      ["Total Plan Duration", duration(latest.durationMs)],
                      ["Actual TC Execution Time", duration(latest.durationMs)],
                      ["Build No", "-"],
                      ["Message", "Worked as expected"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-4 border-b border-[#f3f4f6] py-2 last:border-0">
                        <span className="text-[#6b7280]">{label}</span>
                        <span className="max-w-[160px] text-right text-[#374151]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "schedules" && (
        <div className="mt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold text-[#262626]">Schedules</h2>
              <p className="mt-1 text-[13px] text-[#6b7280]">Run this plan automatically — one-time, recurring, or when a Jira sprint closes</p>
            </div>
            <button type="button" onClick={() => setScheduleOpen(true)} disabled={readOnly} className={cn(cqaBtnPrimary, "h-9 px-3.5")}><CqaIcon name="add" className="text-[17px]" /> New Schedule</button>
          </div>

          <div className={cn(cqaCard, "mt-4 overflow-hidden")}>
            <div className="flex flex-wrap items-center gap-2 border-b border-[#f0f1f3] px-4 py-2.5">
              <span className="text-[13px] font-medium text-[#374151]">Schedules <span className="rounded bg-[#f3f4f6] px-1.5 py-[1px] text-[11px] text-[#6b7280]">{filteredSchedules.length}</span></span>
              <div className="relative ml-auto min-w-[180px]">
                <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[17px] text-[#9ca3af]" />
                <input
                  aria-label="Search schedules"
                  placeholder="Search"
                  value={scheduleQuery}
                  onChange={(event) => setScheduleQuery(event.target.value)}
                  className="h-8 w-full rounded-lg border border-[#e5e7eb] pl-8 pr-3 text-[12.5px] outline-none focus:border-[#a9a1f7]"
                />
              </div>
              <button type="button" aria-label="Add schedule" onClick={() => setScheduleOpen(true)} className={cn(cqaIconBtn, "size-8 border border-[#e5e7eb] bg-white")}><CqaIcon name="add" className="text-[17px]" /></button>
            </div>
            {filteredSchedules.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[13.5px] font-medium text-[#374151]">
                  {schedules.length === 0 ? "No schedules yet. Click Add Schedule to set one up." : "No schedules match your search."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#f0f1f3]">
                {filteredSchedules.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <CqaIcon name="schedule" className="text-[18px] text-[#5b4ee8]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[#1f2937]">{s.name}</p>
                      <p className="mt-0.5 text-[11.5px] text-[#6b7280]">{s.cronExpression} · {s.timezone} · next {s.nextFireAt ? fmtFull(s.nextFireAt) : "—"}</p>
                    </div>
                    <StatusPill value={s.enabled ? "active" : "off"} label={s.enabled ? "Enabled" : "Disabled"} />
                    <button type="button" aria-label={`Delete ${s.name}`} disabled={readOnly} onClick={() => void deleteSchedule(s.id)} className={cqaIconBtn}><CqaIcon name="delete" className="text-[17px]" /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-[#f0f1f3] px-4 py-2.5 text-[12px] text-[#6b7280]">Rows per page <span className="ml-1">10</span></div>
          </div>

          <div className={cn(cqaCard, "mt-4 overflow-hidden")}>
            <div className="flex flex-wrap items-center gap-3 border-b border-[#f0f1f3] px-4 py-2.5">
              <div className="relative">
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded hover:bg-[#f3f4f6]"
                  aria-label="Calendar menu"
                  aria-expanded={calendarMenuOpen}
                  onClick={() => setCalendarMenuOpen((value) => !value)}
                >
                  <CqaIcon name="menu_open" className="text-[18px] text-[#6b7280]" />
                </button>
                {calendarMenuOpen && (
                  <>
                    <button type="button" aria-label="Close calendar menu" onClick={() => setCalendarMenuOpen(false)} className="fixed inset-0 z-20 cursor-default" />
                    <div className="absolute left-0 z-30 mt-1 w-52 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
                      <button type="button" onClick={() => { setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setCalendarView("month"); setCalendarMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb]"><CqaIcon name="today" className="text-[16px]" /> Today</button>
                      <button type="button" onClick={() => { setCalendarView("week"); setCalendarMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb]"><CqaIcon name="date_range" className="text-[16px]" /> Go to this week</button>
                      <button type="button" onClick={() => { setCalendarView("day"); setCalendarMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb]"><CqaIcon name="event" className="text-[16px]" /> Go to today</button>
                      <button
                        type="button"
                        disabled={!schedules.some((s) => s.nextFireAt)}
                        onClick={() => {
                          const next = schedules.find((s) => s.nextFireAt);
                          if (next?.nextFireAt) {
                            const date = new Date(next.nextFireAt);
                            setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                          }
                          setCalendarMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb] disabled:opacity-50"
                      >
                        <CqaIcon name="schedule" className="text-[16px]" /> Next scheduled run
                      </button>
                    </div>
                  </>
                )}
              </div>
              <span className="text-[13px] font-medium text-[#374151]">
                {calendarView === "month" ? "This Month" : calendarView === "week" ? "This Week" : "This Day"}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button type="button" aria-label="Previous month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className={cn(cqaIconBtn, "size-8")}><CqaIcon name="chevron_left" className="text-[18px]" /></button>
                <button type="button" aria-label="Next month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className={cn(cqaIconBtn, "size-8")}><CqaIcon name="chevron_right" className="text-[18px]" /></button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#374151]"><CqaIcon name="event" className="text-[16px] text-[#5b4ee8]" /> {monthLabel}</span>
              <span className="ml-auto flex items-center gap-1">
                {([["calendar_view_month", "Month", "month"], ["calendar_view_week", "Week", "week"], ["calendar_view_day", "Day", "day"]] as const).map(([icon, label, value]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={calendarView === value}
                    onClick={() => setCalendarView(value)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1 rounded border px-2 text-[11.5px]",
                      calendarView === value ? "border-[#c4bdfa] bg-[#f5f3ff] font-medium text-[#5b4ee8]" : "border-[#e5e7eb] bg-white text-[#4a5565] hover:bg-[#f9fafb]",
                    )}
                  >
                    <CqaIcon name={icon} className="text-[15px]" /> {label}
                  </button>
                ))}
              </span>
            </div>
            {calendarView === "day" ? (
              <div className="border-t border-[#f0f1f3] px-5 py-5">
                <p className="text-[13px] font-medium text-[#1f2937]">
                  {focusDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
                {focusSchedules.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-[#9ca3af]">No schedules fire on this day.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {focusSchedules.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[#f0f1f3] bg-[#fcfcfd] px-3 py-2 text-[12.5px]">
                        <CqaIcon name="schedule" className="text-[16px] text-[#5b4ee8]" />
                        <span className="font-medium text-[#1f2937]">{s.name}</span>
                        <span className="text-[#6b7280]">{s.nextFireAt ? new Date(s.nextFireAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}</span>
                        <StatusPill value={s.enabled ? "active" : "off"} label={s.enabled ? "Enabled" : "Disabled"} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 border-t border-[#f0f1f3] text-center text-[10.5px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  {["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"].map((d) => <div key={d} className="border-r border-[#f0f1f3] px-2 py-2 last:border-r-0">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 border-t border-[#f0f1f3]">
                  {(calendarView === "week" ? weekCells : calendarCells).map((cell, i) => {
                    const todayCell =
                      "isToday" in cell
                        ? cell.isToday
                        : cell.current &&
                          calendarMonth.getFullYear() === now.getFullYear() &&
                          calendarMonth.getMonth() === now.getMonth() &&
                          cell.day === now.getDate();
                    return (
                      <div key={i} className={cn("min-h-[76px] border-b border-r border-[#f0f1f3] px-2 py-1.5 text-[12px] last:border-r-0", cell.muted ? "bg-[#fcfcfd] text-[#d1d5db]" : "bg-white text-[#374151]")}>
                        <span className={cn(todayCell ? "flex size-6 items-center justify-center rounded-full bg-[#5b4ee8] text-white" : "")}>{cell.day}</span>
                        {cell.current && scheduleDays.has(cell.day) && <span className="mt-1 block rounded bg-[#f5f3ff] px-1 py-0.5 text-[10px] text-[#5b4ee8]">Schedule</span>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "cicd" && (
        <div className="mt-5 max-w-4xl space-y-5">
          <div className={cn(cqaCard, "p-5")}>
            <h2 className="text-[17px] font-semibold text-[#262626]">Trigger this plan from your pipeline</h2>
            <p className="mt-2 text-[13.5px] leading-5 text-[#6b7280]">Pipelines run this plan through the QASyn CI integration. Setup steps for every CI are in its repository.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#f0f1f3] bg-[#fcfcfd] px-4 py-3">
              <CqaIcon name="terminal" className="text-[18px] text-[#5b4ee8]" />
              <span className="font-mono text-[13px] text-[#111827]">indivatools/qasyn-ci</span>
              <span className="text-[12px] text-[#6b7280]">Setup for GitHub Actions, GitLab, Jenkins, Azure Pipelines, CircleCI, Bitbucket, or any CI through the CLI</span>
              <a href="https://github.com/indivatools/qasyn-ci" target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-medium text-[#5b4ee8] hover:underline">Open setup guide <CqaIcon name="open_in_new" className="text-[15px]" /></a>
            </div>
            <div className="mt-4 rounded-lg border border-[#f0f1f3] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">Test plan ID</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className="font-mono text-[14px] font-medium text-[#111827]">{plan.planId}</span>
                <button type="button" onClick={() => void navigator.clipboard?.writeText(plan.planId)} className="inline-flex items-center gap-1 rounded border border-[#e5e7eb] bg-white px-2 py-1 text-[11.5px] text-[#374151] hover:bg-[#f9fafb]"><CqaIcon name="content_copy" className="text-[14px]" /> Copy</button>
                <span className="text-[12px] text-[#6b7280]">Use as <code className="rounded bg-[#f3f4f6] px-1">plan-id</code> in your pipeline</span>
              </div>
            </div>
          </div>

          <div className={cn(cqaCard, "p-5")}>
            <div className="flex flex-wrap items-center gap-2">
              <CqaIcon name="admin_panel_settings" className="text-[19px] text-[#5b4ee8]" />
              <h3 className="text-[16px] font-semibold text-[#262626]">QASyn token</h3>
              <span className="ml-auto rounded border border-[#fde68a] bg-[#fffbeb] px-2 py-[2px] text-[10.5px] font-medium text-[#92400e]">Admin only</span>
            </div>
            <p className="mt-2 text-[13px] leading-5 text-[#6b7280]">Store it as the CI secret <code className="rounded bg-[#f3f4f6] px-1 py-0.5 text-[11.5px] text-[#374151]">QASYN_TOKEN</code>. It needs these permissions:</p>
            <ul className="mt-3 space-y-1.5 text-[12.5px] text-[#374151]">
              {["TEST_PLAN_EXECUTE", "TEST_PLAN_RESULTS_READ", "TEST_CASE_RESULTS_READ optional"].map((scope) => (
                <li key={scope} className="flex items-center gap-2"><CqaIcon name="check_circle" className="text-[16px] text-[#00a63e]" /> <span className="font-mono text-[11.5px]">{scope}</span></li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link href="/dashboard/settings/api-tokens/new" className={cqaBtnPrimary}><CqaIcon name="key" className="text-[17px]" /> Generate QASyn token</Link>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-[#6b7280]"><CqaIcon name="info" className="text-[15px]" /> Override the environment or mobile build with <code className="rounded bg-[#f3f4f6] px-1">environment</code>, <code className="rounded bg-[#f3f4f6] px-1">android-build</code> or <code className="rounded bg-[#f3f4f6] px-1">ios-build</code> in your pipeline.</span>
            </div>
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="mt-5 max-w-5xl space-y-5">
          <div className={cn(cqaCard, "p-5")}>
            <div className="flex items-center gap-2">
              <CqaIcon name="settings" className="text-[19px] text-[#5b4ee8]" />
              <h2 className="text-[16px] font-semibold text-[#262626]">Execution Settings</h2>
            </div>
            <div className="mt-5 grid gap-x-8 gap-y-5 lg:grid-cols-2">
              <div>
                <span className={upperLabelCls}>Parallel nodes</span>
                <div className="flex h-[41px] items-center gap-3 rounded-md border border-[#d1d5db] px-3">
                  <button type="button" aria-label="Decrease parallel nodes" disabled={readOnly || settings.parallelNodes <= 1} onClick={() => setSetting("parallelNodes", Math.max(1, settings.parallelNodes - 1))} className="text-[#6b7280] disabled:opacity-40"><CqaIcon name="remove" className="text-[18px]" /></button>
                  <span className="min-w-6 text-center text-[14px] font-medium text-[#111827]">{settings.parallelNodes}</span>
                  <button type="button" aria-label="Increase parallel nodes" disabled={readOnly || settings.parallelNodes >= 100} onClick={() => setSetting("parallelNodes", Math.min(100, settings.parallelNodes + 1))} className="text-[#6b7280] disabled:opacity-40"><CqaIcon name="add" className="text-[18px]" /></button>
                  <span className="ml-auto text-[12px] text-[#9ca3af]">of 100 max</span>
                </div>
              </div>
              <label className="block">
                <span className={upperLabelCls}>Capture screenshots</span>
                <select className={inputCls} value={settings.captureScreenshots} onChange={(e) => setSetting("captureScreenshots", e.target.value)} disabled={readOnly}>
                  {["None", "All steps", "On failure"].map((v) => <option key={v}>{v}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={upperLabelCls}>Page load timeout (s)</span>
                <input type="number" min={1} className={inputCls} value={settings.pageLoadTimeout} onChange={(e) => setSetting("pageLoadTimeout", Number(e.target.value))} disabled={readOnly} />
              </label>
              <label className="block">
                <span className={upperLabelCls}>Element timeout (s)</span>
                <input type="number" min={1} className={inputCls} value={settings.elementTimeout} onChange={(e) => setSetting("elementTimeout", Number(e.target.value))} disabled={readOnly} />
              </label>
              <label className="block">
                <span className={upperLabelCls}>Knowledge base</span>
                <select className={inputCls} value={settings.knowledgeBaseId} onChange={(e) => setSetting("knowledgeBaseId", e.target.value)} disabled={readOnly}>
                  <option value="">None</option>
                  {knowledge.map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={upperLabelCls}>Environment</span>
                <select className={inputCls} value={settings.environment} onChange={(e) => setSetting("environment", e.target.value)} disabled={readOnly}>
                  {environments.map((env) => <option key={env.id} value={env.name}>{env.name}</option>)}
                  {!environments.some((env) => env.name === settings.environment) && <option value={settings.environment}>{settings.environment}</option>}
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-x-10 lg:grid-cols-2">
              <div className="flex items-center justify-between border-t border-[#f0f1f3] py-3">
                <div>
                  <p className="text-[13.5px] text-[#374151]">Show scrollbars during test runs <CqaIcon name="info" className="ml-1 text-[14px] text-[#9ca3af]" /></p>
                  <p className="mt-0.5 text-[11.5px] text-[#6b7280]">Org Level (false)</p>
                </div>
                <Switch checked={settings.showScrollbars} onChange={(v) => setSetting("showScrollbars", v)} label="Show scrollbars during test runs" disabled={readOnly} />
              </div>
              <div className="flex items-center justify-between border-t border-[#f0f1f3] py-3">
                <div>
                  <p className="text-[13.5px] text-[#374151]">Enable Click Press Hold</p>
                  <p className="mt-0.5 text-[11.5px] text-[#6b7280]">Org Level (false)</p>
                </div>
                <Switch checked={settings.clickPressHold} onChange={(v) => setSetting("clickPressHold", v)} label="Enable Click Press Hold" disabled={readOnly} />
              </div>
            </div>
          </div>

          <div className={cn(cqaCard, "p-5")}>
            <button type="button" onClick={() => setProxyOpen((v) => !v)} className="flex w-full items-center gap-2 text-left">
              <CqaIcon name="tune" className="text-[19px] text-[#5b4ee8]" />
              <span>
                <span className="block text-[15px] font-semibold text-[#262626]">Proxy &amp; Remote Browser Settings</span>
                <span className="mt-0.5 block text-[12.5px] text-[#6b7280]">Route execution through a proxy or an external browser endpoint</span>
              </span>
              <CqaIcon name="expand_more" className={cn("ml-auto text-[20px] text-[#6b7280] transition", proxyOpen && "rotate-180")} />
            </button>
            {proxyOpen && (
              <div className="mt-4 grid gap-5 lg:grid-cols-2">
                <label className="block">
                  <span className={labelCls}>Proxy</span>
                  <select className={inputCls} value={settings.proxyId} onChange={(e) => setSetting("proxyId", e.target.value)} disabled={readOnly}>
                    <option value="">None</option>
                    {proxies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className={labelCls}>Remote browser</span>
                  <select className={inputCls} value={settings.remoteBrowserId} onChange={(e) => setSetting("remoteBrowserId", e.target.value)} disabled={readOnly}>
                    <option value="">None</option>
                    {remotes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </label>
              </div>
            )}
          </div>

          <div className={cn(cqaCard, "p-5")}>
            <div className="flex items-center gap-2">
              <CqaIcon name="notifications_none" className="text-[19px] text-[#5b4ee8]" />
              <h2 className="text-[16px] font-semibold text-[#262626]">Notifications</h2>
            </div>
            <div className="mt-3 divide-y divide-[#f0f1f3]">
              <div className="flex items-center justify-between py-3">
                <div><p className="text-[13.5px] text-[#374151]">Hide on Dashboard</p><p className="mt-0.5 text-[12px] text-[#6b7280]">This test plan will not be visible on the dashboard</p></div>
                <Switch checked={settings.hideOnDashboard} onChange={(v) => setSetting("hideOnDashboard", v)} label="Hide on Dashboard" disabled={readOnly} />
              </div>
              <div className="flex items-center justify-between py-3">
                <div><p className="text-[13.5px] text-[#374151]">Send Notification</p><p className="mt-0.5 text-[12px] text-[#6b7280]">Send email notifications when test plan runs</p></div>
                <Switch checked={settings.sendNotification} onChange={(v) => setSetting("sendNotification", v)} label="Send Notification" disabled={readOnly} />
              </div>
            </div>
            <div className="mt-3">
              <span className={upperLabelCls}>Notification emails</span>
              <div className="flex min-h-[41px] flex-wrap items-center gap-2 rounded-md border border-[#d1d5db] bg-white px-2 py-1.5">
                {settings.notificationEmails.map((email) => (
                  <span key={email} className="inline-flex items-center gap-1 rounded bg-[#f3f4f6] px-2 py-1 text-[12.5px] text-[#374151]">
                    {email}
                    <button type="button" aria-label={`Remove ${email}`} disabled={readOnly} onClick={() => setSetting("notificationEmails", settings.notificationEmails.filter((e) => e !== email))} className="text-[#9ca3af] hover:text-[#dc2626]"><CqaIcon name="close" className="text-[13px]" /></button>
                  </span>
                ))}
                <button type="button" aria-label="Add notification email" disabled={readOnly} onClick={() => setEmailDraft(emailDraft || "__focus__")} className="text-[#6b7280]"><CqaIcon name="add" className="text-[17px]" /></button>
                <input
                  value={emailDraft}
                  disabled={readOnly}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                  placeholder={settings.notificationEmails.length ? "" : currentUserEmail}
                  className="h-7 min-w-[180px] flex-1 border-0 px-1 text-[13px] outline-none placeholder:text-[#9ca3af]"
                />
              </div>
              <p className="mt-1.5 text-[11.5px] text-[#6b7280]">Press Enter or click + to add. Saved as a comma-separated list.</p>
            </div>
          </div>

          <div className={cn(cqaCard, "p-5")}>
            <div className="flex items-center gap-2">
              <CqaIcon name="warning_amber" className="text-[19px] text-[#d97706]" />
              <h2 className="text-[16px] font-semibold text-[#262626]">Recovery Actions</h2>
            </div>
            <div className="mt-4 divide-y divide-[#f0f1f3]">
              {([
                ["On Major Step Failure", "majorStepFailure", [["abort", "Abort and run next Test Case"], ["continue", "Report and continue next step"]]],
                ["On Step Pre-Req Failure", "stepPrereqFailure", [["abort", "Abort and run next Test Case"], ["continue", "Report and continue next step"]]],
                ["On Test Case Pre-Req Failure", "testCasePrereqFailure", [["abort_plan", "Abort Test Plan"], ["continue_case", "Report and continue next case"]]],
                ["On Test Case Abort", "testCaseAbort", [["reuse_session", "Delete cookies, reuse session"], ["new_session", "Start with new session"]]],
                ["On Suite Pre-Req Failure", "suitePrereqFailure", [["stop", "Stop Execution"], ["continue_suite", "Report and continue next suite"]]],
              ] as const).map(([label, key, options]) => (
                <div key={key} className="grid gap-2 py-3 md:grid-cols-[240px_1fr]">
                  <p className="text-[13px] font-medium text-[#374151]">{label}</p>
                  <div className="space-y-1.5">
                    {options.map(([value, copy]) => (
                      <label key={value} className="flex cursor-pointer items-center gap-2 text-[13px] text-[#4a5565]">
                        <input type="radio" name={key} className="size-4 accent-[#5b4ee8]" checked={settings.recovery[key] === value} onChange={() => setRecovery(key, value)} disabled={readOnly} />
                        {copy}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#e5e7eb] pt-5">
            {saved && <span className="mr-auto text-[12.5px] font-medium text-[#00a63e]">Settings saved</span>}
            <button type="button" className={cqaBtnSecondary} disabled={readOnly} onClick={() => { setSettings({ ...plan.settings, recovery: { ...DEFAULT_RECOVERY, ...plan.settings.recovery } }); setSaved(false); }}>Discard</button>
            <button type="button" className={cqaBtnPrimary} disabled={readOnly || pending === "save"} onClick={() => void saveSettings()}>{pending === "save" ? "Saving…" : "Save Changes"}</button>
          </div>
        </div>
      )}

      {tab === "execution-history" && (
        <div className="mt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-[18px] font-semibold text-[#262626]">Test plan execution history</h2>
            <div className="flex items-center gap-2">
              <select aria-label="History window" value={matrixWindow} onChange={(e) => setMatrixWindow(Number(e.target.value))} className="h-8 rounded-lg border border-[#e5e7eb] bg-white px-2 text-[12.5px]">
                <option value={10}>Last 10</option>
                <option value={30}>Last 30</option>
                <option value={50}>Last 50</option>
              </select>
              <button type="button" onClick={exportCsv} className={cn(cqaBtnSecondary, "h-8 px-3 text-[12.5px]")}><CqaIcon name="download" className="text-[16px]" /> Export CSV</button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-5 border-b border-[#e5e7eb]">
            <button type="button" onClick={() => setMatrixMode("matrix")} className={cn("border-b-2 pb-2.5 text-[13.5px]", matrixMode === "matrix" ? "border-[#5b4ee8] font-medium text-[#5b4ee8]" : "border-transparent text-[#6b7280]")}>Test case matrix</button>
            <button type="button" onClick={() => setMatrixMode("summary")} className={cn("border-b-2 pb-2.5 text-[13.5px]", matrixMode === "summary" ? "border-[#5b4ee8] font-medium text-[#5b4ee8]" : "border-transparent text-[#6b7280]")}>Plan summary</button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Passed", latest?.passed ?? 0, "text-[#00a63e]"],
              ["Failed", latest?.failed ?? 0, "text-[#dc2626]"],
              ["Aborted", 0, "text-[#d97706]"],
              ["Skipped", latest?.notExecuted ?? 0, "text-[#6b7280]"],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className={cn(cqaCard, "px-4 py-3")}>
                <p className="text-[11.5px] text-[#6b7280]">{String(label)}</p>
                <p className={cn("mt-1 text-[22px] font-bold", String(tone))}>{String(value)}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-[#4a5565]">
            <span>Total runs <strong className="text-[#111827]">{executions.length}</strong></span>
            <span>Pass rate <strong className="text-[#111827]">{latestPercent}%</strong></span>
            <span className="inline-flex items-center gap-1.5"><CqaIcon name="list_alt" className="text-[16px] text-[#6b7280]" /> {matrixCases.length} test cases</span>
            <span className="inline-flex items-center gap-1.5"><CqaIcon name="play_circle" className="text-[16px] text-[#6b7280]" /> {Math.min(executions.length, matrixWindow)} executions shown</span>
            <span className="inline-flex items-center gap-1.5"><CqaIcon name="calendar_today" className="text-[16px] text-[#6b7280]" /> {executions.length ? `${fmtDay(executions[executions.length - 1].startedAt)} → ${fmtDay(executions[0].startedAt)}` : "—"}</span>
            <span className="inline-flex items-center gap-1.5"><CqaIcon name="tag" className="text-[16px] text-[#6b7280]" /> Plan ID: {plan.planId}</span>
          </div>

          {matrixMode === "matrix" ? (
            <div className={cn(cqaCard, "mt-4 overflow-hidden")}>
              <div className="border-b border-[#f0f1f3] bg-[#fcfcfd] px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-[#6b7280]">Execution matrix — each column = one test plan run</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#f0f1f3] bg-white">
                      <th className="px-4 py-2.5 text-[11.5px] font-medium text-[#6b7280]">Test case</th>
                      {displayedRuns.map((e) => (
                        <th key={e.id} className="whitespace-nowrap px-4 py-2.5 text-center text-[11.5px] font-medium text-[#6b7280]">
                          #{executions.indexOf(e) + 1}<br /><span className="font-normal">{fmtDay(e.startedAt)}</span><br /><span className="font-normal">{new Date(e.startedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-[12.5px] text-[#374151]">
                    {matrixCases.map((c) => {
                      const statuses = displayedRuns.map((e) => e.cases.find((x) => x.id === c.id)?.status ?? "not_executed");
                      const passRate = statuses.length ? Math.round((statuses.filter((s) => s === "passed").length / statuses.length) * 100) : 0;
                      return (
                        <tr key={c.id} className="border-b border-[#f3f4f6] last:border-0">
                          <td className="max-w-[380px] px-4 py-2.5">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-[10px] font-medium text-[#9ca3af]">{c.code}</span>
                              <div>
                                <p className="line-clamp-2">{c.title}</p>
                                <p className="mt-0.5 text-[10.5px] text-[#9ca3af]">{passRate}% pass rate</p>
                              </div>
                            </div>
                          </td>
                          {statuses.map((status, i) => (
                            <td key={i} className="px-4 py-2.5 text-center">
                              <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-[2px] text-[10.5px] font-medium", status === "passed" ? "bg-[#f0fdf4] text-[#00a63e]" : status === "failed" ? "bg-[#fef2f2] text-[#dc2626]" : "bg-[#f9fafb] text-[#6b7280]")}>
                                <CqaIcon name={status === "passed" ? "task_alt" : status === "failed" ? "highlight_off" : "error_outline"} className="text-[13px]" />
                                {status === "passed" ? "Passed" : status === "failed" ? "Failed" : "Not Executed"}
                              </span>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className={cn(cqaCard, "mt-4 p-5")}>
              <h3 className="text-[14px] font-semibold text-[#262626]">Plan summary</h3>
              <table className="mt-3 w-full max-w-xl text-left text-[12.5px]">
                <thead><tr className="border-b border-[#f0f1f3] text-[#6b7280]"><th className="py-2 font-medium">Run</th><th className="py-2 font-medium">Date</th><th className="py-2 font-medium">Status</th><th className="py-2 text-right font-medium">Pass rate</th></tr></thead>
                <tbody>
                  {executions.map((e) => (
                    <tr key={e.id} className="border-b border-[#f3f4f6] last:border-0">
                      <td className="py-2">#{executions.indexOf(e) + 1}</td>
                      <td className="py-2 text-[#6b7280]">{fmtFull(e.startedAt)}</td>
                      <td className="py-2">{runStatusLabel(e.status)}</td>
                      <td className="py-2 text-right">{e.total ? Math.round((e.passed / e.total) * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="mt-5 max-w-3xl">
          <p className="mb-3 text-[12.5px] font-medium text-[#6b7280]">0 Versions</p>
          <div className={cn(cqaCard, "px-6 py-14 text-center")}>
            <CqaIcon name="history" className="text-[28px] text-[#d1d5db]" />
            <h3 className="mt-2 text-[15px] font-semibold text-[#374151]">No version history</h3>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-[#6b7280]">Version history will appear here once changes are made to this test plan.</p>
            <p className="mt-3 text-[12px] text-[#9ca3af]">Select a version to view details.</p>
          </div>
        </div>
      )}

      <Modal
        open={suiteOpen}
        onClose={() => setSuiteOpen(false)}
        title="Add Test Suites"
        footer={
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setSuiteOpen(false)}>Cancel</button>
            <button type="button" className={cqaBtnPrimary} onClick={() => void saveSuites()} disabled={readOnly || pending === "suites"}>{pending === "suites" ? "Saving…" : "Save"}</button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="relative">
            <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
            <input value={suiteQuery} onChange={(e) => setSuiteQuery(e.target.value)} placeholder="Search suites" className="h-9 w-full rounded-lg border border-[#e5e7eb] pl-9 pr-3 text-[13px] outline-none" />
          </div>
          <div className="max-h-[360px] divide-y divide-[#f0f1f3] overflow-y-auto rounded-lg border border-[#e5e7eb]">
            {filteredAllSuites.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 hover:bg-[#fafafa]">
                <input type="checkbox" className="mt-1 size-4 accent-[#5b4ee8]" checked={suiteIds.includes(s.id)} onChange={() => setSuiteIds((prev) => (prev.includes(s.id) ? prev.filter((v) => v !== s.id) : [...prev, s.id]))} />
                <span>
                  <span className="flex items-center gap-2 text-[13px] font-medium text-[#1f2937]"><span className="text-[10.5px] text-[#9ca3af]">{s.code}</span>{s.name}</span>
                  <span className="mt-0.5 block text-[11.5px] text-[#6b7280]">{s.casesCount} cases · {s.platform}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Compare runs"
        size="lg"
        footer={<button type="button" className={cqaBtnSecondary} onClick={() => setCompareOpen(false)}>Close</button>}
      >
        {compareRuns.length < 2 ? (
          <p className="text-[13px] text-[#4b5563]">Select exactly two runs from the Run History cards to compare them.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {compareRuns.map((run) => {
                const index = executions.indexOf(run) + 1;
                const percent = run.total ? Math.round((run.passed / run.total) * 100) : 0;
                return (
                  <div key={run.id} className="rounded-lg border border-[#e5e7eb] bg-[#fcfcfd] p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[#111827]">Run #{index}</span>
                      <StatusPill value={runStatusLabel(run.status)} label={runStatusLabel(run.status)} />
                    </div>
                    <p className="mt-1 text-[11.5px] text-[#6b7280]">{fmtFull(run.startedAt)} · {duration(run.durationMs)}</p>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-[#4a5565]">
                      <span>Passed <strong className="text-[#00a63e]">{run.passed}</strong></span>
                      <span>Failed <strong className="text-[#dc2626]">{run.failed}</strong></span>
                      <span>Not executed <strong className="text-[#6b7280]">{run.notExecuted}</strong></span>
                      <span>Pass rate <strong className="text-[#111827]">{percent}%</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="overflow-x-auto rounded-lg border border-[#e5e7eb]">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#f0f1f3] bg-white">
                    <th className="px-3 py-2 text-[11.5px] font-medium text-[#6b7280]">Test case</th>
                    {compareRuns.map((run) => (
                      <th key={run.id} className="px-3 py-2 text-center text-[11.5px] font-medium text-[#6b7280]">Run #{executions.indexOf(run) + 1}</th>
                    ))}
                    <th className="px-3 py-2 text-center text-[11.5px] font-medium text-[#6b7280]">Change</th>
                  </tr>
                </thead>
                <tbody className="text-[12px] text-[#374151]">
                  {matrixCases.map((c) => {
                    const statuses = compareRuns.map((run) => run.cases.find((x) => x.id === c.id)?.status ?? "not_executed");
                    const changed = statuses[0] !== statuses[1];
                    return (
                      <tr key={c.id} className="border-b border-[#f3f4f6] last:border-0">
                        <td className="max-w-[320px] px-3 py-2">
                          <span className="mr-1.5 text-[10px] font-medium text-[#9ca3af]">{c.code}</span>
                          {c.title}
                        </td>
                        {statuses.map((status, i) => (
                          <td key={i} className="px-3 py-2 text-center">
                            <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-[2px] text-[10.5px] font-medium", status === "passed" ? "bg-[#f0fdf4] text-[#00a63e]" : status === "failed" ? "bg-[#fef2f2] text-[#dc2626]" : "bg-[#f9fafb] text-[#6b7280]")}>
                              <CqaIcon name={status === "passed" ? "task_alt" : status === "failed" ? "highlight_off" : "error_outline"} className="text-[13px]" />
                              {status === "passed" ? "Passed" : status === "failed" ? "Failed" : "Not Executed"}
                            </span>
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center text-[11px] text-[#6b7280]">{changed ? "Changed" : "Same"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="New Schedule">
        <form onSubmit={addSchedule} className="space-y-4">
          <label className="block">
            <span className={labelCls}>Schedule name <span className="text-[#ef4444]">*</span></span>
            <input className={inputCls} value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} required />
          </label>
          <label className="block">
            <span className={labelCls}>Cron expression <span className="text-[#ef4444]">*</span></span>
            <input className={inputCls} value={scheduleCron} onChange={(e) => setScheduleCron(e.target.value)} required placeholder="0 9 * * 1" />
            <span className="mt-1 block text-[11.5px] text-[#6b7280]">Five fields: minute hour day-of-month month day-of-week.</span>
          </label>
          <label className="block">
            <span className={labelCls}>Time zone</span>
            <select className={inputCls} value={scheduleTz} onChange={(e) => setScheduleTz(e.target.value)}>
              {["UTC", "America/New_York", "America/Chicago", "Europe/Paris", "Asia/Dubai", "Asia/Tokyo"].map((tz) => <option key={tz}>{tz}</option>)}
            </select>
          </label>
          <div className="flex justify-end gap-2 border-t border-[#f0f1f3] pt-4">
            <button type="button" className={cqaBtnSecondary} onClick={() => setScheduleOpen(false)}>Cancel</button>
            <button type="submit" className={cqaBtnPrimary} disabled={pending === "schedule" || !scheduleName.trim() || !scheduleCron.trim()}>{pending === "schedule" ? "Saving…" : "Create schedule"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
