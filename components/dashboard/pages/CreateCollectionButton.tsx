"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CqaIcon,
  Modal,
  cqaBtnPrimary,
  cqaBtnSecondary,
  cqaCard,
  cqaIconBtn,
  cqaInput,
  cqaLabel,
  useAction,
} from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

interface CaseOption {
  id: string;
  title: string;
  module: string;
  status: string;
}

interface SuiteOption {
  id: string;
  name: string;
  testCasesCount: number;
}

interface EnvironmentOption {
  id: string;
  name: string;
  isDefault: boolean;
}

const RICH_TOOLS: Array<{ icon: string; label: string }> = [
  { icon: "format_bold", label: "Bold" },
  { icon: "format_italic", label: "Italic" },
  { icon: "strikethrough_s", label: "Strikethrough" },
  { icon: "link", label: "Link" },
  { icon: "title", label: "Heading" },
  { icon: "format_quote", label: "Quote" },
  { icon: "code", label: "Code" },
  { icon: "format_list_bulleted", label: "Bullets" },
  { icon: "format_list_numbered", label: "Numbers" },
  { icon: "format_indent_decrease", label: "Decrease Level" },
  { icon: "format_indent_increase", label: "Increase Level" },
  { icon: "undo", label: "Undo" },
  { icon: "redo", label: "Redo" },
];

function RichToolbar() {
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 border-[#e5e7eb] bg-[#fafafa] px-2 py-1.5">
      {RICH_TOOLS.map((tool) => (
        <button
          key={tool.label}
          type="button"
          title={tool.label}
          aria-label={tool.label}
          onMouseDown={(event) => event.preventDefault()}
          className="rounded p-1 text-[#6b7280] transition hover:bg-[#f3f4f6] hover:text-[#374151]"
        >
          <CqaIcon name={tool.icon} className="text-[16px]" />
        </button>
      ))}
    </div>
  );
}

function StepBadge({ index, label, state }: { index: number; label: string; state: "done" | "active" | "todo" }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold",
          state === "active" ? "bg-[#5b4ee8] text-white" : state === "done" ? "bg-[#ece9fd] text-[#5b4ee8]" : "bg-[#f3f4f6] text-[#9ca3af]",
        )}
      >
        {index}
      </span>
      <span className={cn("text-[12.5px]", state === "active" ? "font-semibold text-[#111827]" : "text-[#6b7280]")}>{label}</span>
    </div>
  );
}

function LabelInput({
  labels,
  onChange,
  placeholder = "Search labels to add .....",
  disabled,
}: {
  labels: string[];
  onChange: (labels: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const next = draft.trim();
    if (!next || labels.includes(next)) return;
    onChange([...labels, next]);
    setDraft("");
  }
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-2 py-1 focus-within:border-[#a9a1f7]">
      {labels.map((label) => (
        <span key={label} className="inline-flex items-center gap-1 rounded bg-[#f3f4f6] px-1.5 py-[2px] text-[11.5px] text-[#374151]">
          {label}
          <button
            type="button"
            aria-label={`Remove ${label}`}
            onClick={() => onChange(labels.filter((value) => value !== label))}
            className="text-[#9ca3af] hover:text-[#dc2626]"
            disabled={disabled}
          >
            <CqaIcon name="close" className="text-[11px]" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
        placeholder={labels.length === 0 ? placeholder : ""}
        className="h-6 min-w-[130px] flex-1 border-0 px-1 text-[12.5px] outline-none placeholder:text-[#9ca3af]"
        disabled={disabled}
      />
    </div>
  );
}

function SwitchRow({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div>
        <p className="text-[13px] font-medium text-[#111827]">{label}</p>
        <p className="mt-0.5 text-[11.5px] leading-5 text-[#6b7280]">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={cn("relative mt-1 h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-[#5b4ee8]" : "bg-[#d1d5db]")}
      >
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </button>
    </div>
  );
}

export function CreateCollectionButton({
  kind,
  readOnly,
  label,
  defaultEmail = "",
}: {
  kind: "suites" | "test-plans";
  readOnly: boolean;
  label: string;
  defaultEmail?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={cqaBtnPrimary} onClick={() => setOpen(true)} disabled={readOnly}>
        <CqaIcon name="add" className="text-[17px]" />
        {label}
      </button>
      {kind === "suites" ? (
        <SuiteWizard open={open} onClose={() => setOpen(false)} readOnly={readOnly} />
      ) : (
        <PlanWizard open={open} onClose={() => setOpen(false)} readOnly={readOnly} defaultEmail={defaultEmail} />
      )}
    </>
  );
}

function SuiteWizard({ open, onClose, readOnly }: { open: boolean; onClose: () => void; readOnly: boolean }) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [folder, setFolder] = useState("Unorganized");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState<"Web" | "Mobile" | "API">("Web");
  const [labels, setLabels] = useState<string[]>([]);
  const [prerequisites, setPrerequisites] = useState<string[]>([]);
  const [showConfig, setShowConfig] = useState(true);
  const [showPrereqs, setShowPrereqs] = useState(false);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [caseSearch, setCaseSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/dashboard/test-cases", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { testCases: [] }))
      .then((data: { testCases?: CaseOption[] }) => {
        if (active) setCases(data.testCases ?? []);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open]);

  function reset() {
    setStep(1);
    setName("");
    setFolder("Unorganized");
    setDescription("");
    setPlatform("Web");
    setLabels([]);
    setPrerequisites([]);
    setShowConfig(true);
    setShowPrereqs(false);
    setSelectedCaseIds([]);
    setCaseSearch("");
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function create(includeCases: boolean) {
    const res = await run<{ item: { id: string } }>("suite", "/api/dashboard/collections/suites", {
      json: {
        name: name.trim(),
        description,
        schedule: "manual",
        module: folder === "Unorganized" ? "" : folder,
        platform,
        labels,
        prerequisites,
        testCaseIds: includeCases ? selectedCaseIds : [],
      },
    });
    if (res?.item) {
      close();
      router.refresh();
      router.push(`/dashboard/plans/suites/${res.item.id}`);
    }
  }

  const canCreate = name.trim().length >= 2;
  const folders = ["Unorganized", ...Array.from(new Set(cases.map((c) => c.module).filter(Boolean)))];
  const visibleCases = cases.filter((c) => {
    const query = caseSearch.trim().toLowerCase();
    if (!query) return true;
    return c.title.toLowerCase().includes(query) || c.module.toLowerCase().includes(query);
  });

  return (
    <Modal
      open={open}
      onClose={close}
      title="Create Test Suite"
      size="xl"
      footer={
        step === 1 ? (
          <>
            <button type="button" className={cqaBtnSecondary} onClick={close}>
              Cancel
            </button>
            <button type="button" className={cqaBtnSecondary} onClick={() => void create(false)} disabled={readOnly || !canCreate || pending === "suite"}>
              {pending === "suite" ? "Creating…" : "Skip & create empty"}
            </button>
            <button type="button" className={cqaBtnPrimary} onClick={() => setStep(2)} disabled={readOnly || !canCreate}>
              Add Test Cases
            </button>
          </>
        ) : (
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setStep(1)}>
              <CqaIcon name="arrow_back" className="text-[16px]" /> Back
            </button>
            <button type="button" className={cqaBtnPrimary} onClick={() => void create(true)} disabled={readOnly || !canCreate || pending === "suite"}>
              {pending === "suite" ? "Creating…" : "Create Test Suite"}
            </button>
          </>
        )
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <StepBadge index={1} label="Suite Basics" state={step === 1 ? "active" : "done"} />
        <span className="hidden h-px w-10 bg-[#e5e7eb] sm:block" />
        <StepBadge index={2} label="Add Test Cases" state={step === 2 ? "active" : "todo"} />
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <label className="block">
            <span className={cqaLabel}>Suite Name *</span>
            <input
              id="create-suite-name"
              className={cqaInput}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Checkout Flow, User Auth, Payment Tests"
              disabled={readOnly}
            />
          </label>

          <label className="block">
            <span className={cqaLabel}>Folder / Location</span>
            <select className={cqaInput} value={folder} onChange={(event) => setFolder(event.target.value)} disabled={readOnly}>
              {folders.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <div>
            <span className={cqaLabel}>Prerequisites (Optional)</span>
            <button
              type="button"
              onClick={() => setShowPrereqs((value) => !value)}
              className={cn(cqaInput, "flex items-center justify-between text-left")}
              disabled={readOnly}
            >
              <span className={prerequisites.length ? "text-[#111827]" : "text-[#9ca3af]"}>
                {prerequisites.length ? `${prerequisites.length} selected` : "Select Prerequisites"}
              </span>
              <CqaIcon name={showPrereqs ? "expand_less" : "expand_more"} className="text-[18px] text-[#6b7280]" />
            </button>
            {showPrereqs && (
              <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-[#e5e7eb] bg-white shadow-sm">
                {cases.length === 0 && <p className="px-3 py-2 text-[12px] text-[#9ca3af]">No test cases available.</p>}
                {cases.map((candidate) => (
                  <label key={candidate.id} className="flex cursor-pointer items-start gap-2 border-b border-[#f3f4f6] px-3 py-2 last:border-0 hover:bg-[#fafafa]">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-3.5 accent-[#5b4ee8]"
                      checked={prerequisites.includes(candidate.id)}
                      onChange={() =>
                        setPrerequisites((prev) => (prev.includes(candidate.id) ? prev.filter((id) => id !== candidate.id) : [...prev, candidate.id]))
                      }
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] text-[#374151]">{candidate.title}</span>
                      <span className="block text-[11px] text-[#9ca3af]">{candidate.module || "Unorganised"}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <p className="mt-1 text-[11.5px] leading-5 text-[#6b7280]">
              Steps or conditions that must be completed before this test runs (e.g., &quot;User is logged in&quot;).
            </p>
          </div>

          <div>
            <span className={cqaLabel}>Labels (Optional)</span>
            <LabelInput labels={labels} onChange={setLabels} disabled={readOnly} />
          </div>

          <button
            type="button"
            onClick={() => setShowConfig((value) => !value)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#5b4ee8] hover:underline"
          >
            <CqaIcon name="tune" className="text-[15px]" />
            {showConfig ? "Hide Configuration Options" : "Show Configuration Options"}
            <CqaIcon name={showConfig ? "expand_less" : "expand_more"} className="text-[15px]" />
          </button>

          {showConfig && (
            <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3.5">
              <span className={cqaLabel}>Select Target Platform</span>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { value: "Web", icon: "desktop_windows", label: "Web App" },
                  { value: "Mobile", icon: "mobile_2", label: "Mobile" },
                  { value: "API", icon: "api", label: "API" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-[12.5px] transition",
                      platform === option.value ? "border-[#5b4ee8] bg-[#f5f3ff] font-medium text-[#5b4ee8]" : "border-[#e5e7eb] text-[#374151] hover:border-[#b9b1fb]",
                    )}
                  >
                    <input
                      type="radio"
                      name="suite-platform"
                      value={option.value}
                      checked={platform === option.value}
                      onChange={() => setPlatform(option.value as "Web" | "Mobile" | "API")}
                      className="sr-only"
                      disabled={readOnly}
                    />
                    <CqaIcon name={option.icon} className="text-[18px]" />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className={cqaLabel}>Description</span>
            <textarea
              className="min-h-[90px] w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px] outline-none focus:border-[#a9a1f7]"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Explain what test suite does"
              disabled={readOnly}
            />
          </label>

          <div className="flex items-start gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3.5 py-2.5 text-[12px] text-[#4b5563]">
            <CqaIcon name="info" className="mt-0.5 text-[16px] text-[#5b4ee8]" />
            Next, you&apos;ll add test cases. You can also create the suite empty and add cases later.
          </div>
          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-[14px] font-semibold text-[#111827]">Add test cases to {name.trim()}</p>
            <p className="mt-0.5 text-[12px] text-[#6b7280]">Select the cases that should run as part of this suite. You can change this later.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[17px] text-[#9ca3af]" />
              <input
                className={cn(cqaInput, "pl-8")}
                value={caseSearch}
                onChange={(event) => setCaseSearch(event.target.value)}
                placeholder="Search test cases"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-[12.5px] text-[#374151]">
              <input
                type="checkbox"
                className="size-3.5 accent-[#5b4ee8]"
                checked={visibleCases.length > 0 && visibleCases.every((c) => selectedCaseIds.includes(c.id))}
                onChange={(event) =>
                  setSelectedCaseIds((prev) =>
                    event.target.checked
                      ? Array.from(new Set([...prev, ...visibleCases.map((c) => c.id)]))
                      : prev.filter((id) => !visibleCases.some((c) => c.id === id)),
                  )
                }
              />
              Select all
            </label>
            <span className="text-[12px] text-[#6b7280]">{selectedCaseIds.length} selected</span>
          </div>
          <div className="max-h-[360px] overflow-y-auto rounded-lg border border-[#e5e7eb]">
            {visibleCases.length === 0 && <p className="px-4 py-8 text-center text-[12.5px] text-[#9ca3af]">No test cases match your search.</p>}
            {visibleCases.map((candidate) => (
              <label key={candidate.id} className="flex cursor-pointer items-start gap-2.5 border-b border-[#f3f4f6] px-3.5 py-2.5 last:border-0 hover:bg-[#fafafa]">
                <input
                  type="checkbox"
                  className="mt-0.5 size-3.5 accent-[#5b4ee8]"
                  checked={selectedCaseIds.includes(candidate.id)}
                  onChange={() =>
                    setSelectedCaseIds((prev) => (prev.includes(candidate.id) ? prev.filter((id) => id !== candidate.id) : [...prev, candidate.id]))
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-[#1f2937]">{candidate.title}</span>
                  <span className="mt-0.5 block text-[11px] text-[#6b7280]">
                    {candidate.module || "Unorganised"} · {candidate.status}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

const MACHINE_PRESETS = [
  { id: "desktop-chromium", label: "Desktop · Chromium", viewport: "Desktop", browser: "Chromium", icon: "desktop_windows" },
  { id: "desktop-firefox", label: "Desktop · Firefox", viewport: "Desktop", browser: "Firefox", icon: "desktop_windows" },
  { id: "laptop-chromium", label: "Laptop · Chromium", viewport: "Laptop", browser: "Chromium", icon: "laptop_windows" },
  { id: "tablet-webkit", label: "Tablet · WebKit", viewport: "Tablet", browser: "WebKit", icon: "tablet_mac" },
  { id: "mobile-chromium", label: "Mobile · Chromium", viewport: "Mobile", browser: "Chromium", icon: "smartphone" },
  { id: "mobile-webkit", label: "Mobile · WebKit", viewport: "Mobile", browser: "WebKit", icon: "smartphone" },
];

const VIEWPORTS = [
  { value: "desktop", label: "Desktop", icon: "desktop_windows" },
  { value: "laptop", label: "Laptop", icon: "laptop_windows" },
  { value: "tablet", label: "Tablet", icon: "tablet_mac" },
  { value: "mobile", label: "Mobile", icon: "smartphone" },
];

const RESOLUTIONS = ["Full HD (1920×1080)", "HD (1280×720)", "QHD (2560×1440)", "4K UHD (3840×2160)"];

const DEFAULT_RECOVERY = {
  majorStepFailure: "abort",
  stepPrereqFailure: "continue",
  testCasePrereqFailure: "abort_plan",
  testCaseAbort: "reuse_session",
  suitePrereqFailure: "stop",
};

function PlanWizard({ open, onClose, readOnly, defaultEmail }: { open: boolean; onClose: () => void; readOnly: boolean; defaultEmail: string }) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [hideOnDashboard, setHideOnDashboard] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);
  const [viewport, setViewport] = useState("desktop");
  const [resolution, setResolution] = useState(RESOLUTIONS[0]);
  const [machines, setMachines] = useState<string[]>([]);
  const [showMachines, setShowMachines] = useState(false);
  const [suites, setSuites] = useState<SuiteOption[]>([]);
  const [suiteIds, setSuiteIds] = useState<string[]>([]);
  const [showSuites, setShowSuites] = useState(false);
  const [environments, setEnvironments] = useState<EnvironmentOption[]>([]);
  const [environment, setEnvironment] = useState("default_environment");
  const [parallelNodes, setParallelNodes] = useState(1);
  const [captureScreenshots, setCaptureScreenshots] = useState("None");
  const [pageLoadTimeout, setPageLoadTimeout] = useState(30);
  const [elementTimeout, setElementTimeout] = useState(30);
  const [showScrollbars, setShowScrollbars] = useState(false);
  const [clickPressHold, setClickPressHold] = useState(false);
  const [showProxy, setShowProxy] = useState(false);
  const [notificationEmails, setNotificationEmails] = useState<string[]>(defaultEmail ? [defaultEmail] : []);
  const [emailDraft, setEmailDraft] = useState("");
  const [recovery, setRecovery] = useState(DEFAULT_RECOVERY);
  const [stepError, setStepError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.all([
      fetch("/api/dashboard/collections/suites", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : { items: [] }))
        .catch(() => ({ items: [] })),
      fetch("/api/dashboard/environments", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : { environments: [] }))
        .catch(() => ({ environments: [] })),
    ]).then(([suiteData, envData]: [{ items?: SuiteOption[] }, { environments?: EnvironmentOption[] }]) => {
      if (!active) return;
      setSuites(suiteData.items ?? []);
      const envs = envData.environments ?? [];
      setEnvironments(envs);
      setEnvironment(envs.find((env) => env.isDefault)?.name ?? envs[0]?.name ?? "default_environment");
    });
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (open && defaultEmail) setNotificationEmails((prev) => (prev.length ? prev : [defaultEmail]));
  }, [open, defaultEmail]);

  function reset() {
    setStep(1);
    setName("");
    setDescription("");
    setLabels([]);
    setHideOnDashboard(false);
    setSendNotification(true);
    setViewport("desktop");
    setResolution(RESOLUTIONS[0]);
    setMachines([]);
    setShowMachines(false);
    setSuiteIds([]);
    setShowSuites(false);
    setEnvironment(environments.find((env) => env.isDefault)?.name ?? environments[0]?.name ?? "default_environment");
    setParallelNodes(1);
    setCaptureScreenshots("None");
    setPageLoadTimeout(30);
    setElementTimeout(30);
    setShowScrollbars(false);
    setClickPressHold(false);
    setShowProxy(false);
    setNotificationEmails(defaultEmail ? [defaultEmail] : []);
    setEmailDraft("");
    setRecovery(DEFAULT_RECOVERY);
    setStepError("");
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  function addEmail() {
    const next = emailDraft.trim();
    if (!next || notificationEmails.includes(next) || !next.includes("@")) return;
    setNotificationEmails((prev) => [...prev, next]);
    setEmailDraft("");
  }

  function nextFromStep2() {
    if (machines.length === 0) {
      setStepError("Test Machine is required.");
      return;
    }
    if (suiteIds.length === 0) {
      setStepError("Add at least one Test Suite to this Test Plan.");
      return;
    }
    setStepError("");
    setStep(3);
  }

  async function create() {
    const selectedMachines = MACHINE_PRESETS.filter((machine) => machines.includes(machine.id));
    const browsers = Array.from(new Set(selectedMachines.map((machine) => machine.browser)));
    const settings = {
      labels,
      viewport,
      resolution,
      hideOnDashboard,
      sendNotification,
      notificationEmails,
      machines: selectedMachines.map((machine) => ({ viewport: machine.viewport, browser: machine.browser })),
      parallelNodes,
      captureScreenshots,
      pageLoadTimeout,
      elementTimeout,
      knowledgeBaseId: "",
      environment,
      showScrollbars,
      clickPressHold,
      proxyId: "",
      remoteBrowserId: "",
      recovery,
    };
    const res = await run<{ item: { id: string } }>("plan", "/api/dashboard/collections/test-plans", {
      json: {
        name: name.trim(),
        description,
        schedule: "manual",
        module: "",
        environment,
        labels,
        suiteIds,
        browsers: browsers.length ? browsers : ["Chromium"],
        settings,
      },
    });
    if (res?.item) {
      close();
      router.refresh();
      router.push(`/dashboard/plans/test-plans/${res.item.id}`);
    }
  }

  const canContinue = name.trim().length >= 2;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Create Test Plan"
      size="xl"
      footer={
        step === 1 ? (
          <>
            <button type="button" className={cqaBtnSecondary} onClick={close}>
              Cancel
            </button>
            <button type="button" className={cqaBtnPrimary} onClick={() => setStep(2)} disabled={readOnly || !canContinue}>
              Next <CqaIcon name="arrow_forward" className="text-[16px]" />
            </button>
          </>
        ) : step === 2 ? (
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setStep(1)}>
              <CqaIcon name="arrow_back" className="text-[16px]" /> Previous
            </button>
            <button type="button" className={cqaBtnPrimary} onClick={nextFromStep2}>
              Next <CqaIcon name="arrow_forward" className="text-[16px]" />
            </button>
          </>
        ) : (
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setStep(2)}>
              <CqaIcon name="arrow_back" className="text-[16px]" /> Previous
            </button>
            <button type="button" className={cqaBtnPrimary} onClick={() => void create()} disabled={readOnly || pending === "plan"}>
              {pending === "plan" ? "Creating…" : "Create Test Plan"}
            </button>
          </>
        )
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <StepBadge index={1} label="Create Test Plan" state={step === 1 ? "active" : "done"} />
        <span className="hidden h-px w-6 bg-[#e5e7eb] sm:block" />
        <StepBadge index={2} label="Test Machines & Suites Selection" state={step === 2 ? "active" : step === 3 ? "done" : "todo"} />
        <span className="hidden h-px w-6 bg-[#e5e7eb] sm:block" />
        <StepBadge index={3} label="Test Plan Settings" state={step === 3 ? "active" : "todo"} />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <label className="block">
            <span className={cqaLabel}>Test Plan Name *</span>
            <input
              id="testPlanName"
              className={cqaInput}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter test plan name"
              disabled={readOnly}
            />
          </label>

          <div>
            <span className={cqaLabel}>Labels (Optional)</span>
            <LabelInput labels={labels} onChange={setLabels} placeholder="Add label" disabled={readOnly} />
          </div>

          <div>
            <span className={cqaLabel}>Description (Optional)</span>
            <RichToolbar />
            <textarea
              className="min-h-[90px] w-full rounded-b-lg border border-[#e5e7eb] px-3 py-2 text-[13px] outline-none focus:border-[#a9a1f7]"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what this plan covers"
              disabled={readOnly}
            />
          </div>

          <div className="divide-y divide-[#f0f1f3] rounded-lg border border-[#e5e7eb] px-3.5">
            <SwitchRow
              checked={hideOnDashboard}
              onChange={setHideOnDashboard}
              label="Hide on Dashboard"
              description="This test plan will not be visible on the dashboard"
              disabled={readOnly}
            />
            <div>
              <SwitchRow
                checked={sendNotification}
                onChange={setSendNotification}
                label="Send Notification"
                description="Send email and Slack notifications when test plan runs"
                disabled={readOnly}
              />
              <p className="-mt-1 pb-2.5 pl-0 text-[11.5px] leading-5 text-[#6b7280]">
                When enabled, each test plan run sends a notification by email and to your connected Slack channel.
              </p>
            </div>
          </div>

          <div>
            <span className={cqaLabel}>Viewport *</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {VIEWPORTS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-[12.5px] transition",
                    viewport === option.value ? "border-[#5b4ee8] bg-[#f5f3ff] font-medium text-[#5b4ee8]" : "border-[#e5e7eb] text-[#374151] hover:border-[#b9b1fb]",
                  )}
                >
                  <input
                    type="radio"
                    name="plan-viewport"
                    value={option.value}
                    checked={viewport === option.value}
                    onChange={() => setViewport(option.value)}
                    className="sr-only"
                    disabled={readOnly}
                  />
                  <CqaIcon name={option.icon} className="text-[18px]" />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <label className="block">
            <span className={cqaLabel}>Resolution *</span>
            <select className={cqaInput} value={resolution} onChange={(event) => setResolution(event.target.value)} disabled={readOnly}>
              {RESOLUTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[#e5e7eb] bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-[#f0f1f3] px-4 py-3">
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#111827]">
                  <span className="text-[#dc2626]">*</span> Test Machines/Devices
                </span>
                <button type="button" className={cqaBtnSecondary} onClick={() => setShowMachines((value) => !value)} disabled={readOnly}>
                  <CqaIcon name="add" className="text-[15px]" /> Add Machine/Device
                </button>
              </div>
              <div className="px-4 py-3">
                {machines.length === 0 ? (
                  <p className="py-6 text-center text-[12px] leading-5 text-[#6b7280]">Select Test Suites from the right and click &apos;Add Machine/Device&apos;</p>
                ) : (
                  <div className="space-y-2">
                    {MACHINE_PRESETS.filter((machine) => machines.includes(machine.id)).map((machine) => (
                      <div key={machine.id} className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-3 py-2">
                        <CqaIcon name={machine.icon} className="text-[17px] text-[#5b4ee8]" />
                        <span className="flex-1 text-[12.5px] text-[#374151]">{machine.label}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${machine.label}`}
                          onClick={() => setMachines((prev) => prev.filter((id) => id !== machine.id))}
                          className="text-[#9ca3af] hover:text-[#dc2626]"
                        >
                          <CqaIcon name="close" className="text-[15px]" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {showMachines && (
                  <div className="mt-3 rounded-lg border border-[#e5e7eb] bg-white shadow-sm">
                    {MACHINE_PRESETS.map((machine) => (
                      <button
                        key={machine.id}
                        type="button"
                        onClick={() => {
                          setMachines((prev) => (prev.includes(machine.id) ? prev.filter((id) => id !== machine.id) : [...prev, machine.id]));
                          setShowMachines(false);
                          setStepError("");
                        }}
                        className="flex w-full items-center gap-2 border-b border-[#f3f4f6] px-3 py-2 text-left text-[12.5px] text-[#374151] last:border-0 hover:bg-[#fafafa]"
                      >
                        <CqaIcon name={machine.icon} className="text-[16px] text-[#6b7280]" />
                        {machine.label}
                        {machines.includes(machine.id) && <CqaIcon name="check" className="ml-auto text-[16px] text-[#5b4ee8]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#e5e7eb] bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-[#f0f1f3] px-4 py-3">
                <span className="text-[13px] font-semibold text-[#111827]">Test Suites</span>
                <button type="button" className={cqaBtnSecondary} onClick={() => setShowSuites((value) => !value)} disabled={readOnly}>
                  <CqaIcon name="playlist_add" className="text-[15px]" /> Add Test Suites
                </button>
              </div>
              <div className="px-4 py-3">
                {suiteIds.length === 0 ? (
                  <p className="py-6 text-center text-[12px] leading-5 text-[#6b7280]">Click Add Test Suites to add Test Suites to this Test Plan</p>
                ) : (
                  <div className="space-y-2">
                    {suites
                      .filter((suite) => suiteIds.includes(suite.id))
                      .map((suite) => (
                        <div key={suite.id} className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-3 py-2">
                          <CqaIcon name="folder_copy" className="text-[17px] text-[#5b4ee8]" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] text-[#374151]">{suite.name}</span>
                            <span className="block text-[11px] text-[#9ca3af]">{suite.testCasesCount} cases</span>
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${suite.name}`}
                            onClick={() => setSuiteIds((prev) => prev.filter((id) => id !== suite.id))}
                            className="text-[#9ca3af] hover:text-[#dc2626]"
                          >
                            <CqaIcon name="close" className="text-[15px]" />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
                {showSuites && (
                  <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-[#e5e7eb] bg-white shadow-sm">
                    {suites.length === 0 && <p className="px-3 py-3 text-[12px] text-[#9ca3af]">No test suites yet.</p>}
                    {suites.map((suite) => (
                      <label key={suite.id} className="flex cursor-pointer items-start gap-2 border-b border-[#f3f4f6] px-3 py-2 last:border-0 hover:bg-[#fafafa]">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-3.5 accent-[#5b4ee8]"
                          checked={suiteIds.includes(suite.id)}
                          onChange={() => {
                            setSuiteIds((prev) => (prev.includes(suite.id) ? prev.filter((id) => id !== suite.id) : [...prev, suite.id]));
                            setStepError("");
                          }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] text-[#374151]">{suite.name}</span>
                          <span className="block text-[11px] text-[#9ca3af]">{suite.testCasesCount} cases</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {stepError && (
            <p className="inline-flex items-center gap-1.5 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] text-[#dc2626]">
              <CqaIcon name="error" className="text-[16px]" /> {stepError}
            </p>
          )}
          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#e5e7eb] bg-white">
            <div className="flex items-center gap-2 border-b border-[#f0f1f3] px-4 py-3">
              <CqaIcon name="settings" className="text-[18px] text-[#6b7280]" />
              <span className="text-[13px] font-semibold text-[#111827]">Execution Settings</span>
            </div>
            <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
              <div>
                <span className={cqaLabel}>PARALLEL NODES</span>
                <div className="flex items-center gap-2">
                  <button type="button" className={cqaIconBtn} onClick={() => setParallelNodes((value) => Math.max(1, value - 1))} aria-label="Decrease parallel nodes">
                    <CqaIcon name="remove" className="text-[17px]" />
                  </button>
                  <span className="w-8 text-center text-[13px] font-medium text-[#111827]">{parallelNodes}</span>
                  <button type="button" className={cqaIconBtn} onClick={() => setParallelNodes((value) => Math.min(100, value + 1))} aria-label="Increase parallel nodes">
                    <CqaIcon name="add" className="text-[17px]" />
                  </button>
                  <span className="text-[11.5px] text-[#9ca3af]">of 100 max</span>
                </div>
              </div>
              <label className="block">
                <span className={cqaLabel}>CAPTURE SCREENSHOTS</span>
                <select className={cqaInput} value={captureScreenshots} onChange={(event) => setCaptureScreenshots(event.target.value)}>
                  {["None", "On failure", "Always"].map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={cqaLabel}>PAGE LOAD TIMEOUT (S)</span>
                <input type="number" min={1} max={300} className={cqaInput} value={pageLoadTimeout} onChange={(event) => setPageLoadTimeout(Number(event.target.value))} />
              </label>
              <label className="block">
                <span className={cqaLabel}>ELEMENT TIMEOUT (S)</span>
                <input type="number" min={1} max={300} className={cqaInput} value={elementTimeout} onChange={(event) => setElementTimeout(Number(event.target.value))} />
              </label>
              <label className="block">
                <span className={cqaLabel}>KNOWLEDGE BASE</span>
                <select className={cqaInput} value="" onChange={() => undefined}>
                  <option value="">None</option>
                </select>
              </label>
              <label className="block">
                <span className={cqaLabel}>ENVIRONMENT</span>
                <select className={cqaInput} value={environment} onChange={(event) => setEnvironment(event.target.value)}>
                  {environments.length === 0 && <option value="default_environment">default_environment</option>}
                  {environments.map((env) => (
                    <option key={env.id} value={env.name}>
                      {env.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="divide-y divide-[#f0f1f3] border-t border-[#f0f1f3] px-4">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#374151]">
                  SHOW SCROLLBARS DURING TEST RUNS <CqaIcon name="info" className="text-[14px] text-[#9ca3af]" />
                </span>
                <span className="inline-flex items-center gap-2 text-[11.5px] text-[#6b7280]">
                  Org Level ({String(showScrollbars)})
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showScrollbars}
                    aria-label="Show scrollbars during test runs"
                    onClick={() => setShowScrollbars((value) => !value)}
                    className={cn("relative h-5 w-9 rounded-full transition", showScrollbars ? "bg-[#5b4ee8]" : "bg-[#d1d5db]")}
                  >
                    <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", showScrollbars ? "left-[18px]" : "left-0.5")} />
                  </button>
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#374151]">
                  ENABLE CLICK PRESS HOLD <CqaIcon name="info" className="text-[14px] text-[#9ca3af]" />
                </span>
                <span className="inline-flex items-center gap-2 text-[11.5px] text-[#6b7280]">
                  Org Level ({String(clickPressHold)})
                  <button
                    type="button"
                    role="switch"
                    aria-checked={clickPressHold}
                    aria-label="Enable click press hold"
                    onClick={() => setClickPressHold((value) => !value)}
                    className={cn("relative h-5 w-9 rounded-full transition", clickPressHold ? "bg-[#5b4ee8]" : "bg-[#d1d5db]")}
                  >
                    <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", clickPressHold ? "left-[18px]" : "left-0.5")} />
                  </button>
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#e5e7eb] bg-white">
            <button type="button" onClick={() => setShowProxy((value) => !value)} className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left">
              <span>
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#111827]">
                  <CqaIcon name="tune" className="text-[17px] text-[#6b7280]" /> Proxy &amp; Remote Browser Settings
                </span>
                <span className="mt-0.5 block text-[11.5px] text-[#6b7280]">Route execution through a proxy or an external browser endpoint</span>
              </span>
              <CqaIcon name={showProxy ? "expand_less" : "expand_more"} className="mt-1 text-[18px] text-[#6b7280]" />
            </button>
            {showProxy && (
              <div className="grid gap-3 border-t border-[#f0f1f3] px-4 py-3 sm:grid-cols-2">
                <label className="block">
                  <span className={cqaLabel}>PROXY</span>
                  <select className={cqaInput} value="" onChange={() => undefined}>
                    <option value="">None</option>
                  </select>
                </label>
                <label className="block">
                  <span className={cqaLabel}>REMOTE BROWSER</span>
                  <select className={cqaInput} value="" onChange={() => undefined}>
                    <option value="">None</option>
                  </select>
                </label>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#e5e7eb] bg-white">
            <div className="flex items-center gap-2 border-b border-[#f0f1f3] px-4 py-3">
              <CqaIcon name="notifications_none" className="text-[18px] text-[#6b7280]" />
              <span className="text-[13px] font-semibold text-[#111827]">Notifications</span>
            </div>
            <div className="divide-y divide-[#f0f1f3] px-4">
              <SwitchRow checked={hideOnDashboard} onChange={setHideOnDashboard} label="Hide on Dashboard" description="This test plan will not be visible on the dashboard" />
              <SwitchRow checked={sendNotification} onChange={setSendNotification} label="Send Notification" description="Send email notifications when test plan runs" />
            </div>
            <div className="border-t border-[#f0f1f3] px-4 py-3">
              <span className={cqaLabel}>NOTIFICATION EMAILS</span>
              <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-2 py-1">
                {notificationEmails.map((email) => (
                  <span key={email} className="inline-flex items-center gap-1 rounded bg-[#f3f4f6] px-1.5 py-[2px] text-[11.5px] text-[#374151]">
                    {email}
                    <button type="button" aria-label={`Remove ${email}`} onClick={() => setNotificationEmails((prev) => prev.filter((value) => value !== email))} className="text-[#9ca3af] hover:text-[#dc2626]">
                      <CqaIcon name="close" className="text-[11px]" />
                    </button>
                  </span>
                ))}
                <input
                  value={emailDraft}
                  onChange={(event) => setEmailDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addEmail();
                    }
                  }}
                  placeholder="name@company.com"
                  className="h-6 min-w-[160px] flex-1 border-0 px-1 text-[12.5px] outline-none placeholder:text-[#9ca3af]"
                />
                <button type="button" aria-label="Add notification email" onClick={addEmail} className="text-[#5b4ee8] hover:text-[#4338ca]">
                  <CqaIcon name="add" className="text-[17px]" />
                </button>
              </div>
              <p className="mt-1 text-[11.5px] text-[#6b7280]">Press Enter or click + to add. Saved as a comma-separated list.</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#e5e7eb] bg-white">
            <div className="flex items-center gap-2 border-b border-[#f0f1f3] px-4 py-3">
              <CqaIcon name="warning_amber" className="text-[18px] text-[#d97706]" />
              <span className="text-[13px] font-semibold text-[#111827]">Recovery Actions</span>
            </div>
            <div className="divide-y divide-[#f0f1f3] px-4">
              {(
                [
                  ["On Major Step Failure", "majorStepFailure", [["abort", "Abort and run next Test Case"], ["continue", "Report and continue next step"]]],
                  ["On Step Pre-Req Failure", "stepPrereqFailure", [["abort", "Abort and run next Test Case"], ["continue", "Report and continue next step"]]],
                  ["On Test Case Pre-Req Failure", "testCasePrereqFailure", [["abort_plan", "Abort Test Plan"], ["continue_case", "Report and continue next case"]]],
                  ["On Test Case Abort", "testCaseAbort", [["reuse_session", "Delete cookies, reuse session"], ["new_session", "Start with new session"]]],
                  ["On Suite Pre-Req Failure", "suitePrereqFailure", [["stop", "Stop Execution"], ["continue_suite", "Report and continue next suite"]]],
                ] as const
              ).map(([label, key, options]) => (
                <div key={key} className="grid gap-2 py-3 md:grid-cols-[240px_1fr]">
                  <p className="text-[13px] font-medium text-[#374151]">{label}</p>
                  <div className="space-y-1.5">
                    {options.map(([value, copy]) => (
                      <label key={value} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-[#4a5565]">
                        <input
                          type="radio"
                          name={`plan-${key}`}
                          className="size-4 accent-[#5b4ee8]"
                          checked={recovery[key] === value}
                          onChange={() => setRecovery((prev) => ({ ...prev, [key]: value }))}
                        />
                        {copy}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
