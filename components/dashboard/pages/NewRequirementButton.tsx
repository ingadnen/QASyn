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

type Method = "integrations" | "file" | "crawl";

const METHODS: Array<{
  key: Method;
  icon: string;
  title: string;
  description: string;
}> = [
  {
    key: "integrations",
    icon: "hub",
    title: "Generate from Integrations",
    description: "Pull tickets and work items from Jira, Azure DevOps and more, and turn them into test cases.",
  },
  {
    key: "file",
    icon: "upload_file",
    title: "Generate from File",
    description: "Upload a specification, PRD or spreadsheet and let AI write the test cases for it.",
  },
  {
    key: "crawl",
    icon: "travel_explore",
    title: "Generate from Crawl",
    description: "Let an AI agent walk your live application and build test cases from what it finds.",
  },
];

function nextRequirementCode(codes: string[]): string {
  let max = 0;
  for (const code of codes) {
    const digits = code.match(/(\d+)$/)?.[1];
    if (digits) max = Math.max(max, Number(digits));
  }
  return `REQ-${String(max + 1).padStart(3, "0")}`;
}

export function NewRequirementButton({ readOnly, defaultUrl }: { readOnly: boolean; defaultUrl: string }) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [method, setMethod] = useState<Method>("integrations");
  const [code, setCode] = useState("REQ-001");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("Jira");
  const [workItem, setWorkItem] = useState("");
  const [file, setFile] = useState("");
  const [targetUrl, setTargetUrl] = useState(defaultUrl);
  const [explorePrompt, setExplorePrompt] = useState("");
  const [requireApproval, setRequireApproval] = useState(true);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/dashboard/requirements", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { requirements: [] }))
      .then((data: { requirements?: Array<{ code: string }> }) => {
        if (active) setCode(nextRequirementCode((data.requirements ?? []).map((r) => r.code)));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open]);

  function reset() {
    setStep(1);
    setMethod("integrations");
    setTitle("");
    setSource("Jira");
    setWorkItem("");
    setFile("");
    setTargetUrl(defaultUrl);
    setExplorePrompt("");
    setRequireApproval(true);
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function choose(next: Method) {
    setMethod(next);
    setStep(2);
    setError(null);
  }

  async function submit() {
    if (method === "crawl") {
      const res = await run<{ crawl?: { id: string } }>("requirement", "/api/dashboard/crawl", {
        json: {
          targetUrl,
          explorePrompt,
          requirementName: title || undefined,
          publishMode: requireApproval ? "Require approval" : "Auto publish",
          createSuite: !requireApproval,
          createPlan: !requireApproval,
        },
      });
      if (res) {
        close();
        router.refresh();
        if (res.crawl?.id) router.push(`/dashboard/crawl/${res.crawl.id}`);
      }
      return;
    }
    const res = await run("requirement", "/api/dashboard/requirements", {
      json: {
        code,
        title: title.trim(),
        source: method === "integrations" ? source.toLowerCase() : "doc",
      },
    });
    if (res) {
      close();
      router.refresh();
    }
  }

  const canSubmit = title.trim().length >= 2 && (method !== "crawl" || targetUrl.trim().length > 0);
  const methodLabel = METHODS.find((m) => m.key === method)?.title ?? "New Requirement";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cqaBtnPrimary}>
        <CqaIcon name="add" className="text-[17px]" />
        New Requirement
      </button>
      <Modal
        open={open}
        onClose={close}
        title="New Requirement"
        size="xl"
        footer={
          step === 1 ? (
            <button type="button" className={cqaBtnSecondary} onClick={close}>
              Cancel
            </button>
          ) : (
            <>
              <button
                type="button"
                className={cqaBtnSecondary}
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
              >
                <CqaIcon name="arrow_back" className="text-[16px]" /> Back
              </button>
              <button type="button" className={cqaBtnPrimary} onClick={() => void submit()} disabled={readOnly || !canSubmit || pending === "requirement"}>
                {pending === "requirement" ? "Generating…" : method === "crawl" ? "Start Crawl" : "Generate Requirement"}
              </button>
            </>
          )
        }
      >
        {step === 1 ? (
          <div>
            <p className="max-w-2xl text-[13px] text-[#6b7280]">Choose the method that fits your workflow. You can always switch later.</p>
            <span className="mt-3 inline-flex items-center rounded-full border border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-1 text-[11.5px] font-medium text-[#4b5563]">
              Step 1 of 2
            </span>
            <p className="mt-5 text-[14px] font-semibold text-[#111827]">Choose how you&apos;d like to generate your test cases.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {METHODS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => choose(option.key)}
                  className={cn(cqaCard, "group flex h-full flex-col p-4 text-left transition hover:border-[#b9b1fb] hover:shadow-[0_6px_20px_rgba(91,78,232,0.10)]")}
                >
                  <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[#f5f3ff] text-[#5b4ee8]">
                    <CqaIcon name={option.icon} className="text-[21px]" />
                  </span>
                  <span className="mt-3 text-[13.5px] font-semibold text-[#111827]">{option.title}</span>
                  <span className="mt-1.5 flex-1 text-[12px] leading-5 text-[#6b7280]">{option.description}</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-[#5b4ee8]">
                    Get started <CqaIcon name="arrow_forward" className="text-[15px] transition group-hover:translate-x-0.5" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={cqaIconBtn} onClick={() => setStep(1)} aria-label="Back to methods">
                <CqaIcon name="arrow_back" className="text-[18px]" />
              </button>
              <div>
                <p className="text-[14px] font-semibold text-[#111827]">{methodLabel}</p>
                <p className="mt-0.5 text-[12px] text-[#6b7280]">Provide the source details and AI will draft the requirement and its test cases.</p>
              </div>
              <span className="ml-auto inline-flex items-center rounded-full border border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-1 text-[11.5px] font-medium text-[#4b5563]">
                Step 2 of 2
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {method === "integrations" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={cqaLabel}>Integration</span>
                    <select className={cqaInput} value={source} onChange={(e) => setSource(e.target.value)} disabled={readOnly}>
                      <option>Jira</option>
                      <option>Azure DevOps</option>
                      <option>Linear</option>
                      <option>GitHub Issues</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className={cqaLabel}>Work item key</span>
                    <input className={cqaInput} value={workItem} onChange={(e) => setWorkItem(e.target.value)} placeholder="e.g. PROJ-142" disabled={readOnly} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={cqaLabel}>Requirement name *</span>
                    <input
                      className={cqaInput}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={workItem ? `${workItem} · Describe the requirement` : "Describe the requirement"}
                      disabled={readOnly}
                    />
                  </label>
                </div>
              )}

              {method === "file" && (
                <div className="space-y-3">
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d1d5db] bg-[#fafafa] px-6 py-8 text-center transition hover:border-[#a9a1f7] hover:bg-[#faf9ff]">
                    <CqaIcon name="cloud_upload" className="text-[28px] text-[#5b4ee8]" />
                    <span className="mt-2 text-[13px] font-medium text-[#374151]">{file || "Click to upload or drag and drop"}</span>
                    <span className="mt-1 text-[11.5px] text-[#9ca3af]">PDF, DOCX, XLSX, CSV or TXT · Max 20MB</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md"
                      className="sr-only"
                      onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")}
                      disabled={readOnly}
                    />
                  </label>
                  <label className="block">
                    <span className={cqaLabel}>Requirement name *</span>
                    <input className={cqaInput} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Checkout specification" disabled={readOnly} />
                  </label>
                </div>
              )}

              {method === "crawl" && (
                <div className="space-y-3">
                  <label className="block">
                    <span className={cqaLabel}>Target URL</span>
                    <input className={cqaInput} value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://staging.your-domain.com" disabled={readOnly} />
                  </label>
                  <label className="block">
                    <span className={cqaLabel}>Explore prompt</span>
                    <textarea
                      className="min-h-[80px] w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px] outline-none focus:border-[#a9a1f7]"
                      value={explorePrompt}
                      onChange={(e) => setExplorePrompt(e.target.value)}
                      placeholder="e.g. Test the sign-in flow and primary navigation"
                      disabled={readOnly}
                    />
                  </label>
                  <label className="block">
                    <span className={cqaLabel}>Requirement name *</span>
                    <input className={cqaInput} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Checkout journey" disabled={readOnly} />
                  </label>
                  <label className="flex items-start gap-2.5 rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-3.5 py-3">
                    <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} className="mt-0.5 size-4 accent-[#5b4ee8]" disabled={readOnly} />
                    <span>
                      <span className="block text-[12.5px] font-medium text-[#374151]">Require Approval</span>
                      <span className="mt-0.5 block text-[11.5px] text-[#6b7280]">
                        Generated tests stay in a draft state until manually reviewed. Disable to auto-publish and create a suite and plan.
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {method !== "crawl" && (
                <div className="rounded-lg border border-[#f0f1f3] bg-[#fafafa] px-3.5 py-2.5 text-[12px] text-[#6b7280]">
                  Requirement code <span className="font-medium text-[#374151]">{code}</span> will be assigned automatically.
                </div>
              )}
              {error && <p className="text-[12px] text-red-600">{error}</p>}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
