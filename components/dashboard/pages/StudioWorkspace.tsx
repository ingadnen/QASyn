"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import {
  CqaIcon,
  Modal,
  cqaBtnPrimary,
  cqaBtnSecondary,
  cqaCard,
  cqaIconBtn,
  useAction,
} from "@/components/dashboard/ui";
import { STUDIO_STEP_TEMPLATES } from "@/lib/studio-templates";
import { cn } from "@/lib/utils";

export interface StudioStep {
  id: string;
  action: "Navigate" | "Click" | "Enter Text" | "Verify Element" | "API Call" | "AI Assertion" | "OCR/Document Validation" | "KYC Check" | "Salesforce Workflow Steps";
  target: string;
  value: string;
  selector: string;
}

export interface StudioVersion {
  id: string;
  version: number;
  summary: string;
  author: string;
  added: string[];
  removed: string[];
  steps: StudioStep[];
  createdAt: string;
  current: boolean;
}

export interface StudioData {
  id: string;
  title: string;
  description: string;
  module: string;
  criticality: string;
  status: string;
  rawStatus: string;
  environment: string;
  version: string;
  platform: string;
  labels: string[];
  createdAt: string;
  steps: StudioStep[];
  variables: Record<string, string>;
  caseOptions: Array<{ id: string; title: string; module: string }>;
  prerequisites: Array<{ id: string; title: string; module: string }>;
  plans: Array<{ id: string; name: string; status: string }>;
  suites: Array<{ id: string; name: string }>;
  prerequisiteOf: Array<{ id: string; title: string; module: string; status: string }>;
  runs: Array<{
    id: string;
    runNumber: number;
    status: string;
    trigger: string;
    mode: string;
    durationMs: number;
    failedStep: number | null;
    failedStepText: string | null;
    autoFix: boolean;
    createdBy: string;
    createdAt: string;
  }>;
  versions: StudioVersion[];
  settings: {
    environment: string;
    defaultBrowser: string;
    viewportName: string;
    viewportWidth: number;
    viewportHeight: number;
    proxyName: string;
    remoteName: string;
    knowledgeName: string;
    aiSmartness: string;
    defaultAiAction: string;
    useAiMetadata: boolean;
    autoApproveAutoHeal: boolean;
    clickPressHold: boolean;
    retryFailedSteps: number;
    testcaseTimeout: number;
    waitTimeoutLocators: number;
  };
}

interface RunLogLine {
  step: number;
  action: string;
  target: string;
  status: string;
  healed?: boolean;
  message: string;
}

type Tab = "steps" | "relationships" | "versions";
type Panel = "testcase" | "variables" | "usedin" | "runhistory";
type RunPhase = "preparing" | "done";

const ACTIONS: StudioStep["action"][] = [
  "Navigate",
  "Click",
  "Enter Text",
  "Verify Element",
  "API Call",
  "AI Assertion",
  "OCR/Document Validation",
  "KYC Check",
  "Salesforce Workflow Steps",
];

const inputCls =
  "h-[38px] w-full rounded-md border border-[#d1d5db] bg-white px-3 text-[13.5px] text-[#0a0a0a] outline-none transition placeholder:text-[#9ca3af] focus:border-[#8b80ff] focus:ring-2 focus:ring-[#e4e1fd] disabled:bg-[#f9fafb] disabled:text-[#6b7280]";
const labelCls = "mb-1.5 block text-[13px] font-medium text-[#374151]";

const PANELS: Array<{ id: Panel; label: string; icon: string }> = [
  { id: "testcase", label: "Test Case", icon: "folder" },
  { id: "variables", label: "Variables", icon: "data_object" },
  { id: "usedin", label: "Used in Test", icon: "play_circle" },
  { id: "runhistory", label: "Run History", icon: "history" },
];

function parseInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "S"
  );
}

function formatStepDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatFull(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatRunDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).replace(",", "") + " " + new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(2).padStart(5, "0")}`;
}

function sentenceForStep(step: StudioStep, variables: Record<string, string>, orgUrl: string) {
  const resolve = (text: string) =>
    text
      .replace(/\*?\|([\w.-]+)\|/g, (_, key: string) => variables[key] || (key === "url" ? orgUrl : "") || `|${key}|`)
      .replace(/\*\|/g, "");
  const raw = resolve((step.target || "").trim());
  if (raw && /^(navigate|go to|verify|click|double click|enter|type|press|wait|scroll|select|check|uncheck|store|delete|take|custom|fill|right click|mouseover|switch|open|close|clear|upload|download|ai|rest|drag|note|generate|set|login|restore|save|refresh|use|create|sign|extract|add|gets|solve)/i.test(raw)) {
    return raw;
  }
  switch (step.action) {
    case "Navigate":
      return `Navigate to ${raw || orgUrl || "the application"}`;
    case "Click":
      return `Click on ${raw || "the target element"}`;
    case "Enter Text":
      return `Enter "${resolve(step.value) || "test-data"}" in ${raw || "the input field"}`;
    case "Verify Element":
      return `Verify that ${raw || "the target"} is visible`;
    case "AI Assertion":
      return `Verify that ${raw || "the expected state is visible"}`;
    default:
      return raw || `${step.action} step`;
  }
}

function actionForTemplate(template: string): StudioStep["action"] {
  if (/^(visit|navigate)/i.test(template)) return "Navigate";
  if (/^(wait until|verify|check the checkbox|check the radio|store|switch|scroll|close|delete|press|clear|right click|mouseover|select|uncheck|click ok|click on cancel|open|upload|download|drag|note)/i.test(template)) return "Verify Element";
  if (/^(enter|fill|set |update parameter|generate|password|press .* in the)/i.test(template)) return "Enter Text";
  if (/^ai /i.test(template)) return "AI Assertion";
  return "Click";
}

function statusTone(status: string) {
  if (status === "Ready") return "border-[#b9f8cf] bg-[#f0fdf4] text-[#00a63e]";
  if (status === "In Review") return "border-[#fde68a] bg-[#fffbeb] text-[#d97706]";
  return "border-[#e5e7eb] bg-[#f9fafb] text-[#6b7280]";
}

function planTone(status: string) {
  if (status === "Passed") return "text-[#00a63e]";
  if (status === "Failure") return "text-[#dc2626]";
  return "text-[#9ca3af]";
}

function priorityLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ToggleRow({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div>
        <p className="text-[12.5px] text-[#374151]">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-[#6b7280]">{hint}</p>}
      </div>
      <span className="relative h-[20px] w-[36px] shrink-0 rounded-full bg-[#d1d5db]" aria-hidden="true">
        <span className="absolute left-[3px] top-[3px] size-[14px] rounded-full bg-white shadow" />
      </span>
    </div>
  );
}

function SectionTitle({ icon, title, open, onToggle }: { icon: string; title: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 py-3 text-left">
      <CqaIcon name={icon} className="text-[17px] text-[#5b4ee8]" />
      <span className="text-[12.5px] font-semibold text-[#374151]">{title}</span>
      <CqaIcon name="expand_more" className={cn("ml-auto text-[17px] text-[#9ca3af] transition", open && "rotate-180")} />
    </button>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-[#f3f4f6] py-2 first:border-t-0">
      <span className="text-[12px] text-[#6b7280]">{label}</span>
      <span className="max-w-[160px] text-right text-[12px] font-medium text-[#374151]">{value}</span>
    </div>
  );
}

export function StudioWorkspace({
  data,
  readOnly,
  orgUrl,
  currentUser,
}: {
  data: StudioData;
  readOnly: boolean;
  orgUrl: string;
  currentUser: string;
}) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [tab, setTab] = useState<Tab>("steps");
  const [panel, setPanel] = useState<Panel>("testcase");
  const [steps, setSteps] = useState<StudioStep[]>(data.steps);
  const [priority, setPriority] = useState(data.criticality);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [reorder, setReorder] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [templateQuery, setTemplateQuery] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [prereqOpen, setPrereqOpen] = useState(false);
  const [selectedPrereqs, setSelectedPrereqs] = useState<string[]>(data.prerequisites.map((p) => p.id));
  const [prereqQuery, setPrereqQuery] = useState("");
  const [runOpen, setRunOpen] = useState(false);
  const [runPhase, setRunPhase] = useState<RunPhase>("preparing");
  const [runLog, setRunLog] = useState<RunLogLine[]>([]);
  const [runAutoFix, setRunAutoFix] = useState(false);
  const [usedQuery, setUsedQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    execution: true,
    ai: true,
    waits: true,
    device: true,
    flags: true,
  });
  const [variables, setVariables] = useState<Array<{ key: string; value: string }>>(() =>
    Object.entries(data.variables).map(([key, value]) => ({ key, value })),
  );
  const [editName, setEditName] = useState(data.title);
  const [editDescription, setEditDescription] = useState(data.description);
  const [editModule, setEditModule] = useState(data.module);
  const [editStatus, setEditStatus] = useState(data.rawStatus);
  const [editPriority, setEditPriority] = useState(data.criticality);
  const [editEnvironment, setEditEnvironment] = useState(data.environment);
  const [editVersion, setEditVersion] = useState(data.version);
  const [editPlatform, setEditPlatform] = useState<"web" | "mobile" | "api">(
    data.platform === "mobile" || data.platform === "api" ? data.platform : "web",
  );
  const [editLabels, setEditLabels] = useState<string[]>(data.labels);
  const [labelDraft, setLabelDraft] = useState("");

  const visibleSteps = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return steps.map((step, index) => ({ step, index }));
    return steps
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => `${step.action} ${step.target} ${step.value}`.toLowerCase().includes(needle));
  }, [steps, query]);

  const filteredTemplates = useMemo(() => {
    const needle = templateQuery.trim().toLowerCase();
    if (!needle) return STUDIO_STEP_TEMPLATES;
    return STUDIO_STEP_TEMPLATES.filter((template) => template.toLowerCase().includes(needle));
  }, [templateQuery]);

  const filteredPrereqs = useMemo(() => {
    const needle = prereqQuery.trim().toLowerCase();
    if (!needle) return data.caseOptions;
    return data.caseOptions.filter((c) => `${c.title} ${c.module}`.toLowerCase().includes(needle));
  }, [data.caseOptions, prereqQuery]);

  const usedVariables = useMemo(() => {
    const needle = usedQuery.trim().toLowerCase();
    return Object.entries(data.variables)
      .map(([key, value]) => {
        const index = steps.findIndex((step) => step.target.includes(`|${key}|`));
        return { key, value, step: index >= 0 ? index + 1 : 1 };
      })
      .filter((entry) => !needle || entry.key.toLowerCase().includes(needle));
  }, [data.variables, steps, usedQuery]);

  const detailStep = detailIndex !== null ? steps[detailIndex] : null;
  const selectedVersion = data.versions[0] ?? null;

  function toggleSection(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function persistSteps(next: StudioStep[], key = "save") {
    setSteps(next);
    return run(key, `/api/dashboard/test-cases/${data.id}`, { method: "PATCH", json: { action: "steps", steps: next } });
  }

  function addTemplate(template: string) {
    const action = actionForTemplate(template);
    const next: StudioStep[] = [
      ...steps,
      { id: `s${Date.now()}`, action, target: template, value: "", selector: "" },
    ];
    setAddOpen(false);
    setTemplateQuery("");
    void persistSteps(next, "add").then(() => router.refresh());
  }

  function dropStep(index: number) {
    if (dragIndex === null || dragIndex === index) return;
    const next = [...steps];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setDragIndex(null);
    void persistSteps(next, "reorder");
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    void persistSteps(next, "reorder");
  }

  function removeStep(index: number) {
    const next = steps.filter((_, i) => i !== index);
    setDetailIndex(null);
    void persistSteps(next, "delete-step");
  }

  async function executeRun(autoFix: boolean) {
    setRunAutoFix(autoFix);
    setRunOpen(true);
    setRunPhase("preparing");
    setRunLog([]);
    const saved = await run("save", `/api/dashboard/test-cases/${data.id}`, { method: "PATCH", json: { action: "steps", steps } });
    if (!saved) {
      setRunPhase("done");
      return;
    }
    const result = await run<{ log: RunLogLine[] }>("run", `/api/dashboard/test-cases/${data.id}`, {
      method: "PATCH",
      json: { action: "run_steps", autoFix },
    });
    if (result?.log) setRunLog(result.log);
    setRunPhase("done");
    router.refresh();
  }

  async function savePriority(value: string) {
    setPriority(value);
    setPriorityOpen(false);
    setEditPriority(value);
    await run("priority", `/api/dashboard/test-cases/${data.id}`, { method: "PATCH", json: { action: "edit", criticality: value } });
    router.refresh();
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editName.trim()) return;
    if (editStatus !== data.rawStatus) {
      const statusRes = await run("status", `/api/dashboard/test-cases/${data.id}`, { method: "PATCH", json: { action: "set", status: editStatus } });
      if (!statusRes) return;
    }
    const res = await run("edit", `/api/dashboard/test-cases/${data.id}`, {
      method: "PATCH",
      json: {
        action: "edit",
        title: editName.trim(),
        description: editDescription,
        module: editModule.trim(),
        criticality: editPriority,
        environment: editEnvironment,
        version: editVersion,
        platform: editPlatform,
        labels: editLabels,
      },
    });
    if (res) {
      setEditOpen(false);
      setPriority(editPriority);
      router.refresh();
    }
  }

  async function savePrerequisites() {
    const res = await run("prereq", `/api/dashboard/test-cases/${data.id}`, {
      method: "PATCH",
      json: { action: "prerequisites", testCaseIds: selectedPrereqs },
    });
    if (res) {
      setPrereqOpen(false);
      router.refresh();
    }
  }

  async function saveVariables() {
    const next: Record<string, string> = {};
    for (const row of variables) {
      const key = row.key.trim();
      if (key) next[key] = row.value;
    }
    const res = await run("vars", `/api/dashboard/test-cases/${data.id}`, { method: "PATCH", json: { action: "variables", variables: next } });
    if (res) router.refresh();
  }

  function addVariableRow() {
    setVariables((prev) => [...prev, { key: "", value: "" }]);
  }

  function addLabel() {
    const value = labelDraft.trim();
    if (!value || editLabels.includes(value)) return;
    setEditLabels((prev) => [...prev, value]);
    setLabelDraft("");
  }

  async function duplicateCase() {
    setMenuOpen(false);
    const created = await run<{ testCases: Array<{ id: string }> }>("clone", "/api/dashboard/test-cases", {
      json: { mode: "manual", title: `${data.title} (Copy)`, module: data.module, criticality: priority, stepsCount: Math.max(1, steps.length) },
    });
    const newId = created?.testCases?.[0]?.id;
    if (!newId) return;
    await run("clone-steps", `/api/dashboard/test-cases/${newId}`, { method: "PATCH", json: { action: "steps", steps } });
    router.push(`/dashboard/test-studio/${newId}`);
  }

  async function deleteCase() {
    setMenuOpen(false);
    if (!window.confirm(`Delete "${data.title}"? This cannot be undone.`)) return;
    const res = await run("delete", `/api/dashboard/test-cases/${data.id}`, { method: "DELETE" });
    if (res) router.push("/dashboard/test-cases");
  }

  function exportSteps() {
    setMenuOpen(false);
    const blob = new Blob([JSON.stringify({ testCase: data.title, steps }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}-steps.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function restoreVersion(version: StudioVersion) {
    if (!version.steps.length) return;
    const res = await persistSteps(version.steps, `restore-${version.version}`);
    if (res) router.refresh();
  }

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-bold leading-7 tracking-[-0.01em] text-[#101828]">{data.title}</h1>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              aria-label="Edit test case"
              className="rounded p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#374151]"
            >
              <CqaIcon name="edit" className="text-[17px]" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={() => setEditOpen(true)} className={cn("inline-flex items-center rounded-md border px-2.5 py-[3px] text-[12px] font-medium", statusTone(data.status))}>
              {data.status}
            </button>
            <div className="relative">
              <button type="button" onClick={() => setPriorityOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-md border border-[#e5e7eb] bg-white px-2.5 py-[3px] text-[12px] font-medium text-[#4a5565] hover:bg-[#f9fafb]">
                {priorityLabel(priority)}
                <CqaIcon name="expand_more" className="text-[14px]" />
              </button>
              {priorityOpen && (
                <div className="absolute left-0 top-[calc(100%+4px)] z-30 w-36 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
                  {["low", "medium", "high", "critical"].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => void savePriority(value)}
                      className={cn("flex w-full items-center px-3 py-1.5 text-left text-[12.5px] hover:bg-[#f9fafb]", priority === value ? "font-medium text-[#5b4ee8]" : "text-[#374151]")}
                    >
                      {priorityLabel(value)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button type="button" aria-label="More actions" onClick={() => setMenuOpen((v) => !v)} className={cn(cqaIconBtn, "border border-[#e5e7eb] bg-white")}>
              <CqaIcon name="more_vert" className="text-[19px]" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
                <button type="button" onClick={() => void duplicateCase()} disabled={readOnly} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb] disabled:opacity-50">
                  <CqaIcon name="content_copy" className="text-[16px]" /> Duplicate test case
                </button>
                <button type="button" onClick={exportSteps} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb]">
                  <CqaIcon name="download" className="text-[16px]" /> Export steps
                </button>
                <button type="button" onClick={() => void deleteCase()} disabled={readOnly} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-50">
                  <CqaIcon name="delete" className="text-[16px]" /> Delete test case
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Auto-fix rerun"
            title="Auto-fix rerun"
            onClick={() => void executeRun(true)}
            disabled={readOnly || pending === "run" || pending === "save"}
            className={cn(cqaIconBtn, "border border-[#e5e7eb] bg-white")}
          >
            <CqaIcon name="autorenew" className="text-[19px]" />
          </button>
          <button type="button" onClick={() => void executeRun(false)} disabled={readOnly || pending === "run" || pending === "save"} className={cn(cqaBtnPrimary, "h-9 px-4")}>
            <CqaIcon name="play_arrow" className="text-[18px]" /> Run
          </button>
          <button type="button" onClick={() => setPrereqOpen(true)} disabled={readOnly} className={cn(cqaBtnSecondary, "h-9 px-3")}>
            <CqaIcon name="add" className="text-[17px]" /> Add Prerequisite
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-6 overflow-x-auto border-b border-[#e5e7eb]">
        {([
          { id: "steps" as const, label: `Test Steps (${steps.length})` },
          { id: "relationships" as const, label: "Relationships" },
          { id: "versions" as const, label: "Version History" },
        ]).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "whitespace-nowrap border-b-2 pb-2.5 pt-1 text-[13.5px] transition",
              tab === item.id ? "border-[#5b4ee8] font-medium text-[#5b4ee8]" : "border-transparent text-[#6b7280] hover:text-[#111827]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>}

      <div className="mt-4 flex flex-col gap-5 xl:flex-row">
        <div className="min-w-0 flex-1">
          {tab === "steps" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search"
                    aria-label="Search steps"
                    className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-[13px] outline-none transition placeholder:text-[#9ca3af] focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setReorder((value) => !value)}
                  aria-pressed={reorder}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[12.5px] font-medium transition",
                    reorder ? "border-[#a9a1f7] text-[#5b4ee8]" : "border-[#e5e7eb] text-[#4a5565] hover:bg-[#f9fafb]",
                  )}
                >
                  <CqaIcon name="drag_indicator" className="text-[18px]" /> Reorder
                </button>
              </div>

              <div className={cn(cqaCard, "overflow-hidden")}>
                {visibleSteps.length === 0 ? (
                  <div className="px-5 py-14 text-center">
                    <p className="text-[14px] font-medium text-[#374151]">No steps match your search</p>
                    <p className="mt-1 text-[12.5px] text-[#9ca3af]">Clear the search or add a new step.</p>
                  </div>
                ) : (
                  <ol className="divide-y divide-[#f0f1f3]">
                    {visibleSteps.map(({ step, index }) => {
                      const stepDate = formatStepDate(data.createdAt);
                      return (
                        <li
                          key={step.id}
                          draggable={!readOnly && reorder}
                          onDragStart={() => setDragIndex(index)}
                          onDragOver={(event) => reorder && event.preventDefault()}
                          onDrop={() => reorder && dropStep(index)}
                          className="group flex items-start gap-3 px-4 py-3.5 transition hover:bg-[#fafafa]"
                        >
                          {reorder && (
                            <CqaIcon name="drag_indicator" className="mt-0.5 shrink-0 cursor-grab text-[18px] text-[#9ca3af] active:cursor-grabbing" />
                          )}
                          <span className="mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#f5f3ff] text-[11px] font-semibold text-[#5b4ee8]">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            {step.action === "AI Assertion" ? (
                              <span className="mb-1 inline-flex items-center gap-1 rounded border border-[#ddd6fe] bg-[#f5f3ff] px-1.5 py-[1px] text-[10.5px] font-medium text-[#5b4ee8]">
                                <CqaIcon name="auto_awesome" className="text-[12px]" /> AI Verification
                              </span>
                            ) : null}
                            <p className="text-[13px] leading-5 text-[#1f2937]">{sentenceForStep(step, data.variables, orgUrl)}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setDetailIndex(index)}
                                className="text-[11.5px] font-medium text-[#5b4ee8] hover:underline"
                              >
                                View Details
                              </button>
                              {!readOnly && (
                                <span className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                                  <button type="button" aria-label="Move step up" onClick={() => moveStep(index, -1)} className="rounded p-1 text-[#9ca3af] hover:text-[#374151]">
                                    <CqaIcon name="arrow_upward" className="text-[14px]" />
                                  </button>
                                  <button type="button" aria-label="Move step down" onClick={() => moveStep(index, 1)} className="rounded p-1 text-[#9ca3af] hover:text-[#374151]">
                                    <CqaIcon name="arrow_downward" className="text-[14px]" />
                                  </button>
                                  <button type="button" aria-label="Delete step" onClick={() => removeStep(index)} className="rounded p-1 text-[#9ca3af] hover:text-[#dc2626]">
                                    <CqaIcon name="delete" className="text-[14px]" />
                                  </button>
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="mt-0.5 shrink-0 text-[11.5px] text-[#9ca3af]">{stepDate}</span>
                        </li>
                      );
                    })}
                  </ol>
                )}
                <div className="border-t border-[#f0f1f3] px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    disabled={readOnly}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-[#5b4ee8] transition hover:bg-[#f5f3ff] disabled:opacity-50"
                  >
                    <CqaIcon name="add" className="text-[17px]" /> Add Step
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "relationships" && (
            <div className="space-y-4">
              <div className="flex items-center gap-5 border-b border-[#e5e7eb]">
                <button type="button" className="border-b-2 border-[#5b4ee8] pb-2.5 pt-1 text-[13px] font-medium text-[#5b4ee8]">
                  Test Plans ({data.plans.length})
                </button>
                <button type="button" className="border-b-2 border-transparent pb-2.5 pt-1 text-[13px] text-[#6b7280]">
                  Used as Prerequisite in ({data.prerequisiteOf.length})
                </button>
              </div>
              <div className="flex items-start gap-2 text-[12px] text-[#6b7280]">
                <CqaIcon name="info" className="text-[15px] text-[#9ca3af]" />
                <span>Test plans and prerequisite links are kept in sync across the workspace.</span>
              </div>
              <div className={cn(cqaCard, "overflow-hidden")}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[#f0f1f3] bg-white">
                        {["Name", "Status", ""].map((header) => (
                          <th key={header || "actions"} className="px-4 py-2.5 text-[12px] font-medium text-[#6b7280]">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-[13px] text-[#374151]">
                      {data.plans.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-12 text-center text-[12.5px] text-[#9ca3af]">Not used in any test plan.</td></tr>
                      ) : (
                        data.plans.map((plan) => (
                          <tr key={plan.id} className="border-b border-[#f3f4f6] last:border-0 hover:bg-[#fafafa]">
                            <td className="px-4 py-3">
                              <div className="flex items-start gap-2">
                                <CqaIcon name="description" className="mt-0.5 text-[16px] text-[#9ca3af]" />
                                <Link href={`/dashboard/plans/test-plans/${plan.id}`} className="font-medium text-[#1f2937] hover:text-[#5b4ee8]">{plan.name}</Link>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn("inline-flex items-center gap-1.5 text-[12.5px]", planTone(plan.status))}>
                                <CqaIcon name={plan.status === "Passed" ? "task_alt" : plan.status === "Failure" ? "cancel" : "error_outline"} className="text-[16px]" />
                                {plan.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link href={`/dashboard/plans/test-plans/${plan.id}`} aria-label={`Open ${plan.name}`} className={cqaIconBtn}>
                                <CqaIcon name="open_in_new" className="text-[17px]" />
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-[#f0f1f3] px-4 py-2.5 text-[12px] text-[#6b7280]">
                  <span>Rows per page <span className="ml-1">10</span></span>
                  <span className="tabular-nums">1–{data.plans.length} of {data.plans.length}</span>
                </div>
              </div>

              <div className={cn(cqaCard, "overflow-hidden")}>
                <div className="border-b border-[#f0f1f3] px-4 py-2.5 text-[12.5px] font-medium text-[#374151]">Used as Prerequisite in</div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[#f0f1f3] bg-white">
                        {["Name", "Status", ""].map((header) => (
                          <th key={header || "actions"} className="px-4 py-2.5 text-[12px] font-medium text-[#6b7280]">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-[13px] text-[#374151]">
                      {data.prerequisiteOf.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 py-10 text-center text-[12.5px] text-[#9ca3af]">No test cases use this as a prerequisite.</td></tr>
                      ) : (
                        data.prerequisiteOf.map((item) => (
                          <tr key={item.id} className="border-b border-[#f3f4f6] last:border-0 hover:bg-[#fafafa]">
                            <td className="px-4 py-3">
                              <Link href={`/dashboard/test-studio/${item.id}`} className="font-medium text-[#1f2937] hover:text-[#5b4ee8]">{item.title}</Link>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn("inline-flex items-center rounded border px-2 py-[2px] text-[11.5px]", statusTone(item.status))}>{item.status}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link href={`/dashboard/test-studio/${item.id}`} aria-label={`Open ${item.title}`} className={cqaIconBtn}>
                                <CqaIcon name="open_in_new" className="text-[17px]" />
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === "versions" && (
            <div className="space-y-3">
              <p className="text-[12.5px] font-medium text-[#6b7280]">{data.versions.length} Versions</p>
              {data.versions.length === 0 ? (
                <div className={cn(cqaCard, "px-5 py-14 text-center")}>
                  <CqaIcon name="history" className="text-[28px] text-[#d1d5db]" />
                  <p className="mt-2 text-[14px] font-medium text-[#374151]">No version history</p>
                  <p className="mt-1 text-[12.5px] text-[#9ca3af]">Version history will appear here once changes are made to this test case.</p>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[250px_1fr]">
                  <div className={cn(cqaCard, "h-fit p-2")}>
                    {data.versions.map((version) => (
                      <button
                        key={version.id}
                        type="button"
                        className={cn(
                          "flex w-full items-start gap-2 rounded-md px-2 py-2.5 text-left transition",
                          version.version === selectedVersion?.version ? "bg-[#f5f3ff]" : "hover:bg-[#f9fafb]",
                        )}
                      >
                        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold", version.version === selectedVersion?.version ? "border-[#ddd6fe] bg-white text-[#5b4ee8]" : "border-[#e5e7eb] bg-white text-[#6b7280]")}>
                          v{version.version}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-[12px] font-medium", version.current ? "text-[#4f46e5]" : "text-[#374151]")}>{version.current ? "Current" : version.summary}</span>
                          <span className="mt-0.5 block text-[11px] text-[#6b7280]">{relativeTime(version.createdAt)}</span>
                          <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[#6b7280]">
                            <span className="flex size-4 items-center justify-center rounded-full bg-[#eef2ff] text-[9px] font-semibold text-[#4f46e5]">{parseInitials(version.author)}</span>
                            {version.author}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>

                  {selectedVersion && (
                    <div className={cn(cqaCard, "p-5")}>
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0f1f3] pb-4">
                        <div className="flex items-center gap-2">
                          <h2 className="text-[16px] font-semibold text-[#262626]">Version {selectedVersion.version}</h2>
                          {selectedVersion.current && <span className="rounded border border-[#b9f8cf] bg-[#f0fdf4] px-1.5 py-[1px] text-[10.5px] font-medium text-[#00a63e]">Current</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => void restoreVersion(selectedVersion)}
                          disabled={readOnly || selectedVersion.steps.length === 0 || pending === `restore-${selectedVersion.version}`}
                          className={cn(cqaBtnSecondary, "h-8 px-3 text-[12px]")}
                        >
                          <CqaIcon name="restore" className="text-[15px]" /> Restore this version
                        </button>
                      </div>
                      <div className="flex items-center gap-2 py-3">
                        <span className="flex size-8 items-center justify-center rounded-full bg-[#eef2ff] text-[12px] font-semibold text-[#4f46e5]">{parseInitials(selectedVersion.author)}</span>
                        <div>
                          <p className="text-[12.5px] font-medium text-[#374151]">{selectedVersion.author}</p>
                          <p className="text-[11.5px] text-[#6b7280]">{selectedVersion.author} · {formatFull(selectedVersion.createdAt)}</p>
                        </div>
                      </div>
                      <p className="text-[13px] text-[#374151]">{selectedVersion.summary}</p>

                      {selectedVersion.added.length > 0 && (
                        <div className="mt-4 border-t border-[#f0f1f3] pt-4">
                          <p className="flex items-center gap-2 text-[13px] font-semibold text-[#374151]">
                            Steps Added <span className="rounded bg-[#f3f4f6] px-1.5 py-[1px] text-[11px] font-medium text-[#4a5565]">{selectedVersion.added.length}</span>
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {selectedVersion.added.map((item, index) => (
                              <li key={`${item}-${index}`} className="flex items-start gap-2 text-[12.5px] text-[#374151]">
                                <span className="rounded border border-[#b9f8cf] bg-[#f0fdf4] px-1.5 py-[1px] text-[10px] font-medium text-[#00a63e]">Added</span>
                                <span>{index + 1}. {item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedVersion.removed.length > 0 && (
                        <div className="mt-4 border-t border-[#f0f1f3] pt-4">
                          <p className="flex items-center gap-2 text-[13px] font-semibold text-[#374151]">
                            Steps Removed <span className="rounded bg-[#f3f4f6] px-1.5 py-[1px] text-[11px] font-medium text-[#4a5565]">{selectedVersion.removed.length}</span>
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {selectedVersion.removed.map((item, index) => (
                              <li key={`${item}-${index}`} className="flex items-start gap-2 text-[12.5px] text-[#374151]">
                                <span className="rounded border border-[#fecaca] bg-[#fef2f2] px-1.5 py-[1px] text-[10px] font-medium text-[#dc2626]">Removed</span>
                                <span>{index + 1}. {item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="w-full shrink-0 xl:w-[320px]">
          <div className={cn(cqaCard, "overflow-hidden xl:sticky xl:top-4")}>
            <div className="grid grid-cols-4 border-b border-[#f0f1f3]">
              {PANELS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPanel(item.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 border-b-2 px-1 py-2.5 text-[10.5px] font-medium transition",
                    panel === item.id ? "border-[#5b4ee8] text-[#5b4ee8]" : "border-transparent text-[#6b7280] hover:text-[#374151]",
                  )}
                >
                  <CqaIcon name={item.icon} className="text-[18px]" />
                  {item.label}
                </button>
              ))}
            </div>

            {panel === "testcase" && (
              <div className="max-h-[calc(100vh-180px)] overflow-y-auto px-4 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold text-[#262626]">Description</h2>
                  <button type="button" onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#5b4ee8] hover:underline">
                    <CqaIcon name="edit" className="text-[14px]" /> Edit
                  </button>
                </div>
                <p className="mt-2 text-[12px] leading-5 text-[#4a5565]">
                  {data.description || "No description added yet."}
                </p>

                <dl className="mt-4 space-y-2.5 border-t border-[#f0f1f3] pt-3">
                  {[
                    ["person_outline", "Created by", currentUser === data.title ? "System" : "System"],
                    ["calendar_today", "Created on", formatFull(data.createdAt)],
                    ["check_circle", "Status", data.status],
                    ["flag", "Priority", priorityLabel(priority)],
                    ["category", "Module", data.module],
                    ["storage", "Environment", data.environment],
                    ["label", "Version", data.version],
                    ["devices", "Platform", data.platform],
                  ].map(([icon, label, value]) => (
                    <div key={label} className="flex items-start gap-2 text-[12px]">
                      <CqaIcon name={icon} className="mt-0.5 text-[15px] text-[#9ca3af]" />
                      <dt className="w-[90px] shrink-0 text-[#6b7280]">{label}</dt>
                      <dd className="min-w-0 flex-1 text-[#374151]">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-3 flex items-start gap-2 border-t border-[#f0f1f3] pt-3">
                  <CqaIcon name="label" className="mt-0.5 text-[15px] text-[#9ca3af]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] text-[#6b7280]">Labels</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {data.labels.length === 0 && <span className="text-[12px] text-[#9ca3af]">No labels</span>}
                      {data.labels.map((label) => (
                        <span key={label} className="inline-flex items-center gap-1 rounded border border-[#e5e7eb] bg-[#f9fafb] px-1.5 py-[2px] text-[10.5px] text-[#4a5565]">
                          <CqaIcon name="label" className="text-[11px]" /> {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-[#f0f1f3] pt-1">
                  <p className="pt-2 text-[12.5px] font-semibold text-[#262626]">Configuration</p>

                  <SectionTitle icon="play_circle" title="Execution" open={expanded.execution} onToggle={() => toggleSection("execution")} />
                  {expanded.execution && (
                    <div className="pb-2">
                      <SettingRow label="Environment" value={data.settings.environment} />
                      <SettingRow label="Type" value="Not set" />
                    </div>
                  )}

                  <SectionTitle icon="smart_toy" title="AI Configuration" open={expanded.ai} onToggle={() => toggleSection("ai")} />
                  {expanded.ai && (
                    <div className="pb-2">
                      <SettingRow label="Enable AI Smartness" value={`Org Level (${data.settings.aiSmartness.replace(/ \(Recommended\)/, "")})`} />
                      <SettingRow label="Default AI Action" value={`Org Level (${data.settings.defaultAiAction})`} />
                      <SettingRow label="Default Knowledge Base" value={data.settings.knowledgeName} />
                      <SettingRow label="Enable AI metadata collection" value={`Org Level (${data.settings.useAiMetadata})`} />
                      <SettingRow label="Auto approve with auto heal" value={`Org Level (${data.settings.autoApproveAutoHeal})`} />
                      <SettingRow label="Enable Click Press Hold" value={`Org Level (${data.settings.clickPressHold})`} />
                    </div>
                  )}

                  <SectionTitle icon="timer" title="Wait and retries" open={expanded.waits} onToggle={() => toggleSection("waits")} />
                  {expanded.waits && (
                    <div className="pb-2">
                      <ToggleRow label="Enable Avoid Auto wait for steps" hint="Off" />
                      <SettingRow label="Retry Failed Steps" value={`Org Level (${data.settings.retryFailedSteps})`} />
                      <SettingRow label="Test Case Timeout (minutes)" value={`Org Level (${data.settings.testcaseTimeout})`} />
                      <SettingRow label="Wait Timeout for Locators (secs)" value={`Org Level (${data.settings.waitTimeoutLocators})`} />
                    </div>
                  )}

                  <SectionTitle icon="devices" title="Device Setting" open={expanded.device} onToggle={() => toggleSection("device")} />
                  {expanded.device && (
                    <div className="pb-2">
                      <SettingRow label="Default Browser" value={`Org Level (${data.settings.defaultBrowser})`} />
                      <SettingRow label="Viewport" value={`desktop: ${data.settings.viewportName} (${data.settings.viewportWidth}x${data.settings.viewportHeight})`} />
                      <SettingRow label="Proxy" value={data.settings.proxyName} />
                      <SettingRow label="Remote Browser" value={data.settings.remoteName} />
                      <SettingRow label="Run in test plan as" value="Headless" />
                    </div>
                  )}

                  <SectionTitle icon="flag" title="Key Flags" open={expanded.flags} onToggle={() => toggleSection("flags")} />
                  {expanded.flags && (
                    <div className="pb-2">
                      <ToggleRow label="Mobile Testing" hint="Off" />
                      <ToggleRow label="Extension Use" hint="Off" />
                      <ToggleRow label="Data Driven" hint="Off" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {panel === "variables" && (
              <div className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold text-[#262626]">Test Case Variables</h2>
                  <button type="button" onClick={addVariableRow} aria-label="Add variable" className="text-[#5b4ee8] hover:text-[#4f46e5]">
                    <CqaIcon name="add" className="text-[18px]" />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_1fr] gap-2 text-[11px] font-medium text-[#6b7280]">
                  <span className="flex items-center gap-1">Parameter Name <CqaIcon name="info" className="text-[13px] text-[#9ca3af]" /></span>
                  <span>Parameter Value</span>
                </div>
                <div className="mt-2 space-y-2">
                  {variables.map((row, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr] gap-2">
                      <input
                        className={cn(inputCls, "h-8 px-2 text-[12px]")}
                        value={row.key}
                        placeholder="name"
                        disabled={readOnly}
                        onChange={(event) => setVariables((prev) => prev.map((item, i) => (i === index ? { ...item, key: event.target.value } : item)))}
                      />
                      <input
                        className={cn(inputCls, "h-8 px-2 text-[12px]")}
                        value={row.value}
                        placeholder="value"
                        disabled={readOnly}
                        onChange={(event) => setVariables((prev) => prev.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)))}
                      />
                    </div>
                  ))}
                  {variables.length === 0 && <p className="py-6 text-center text-[12px] text-[#9ca3af]">No variables yet. Add a parameter to reuse values across steps.</p>}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#f0f1f3] pt-3">
                  <button type="button" onClick={addVariableRow} className="inline-flex items-center gap-1 text-[12px] font-medium text-[#5b4ee8] hover:underline">
                    <CqaIcon name="add" className="text-[15px]" /> Add Variable
                  </button>
                  <button type="button" onClick={() => void saveVariables()} disabled={readOnly || pending === "vars"} className={cn(cqaBtnPrimary, "h-8 px-3 text-[12px]")}>
                    {pending === "vars" ? "Saving…" : "Save"}
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[#9ca3af]">Reference a parameter in a step with <code className="rounded bg-[#f3f4f6] px-1">|name|</code>.</p>
              </div>
            )}

            {panel === "usedin" && (
              <div className="px-4 py-4">
                <p className="text-[12px] text-[#4a5565]">Variables are resolved using: <span className="font-medium text-[#374151]">{data.settings.environment}</span></p>
                <div className="relative mt-3">
                  <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#9ca3af]" />
                  <input
                    type="search"
                    value={usedQuery}
                    onChange={(event) => setUsedQuery(event.target.value)}
                    placeholder="Search"
                    aria-label="Search environment variables"
                    className="h-8 w-full rounded-md border border-[#e5e7eb] pl-8 pr-2 text-[12px] outline-none focus:border-[#a9a1f7]"
                  />
                </div>
                <div className="mt-4 flex items-center gap-1.5 border-b border-[#f0f1f3] pb-2">
                  <CqaIcon name="chevron_right" className="text-[15px] text-[#6b7280]" />
                  <span className="text-[12px] font-semibold text-[#374151]">Environment Variables Used</span>
                </div>
                <div className="divide-y divide-[#f3f4f6]">
                  {usedVariables.length === 0 && <p className="py-5 text-center text-[12px] text-[#9ca3af]">No environment variables used.</p>}
                  {usedVariables.map((entry) => (
                    <div key={entry.key} className="flex items-center gap-2 py-2.5 text-[12px]">
                      <CqaIcon name="chevron_right" className="text-[14px] text-[#9ca3af]" />
                      <code className="font-medium text-[#374151]">{entry.key}</code>
                      <span className="rounded bg-[#eef2ff] px-1.5 py-[1px] text-[9.5px] font-semibold text-[#4f46e5]">ENV</span>
                      <span className="rounded bg-[#f3f4f6] px-1.5 py-[1px] text-[9.5px] font-semibold text-[#6b7280]">RW</span>
                      <span className="ml-auto text-[11px] text-[#9ca3af]">Step {entry.step}</span>
                    </div>
                  ))}
                </div>
                <Link href="/dashboard/environments" className="mt-3 inline-flex items-center gap-1 border-t border-[#f0f1f3] pt-3 text-[12px] font-medium text-[#5b4ee8] hover:underline">
                  <CqaIcon name="chevron_right" className="text-[14px]" /> Manage in Environment &amp; Data Management
                </Link>
              </div>
            )}

            {panel === "runhistory" && (
              <div className="max-h-[calc(100vh-180px)] overflow-y-auto px-3 py-3">
                {data.runs.length === 0 && <p className="px-2 py-8 text-center text-[12px] text-[#9ca3af]">No runs yet. Hit Run to execute this test case.</p>}
                <div className="space-y-2.5">
                  {data.runs.map((runItem) => (
                    <div key={runItem.id} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                        <CqaIcon
                          name={runItem.status === "PASSED" ? "check_circle" : "cancel"}
                          className={runItem.status === "PASSED" ? "text-[15px] text-[#00a63e]" : "text-[15px] text-[#dc2626]"}
                        />
                        <span className="font-semibold text-[#111827]">#{runItem.runNumber}</span>
                        <span className={runItem.status === "PASSED" ? "text-[#00a63e]" : "text-[#dc2626]"}>{runItem.status === "PASSED" ? "Passed" : "Failed"}</span>
                        <span className="text-[#9ca3af]">·</span>
                        <span className="text-[#4a5565]">{runItem.trigger}</span>
                        {runItem.autoFix && (
                          <span className="ml-1 inline-flex items-center gap-1 rounded bg-[#f5f3ff] px-1.5 py-[1px] text-[10px] font-medium text-[#5b4ee8]">
                            <CqaIcon name="auto_awesome" className="text-[11px]" /> Auto-fix rerun
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-[#6b7280]">
                        <span className="inline-flex items-center gap-1"><CqaIcon name="calendar_today" className="text-[12px]" /> {formatRunDate(runItem.createdAt)}</span>
                        <span className="inline-flex items-center gap-1"><CqaIcon name="hourglass_empty" className="text-[12px]" /> {formatDuration(runItem.durationMs)}</span>
                      </div>
                      <p className={cn("mt-1.5 text-[11.5px]", runItem.status === "PASSED" ? "text-[#00a63e]" : "text-[#dc2626]")}>
                        {runItem.status === "PASSED" ? "Passed" : runItem.failedStep ? `Failed at Step ${runItem.failedStep}` : "Failed"}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[#6b7280]" title={runItem.mode}>{runItem.mode}</p>
                      {runItem.failedStepText && <p className="mt-0.5 truncate text-[10.5px] text-[#9ca3af]" title={runItem.failedStepText}>{runItem.failedStepText}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Create an action step" size="lg">
        <p className="text-[13px] font-medium text-[#374151]">Template library</p>
        <div className="relative mt-2">
          <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[17px] text-[#9ca3af]" />
          <input
            type="search"
            value={templateQuery}
            onChange={(event) => setTemplateQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search templates"
            className="h-9 w-full rounded-lg border border-[#e5e7eb] pl-9 pr-3 text-[13px] outline-none focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
          />
        </div>
        <div className="mt-3 max-h-[430px] divide-y divide-[#f0f1f3] overflow-y-auto rounded-lg border border-[#e5e7eb]">
          {filteredTemplates.map((template) => (
            <button
              key={template}
              type="button"
              onClick={() => addTemplate(template)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12.5px] text-[#374151] transition hover:bg-[#f5f3ff] hover:text-[#4f46e5]"
            >
              <CqaIcon name="add" className="shrink-0 text-[15px] text-[#9ca3af]" />
              <span>{template}</span>
            </button>
          ))}
          {filteredTemplates.length === 0 && <p className="px-3 py-8 text-center text-[12.5px] text-[#9ca3af]">No templates match your search.</p>}
        </div>
      </Modal>

      <Modal open={detailIndex !== null} onClose={() => setDetailIndex(null)} title="Step Details" size="lg">
        {detailStep && detailIndex !== null && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-[#f5f3ff] text-[11px] font-semibold text-[#5b4ee8]">{detailIndex + 1}</span>
              <span className="text-[13px] font-medium text-[#374151]">{detailStep.action}</span>
              {detailStep.action === "AI Assertion" && (
                <span className="inline-flex items-center gap-1 rounded border border-[#ddd6fe] bg-[#f5f3ff] px-1.5 py-[1px] text-[10.5px] font-medium text-[#5b4ee8]">
                  <CqaIcon name="auto_awesome" className="text-[12px]" /> AI Verification
                </span>
              )}
            </div>
            <label className="block">
              <span className={labelCls}>Action type</span>
              <select
                className={inputCls}
                value={detailStep.action}
                disabled={readOnly}
                onChange={(event) => {
                  const next = steps.map((step, index) => (index === detailIndex ? { ...step, action: event.target.value as StudioStep["action"] } : step));
                  setSteps(next);
                }}
              >
                {ACTIONS.map((action) => <option key={action}>{action}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Step description</span>
              <textarea
                className={cn(inputCls, "h-auto min-h-[80px] resize-y py-2")}
                value={detailStep.target}
                disabled={readOnly}
                onChange={(event) => {
                  const next = steps.map((step, index) => (index === detailIndex ? { ...step, target: event.target.value } : step));
                  setSteps(next);
                }}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelCls}>Value</span>
                <input
                  className={inputCls}
                  value={detailStep.value}
                  disabled={readOnly}
                  onChange={(event) => {
                    const next = steps.map((step, index) => (index === detailIndex ? { ...step, value: event.target.value } : step));
                    setSteps(next);
                  }}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Selector</span>
                <input
                  className={inputCls}
                  value={detailStep.selector}
                  disabled={readOnly}
                  placeholder="auto-resolved by AI"
                  onChange={(event) => {
                    const next = steps.map((step, index) => (index === detailIndex ? { ...step, selector: event.target.value } : step));
                    setSteps(next);
                  }}
                />
              </label>
            </div>
            <p className="rounded-lg bg-[#f5f3ff] px-3 py-2 text-[12px] text-[#4f46e5]">
              AI auto-healing re-resolves this step from the page during execution if the selector changes.
            </p>
          </div>
        )}
        <div className="mt-5 flex items-center justify-between border-t border-[#f0f1f3] pt-4">
          <button type="button" onClick={() => detailIndex !== null && removeStep(detailIndex)} disabled={readOnly} className="inline-flex items-center gap-1 text-[12px] font-medium text-[#dc2626] hover:underline disabled:opacity-50">
            <CqaIcon name="delete" className="text-[15px]" /> Delete step
          </button>
          <span className="flex items-center gap-2">
            <button type="button" className={cqaBtnSecondary} onClick={() => setDetailIndex(null)}>Cancel</button>
            <button
              type="button"
              className={cqaBtnPrimary}
              disabled={readOnly || pending === "detail-save"}
              onClick={() => {
                void persistSteps(steps, "detail-save").then((res) => {
                  if (res) setDetailIndex(null);
                });
              }}
            >
              {pending === "detail-save" ? "Saving…" : "Save Changes"}
            </button>
          </span>
        </div>
      </Modal>

      <Modal open={prereqOpen} onClose={() => setPrereqOpen(false)} title="Add Prerequisite" size="lg">
        <div className="space-y-3">
          <div className="relative">
            <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[17px] text-[#9ca3af]" />
            <input
              type="search"
              value={prereqQuery}
              onChange={(event) => setPrereqQuery(event.target.value)}
              placeholder="Search test cases"
              aria-label="Search test cases"
              className="h-9 w-full rounded-lg border border-[#e5e7eb] pl-9 pr-3 text-[13px] outline-none focus:border-[#a9a1f7]"
            />
          </div>
          <div className="max-h-[360px] divide-y divide-[#f0f1f3] overflow-y-auto rounded-lg border border-[#e5e7eb]">
            {filteredPrereqs.map((candidate) => (
              <label key={candidate.id} className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 hover:bg-[#fafafa]">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-[#5b4ee8]"
                  checked={selectedPrereqs.includes(candidate.id)}
                  onChange={() => setSelectedPrereqs((prev) => (prev.includes(candidate.id) ? prev.filter((v) => v !== candidate.id) : [...prev, candidate.id]))}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-[#1f2937]">{candidate.title}</span>
                  <span className="mt-0.5 block text-[11.5px] text-[#6b7280]">{candidate.module || "Unorganised"}</span>
                </span>
              </label>
            ))}
            {filteredPrereqs.length === 0 && <p className="px-3 py-8 text-center text-[12.5px] text-[#9ca3af]">No test cases match.</p>}
          </div>
          <p className="text-[11.5px] text-[#6b7280]">{selectedPrereqs.length} selected. Prerequisites run before this test case.</p>
        </div>
        <div className="mt-4 flex justify-end gap-2 border-t border-[#f0f1f3] pt-4">
          <button type="button" className={cqaBtnSecondary} onClick={() => setPrereqOpen(false)}>Cancel</button>
          <button type="button" className={cqaBtnPrimary} onClick={() => void savePrerequisites()} disabled={readOnly || pending === "prereq"}>
            {pending === "prereq" ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Test Case" size="lg">
        <form onSubmit={saveEdit} className="space-y-4">
          <label className="block">
            <span className={labelCls}>Test case name <span className="text-[#ef4444]">*</span></span>
            <input className={inputCls} value={editName} onChange={(event) => setEditName(event.target.value)} required disabled={readOnly} />
          </label>
          <label className="block">
            <span className={labelCls}>Description</span>
            <textarea className={cn(inputCls, "h-auto min-h-[90px] resize-y py-2")} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} disabled={readOnly} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Module</span>
              <input className={inputCls} value={editModule} onChange={(event) => setEditModule(event.target.value)} disabled={readOnly} />
            </label>
            <label className="block">
              <span className={labelCls}>Status</span>
              <select className={inputCls} value={editStatus} onChange={(event) => setEditStatus(event.target.value)} disabled={readOnly}>
                <option value="passing">Ready</option>
                <option value="failing">In Review</option>
                <option value="draft">Draft</option>
                <option value="flaky">Flaky</option>
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Priority</span>
              <select className={inputCls} value={editPriority} onChange={(event) => setEditPriority(event.target.value)} disabled={readOnly}>
                {["low", "medium", "high", "critical"].map((value) => <option key={value} value={value}>{priorityLabel(value)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Environment</span>
              <input className={inputCls} value={editEnvironment} onChange={(event) => setEditEnvironment(event.target.value)} disabled={readOnly} />
            </label>
            <label className="block">
              <span className={labelCls}>Version</span>
              <input className={inputCls} value={editVersion} onChange={(event) => setEditVersion(event.target.value)} disabled={readOnly} />
            </label>
            <label className="block">
              <span className={labelCls}>Platform</span>
              <select className={inputCls} value={editPlatform} onChange={(event) => setEditPlatform(event.target.value as "web" | "mobile" | "api")} disabled={readOnly}>
                <option value="web">web</option>
                <option value="mobile">mobile</option>
                <option value="api">api</option>
              </select>
            </label>
          </div>
          <div>
            <span className={labelCls}>Labels</span>
            <div className="flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-md border border-[#d1d5db] bg-white px-2 py-1.5">
              {editLabels.map((label) => (
                <span key={label} className="inline-flex items-center gap-1 rounded bg-[#f3f4f6] px-1.5 py-[2px] text-[11.5px] text-[#374151]">
                  {label}
                  <button type="button" aria-label={`Remove ${label}`} onClick={() => setEditLabels((prev) => prev.filter((value) => value !== label))} disabled={readOnly} className="text-[#9ca3af] hover:text-[#dc2626]">
                    <CqaIcon name="close" className="text-[12px]" />
                  </button>
                </span>
              ))}
              <input
                value={labelDraft}
                disabled={readOnly}
                onChange={(event) => setLabelDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addLabel();
                  }
                }}
                placeholder="Add a label"
                className="h-6 min-w-[120px] flex-1 border-0 px-1 text-[12.5px] outline-none placeholder:text-[#9ca3af]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#f0f1f3] pt-4">
            <button type="button" className={cqaBtnSecondary} onClick={() => setEditOpen(false)}>Cancel</button>
            <button type="submit" className={cqaBtnPrimary} disabled={readOnly || pending === "edit" || pending === "status" || !editName.trim()}>
              {pending === "edit" || pending === "status" ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={runOpen} onClose={() => setRunOpen(false)} title="Live" size="xl">
        <div className="overflow-hidden rounded-lg border border-[#1f2937] bg-[#0f172a]">
          <div className="flex items-center gap-2 border-b border-[#334155] px-4 py-2 text-[12px] text-[#cbd5e1]">
            <span className="size-2 rounded-full bg-[#ef4444]" />
            <span className="size-2 rounded-full bg-[#f59e0b]" />
            <span className="size-2 rounded-full bg-[#22c55e]" />
            <span className="ml-2 inline-flex items-center gap-1.5 rounded bg-[#1e293b] px-2 py-1 text-[11px] text-white">
              <CqaIcon name="play_circle" className="text-[13px] text-[#a78bfa]" /> Live
            </span>
            <span className="ml-auto font-mono text-[11px] text-[#94a3b8]">{runAutoFix ? "AUTO-FIX RERUN" : "STANDALONE RUN"}</span>
          </div>
          <div className="min-h-[320px] px-6 py-6">
            {runPhase === "preparing" ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-[#cbd5e1]">
                <span className="size-9 animate-spin rounded-full border-2 border-[#5b4ee8] border-t-transparent" />
                <p className="text-[13px]">Preparing simulator...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-[#e2e8f0]">
                  <span className="text-[14px] font-semibold">Run complete</span>
                  <span className="rounded bg-[#1e293b] px-2 py-0.5 text-[11px] text-[#cbd5e1]">{runLog.filter((line) => line.status === "passed").length}/{runLog.length} passed</span>
                  {runAutoFix && <span className="rounded bg-[#312e81] px-2 py-0.5 text-[11px] text-[#c7d2fe]">Auto-fix enabled</span>}
                </div>
                <ul className="max-h-[300px] space-y-1.5 overflow-y-auto">
                  {runLog.map((line) => (
                    <li key={line.step} className="flex items-start gap-2 rounded bg-[#1e293b]/60 px-2.5 py-2 text-[12px] text-[#cbd5e1]">
                      <CqaIcon
                        name={line.status === "passed" ? "check_circle" : line.status === "failed" ? "cancel" : "remove_circle"}
                        className={cn("mt-0.5 text-[15px]", line.status === "passed" ? "text-[#22c55e]" : line.status === "failed" ? "text-[#ef4444]" : "text-[#94a3b8]")}
                      />
                      <span className="w-7 shrink-0 text-[#94a3b8]">{line.step}.</span>
                      <span className="min-w-0 flex-1">{sentenceForStep({ id: String(line.step), action: line.action as StudioStep["action"], target: line.target, value: "", selector: "" }, data.variables, orgUrl)}</span>
                      {line.healed && <span className="rounded bg-[#78350f] px-1.5 py-[1px] text-[10px] text-[#fcd34d]">auto-healed</span>}
                    </li>
                  ))}
                  {runLog.length === 0 && <li className="px-2 py-4 text-center text-[12px] text-[#94a3b8]">Could not execute the steps. Check the error above and try again.</li>}
                </ul>
                <div className="flex justify-end gap-2 border-t border-[#334155] pt-4">
                  <button type="button" onClick={() => void executeRun(runAutoFix)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#475569] px-3 text-[12px] font-medium text-[#e2e8f0] hover:bg-[#1e293b]">
                    <CqaIcon name="refresh" className="text-[15px]" /> Run again
                  </button>
                  <button type="button" onClick={() => setRunOpen(false)} className="inline-flex h-8 items-center rounded-md bg-[#5b4ee8] px-3 text-[12px] font-medium text-white hover:bg-[#6d61ff]">
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
