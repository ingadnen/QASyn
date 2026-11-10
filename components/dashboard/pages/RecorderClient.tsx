"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";

interface RecordedStep {
  id: string;
  action: "Navigate" | "Click" | "Enter Text" | "Verify Element";
  target: string;
  value: string;
  selector: string;
}

const FALLBACK_URL = "https://your-domain.com";
const DEMO_PAGE = { url: "https://jsonplaceholder.typicode.com/posts/1", title: "JSONPlaceholder post" };

/** Simulated Chrome Extension recorder: sandbox viewport + event listener → NLP steps. */
export function RecorderClient({
  organisationName,
  initialUrl,
  readOnly,
}: {
  organisationName: string;
  initialUrl: string;
  readOnly: boolean;
}) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [pageIdx, setPageIdx] = useState(0);
  const [steps, setSteps] = useState<RecordedStep[]>([]);
  const [title, setTitle] = useState(`Recorded flow — ${organisationName}`);
  const [targetUrl, setTargetUrl] = useState(initialUrl || FALLBACK_URL);
  const [frameUrl, setFrameUrl] = useState(initialUrl || FALLBACK_URL);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const navCount = useRef(0);

  function push(action: RecordedStep["action"], target: string, value = "") {
    setSteps((s) => [...s, { id: `rec-${Date.now()}-${s.length}`, action, target, value, selector: "" }]);
  }

  function pageUrl(index: number) {
    return index === 0 ? frameUrl : DEMO_PAGE.url;
  }

  // Record navigation when the sandbox page changes.
  useEffect(() => {
    if (navCount.current === 0) {
      navCount.current = 1;
      push("Navigate", frameUrl || FALLBACK_URL);
      return;
    }
    push("Navigate", pageUrl(pageIdx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIdx]);

  // Heartbeat listener: every 6s while the tab is visible, log a focus/text event.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const frame = frameRef.current;
      if (!frame) return;
      const url = frame.src;
      push("Verify Element", `viewport shows ${url}`);
    }, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    const res = await run<{ testCases: Array<{ id: string }> }>("save", "/api/dashboard/test-cases", {
      json: { mode: "manual", title, module: "Core", criticality: "medium", stepsCount: Math.max(1, steps.length), targetUrl },
    });
    const id = res?.testCases?.[0]?.id;
    if (!id) return;
    setCreatedId(id);
    await run("steps", `/api/dashboard/test-cases/${id}`, { method: "PATCH", json: { action: "steps", steps } });
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div>
        <label className="mb-3 block">
          <span className="text-xs font-semibold text-slate-600">Target URL</span>
          <div className="mt-1 flex gap-2">
            <input
              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-sm"
              value={targetUrl}
              disabled={readOnly}
              data-testid="recorder-target-url"
              aria-label="Target URL"
              onChange={(e) => setTargetUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPageIdx(0);
                  setFrameUrl(targetUrl);
                  push("Navigate", targetUrl);
                }
              }}
            />
            <button
              type="button"
              className="h-9 shrink-0 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
              disabled={readOnly}
              onClick={() => {
                setPageIdx(0);
                setFrameUrl(targetUrl);
                push("Navigate", targetUrl);
              }}
            >
              Load page
            </button>
          </div>
          <span className="mt-1 block text-[11px] text-slate-400">Recorded test cases and their steps use this exact URL.</span>
        </label>
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">● REC</span>
          <span className="text-xs text-slate-500">Chrome Extension sandbox — interactions below are recorded as NLP steps</span>
        </div>
        <div
          className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"
          onClick={() => push("Click", "element in sandbox viewport")}
          onFocus={() => push("Click", "focused element in sandbox viewport", "")}
        >
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-2">
            <span className="size-2.5 rounded-full bg-red-400" />
            <span className="size-2.5 rounded-full bg-amber-400" />
            <span className="size-2.5 rounded-full bg-emerald-400" />
            <div className="flex flex-1 gap-1 pl-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPageIdx(0);
                }}
                className={`max-w-[55%] truncate rounded px-2 py-0.5 text-xs ${pageIdx === 0 ? "bg-white font-semibold text-slate-800 shadow-sm" : "text-slate-500"}`}
              >
                Target · {frameUrl.replace(/^https?:\/\//, "").split("/")[0] || FALLBACK_URL}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPageIdx(1);
                }}
                className={`rounded px-2 py-0.5 text-xs ${pageIdx === 1 ? "bg-white font-semibold text-slate-800 shadow-sm" : "text-slate-500"}`}
              >
                {DEMO_PAGE.title}
              </button>
            </div>
          </div>
          <iframe
            ref={frameRef}
            key={`${pageIdx}-${frameUrl}`}
            src={pageUrl(pageIdx)}
            title="Sandbox viewport"
            sandbox="allow-same-origin"
            className="h-80 w-full bg-white"
          />
          <div className="grid gap-2 border-t border-slate-200 p-3 sm:grid-cols-2" onClick={(e) => e.stopPropagation()}>
            <input
              className="h-9 rounded-lg border border-slate-200 px-2 text-sm"
              placeholder="Type in the sandbox… (Enter Text)"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  push("Enter Text", "sandbox input", (e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = "";
                }
              }}
            />
            <button type="button" className="h-9 rounded-lg bg-brand-600 text-sm font-semibold text-white" onClick={() => push("Click", "Submit button")}>
              Click Submit
            </button>
          </div>
        </div>
      </div>
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">NLP step stream</h2>
          <label className="mt-2 block">
            <span className="text-xs font-medium text-slate-600">Test case title</span>
            <input className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm" value={title} disabled={readOnly} onChange={(e) => setTitle(e.target.value)} />
          </label>
        </div>
        <ol className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {steps.length === 0 && <li className="text-sm text-slate-400">Interact with the sandbox to record steps…</li>}
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">{i + 1}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{s.action}</span>
              <span className="min-w-0 flex-1 truncate text-slate-700">
                {s.action} {s.target}
                {s.value && <span className="text-slate-400"> = “{s.value}”</span>}
              </span>
              {!readOnly && (
                <button type="button" className="rounded p-1 text-slate-400 hover:text-red-600" onClick={() => setSteps(steps.filter((x) => x.id !== s.id))}>✕</button>
              )}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
          <Button onClick={() => void save()} loading={pending === "save" || pending === "steps"} loadingText="Saving…" disabled={readOnly || steps.length === 0}>
            Save as Test Case
          </Button>
          {createdId && (
            <a href={`/dashboard/test-cases/${createdId}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-slate-50">
              Open in Studio →
            </a>
          )}
        </div>
        {error && <p role="alert" className="px-4 pb-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
