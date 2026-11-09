"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, Toggle } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100";

export function CrawlForm({ defaultUrl, readOnly, onCancel }: { defaultUrl: string; readOnly: boolean; onCancel?: () => void }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [url, setUrl] = useState(defaultUrl);
  const [platform, setPlatform] = useState<"Web Application" | "Mobile" | "API">("Web Application");
  const [publishMode, setPublishMode] = useState<"Require approval" | "Auto publish">("Require approval");
  const [types, setTypes] = useState<Set<string>>(new Set(["Positive / Happy Path", "Negative", "Edge Cases"]));
  const [prerequisites, setPrerequisites] = useState("");
  const TYPE_OPTIONS = ["Positive / Happy Path", "Negative", "Edge Cases", "Field Level Validation", "Boundary Value", "Functional", "End to End"];
  const [configOpen, setConfigOpen] = useState(false);
  const [explorePrompt, setExplorePrompt] = useState("");
  const [requirementName, setRequirementName] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [createSuite, setCreateSuite] = useState(true);
  const [createPlan, setCreatePlan] = useState(true);
  const EXAMPLES = ["Test the sign-in flow", "Cover the primary navigation", "Validate forms and error states"];
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="7" width="16" height="13" rx="3" />
            <path d="M12 7V4M8 12h.01M16 12h.01M9 16h6" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">Robot QA · Autonomous Crawl</p>
          <p className="text-xs text-slate-600">Map your application and generate reviewed test cases automatically.</p>
        </div>
      </div>
      <button type="button" onClick={() => setConfigOpen((v) => !v)} aria-expanded={configOpen} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700">
        <span>⚙ {configOpen ? "Hide Configuration Options" : "Show Configuration Options"}</span>
        <span>{configOpen ? "▾" : "▸"}</span>
      </button>
      {configOpen && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Select Target Platform">
            <select className={inputCls} value={platform} disabled={readOnly} onChange={(e) => setPlatform(e.target.value as typeof platform)}>
              <option>Web Application</option>
              <option>Mobile</option>
              <option>API</option>
            </select>
          </Field>
          <Field label="Publish Mode">
            <select className={inputCls} value={publishMode} disabled={readOnly} onChange={(e) => setPublishMode(e.target.value as typeof publishMode)}>
              <option>Require approval</option>
              <option>Auto publish</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-slate-600">Test case types</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={types.has(t)}
                  onClick={() => {
                    const next = new Set(types);
                    if (next.has(t)) next.delete(t); else next.add(t);
                    setTypes(next);
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${types.has(t) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {types.has(t) ? "✓ " : ""}{t}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">Choose the types of test cases AI should generate. If not selected, AI will automatically determine the test cases type for you.</p>
          </div>
          <div className={cn("rounded-xl border border-slate-200 px-4 sm:col-span-2", readOnly && "pointer-events-none opacity-60")}>
            <Toggle checked={createSuite} onChange={setCreateSuite} label="Create Test Suite" description="Group the generated test cases into a suite." />
            <div className="border-t border-slate-100" />
            <Toggle checked={createPlan} onChange={setCreatePlan} label="Create Test Plan" description="Attach the generated cases to a runnable plan." />
          </div>
        </div>
      )}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const prereqIds = prerequisites.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
          const res = run<{ crawl: { id: string } }>("c", "/api/dashboard/crawl", {
            json: {
              targetUrl: url || undefined,
              platform,
              publishMode,
              testTypes: [...types],
              prerequisites: prereqIds,
              explorePrompt,
              additionalContext,
              requirementName,
              createSuite,
              createPlan,
            },
          });
          void res.then((r) => {
            // Live behaviour (mirrors ContextQA): toast + redirect to the AQE live feed.
            sessionStorage.setItem("qasyn_crawl_notice", r ? `Crawl started — crawling ${url || defaultUrl}` : "");
            router.push("/dashboard/overview");
          });
        }}
      >
        <Field label="Target URL">
          <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://app.example.com/login" disabled={readOnly} />
        </Field>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700">Explore prompt</span>
          <span className="mt-1.5 block">
            <textarea
              className={cn(inputCls, "h-auto py-2")}
              rows={3}
              value={explorePrompt}
              disabled={readOnly}
              onChange={(e) => setExplorePrompt(e.target.value)}
              placeholder="Tell Robot QA what to explore, e.g. sign in, browse the catalog and add an item to the cart…"
            />
          </span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={readOnly}
                onClick={() => setExplorePrompt((v) => (v ? `${v.trim()} ${ex.toLowerCase()}` : ex))}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200"
              >
                {ex}
              </button>
            ))}
          </span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Requirement Name">
            <input className={inputCls} value={requirementName} onChange={(e) => setRequirementName(e.target.value)} placeholder={defaultUrl ? `Crawl — ${defaultUrl.replace(/^https?:\/\//, "")}` : "Crawl requirement"} disabled={readOnly} />
          </Field>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">Prerequisites</span>
            <span className="mt-1.5 block">
              <input className={inputCls} value={prerequisites} disabled={readOnly} onChange={(e) => setPrerequisites(e.target.value)} placeholder="Select Prerequisites (e.g. TC-3, TC-4)" />
            </span>
          </label>
        </div>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700">Additional Context</span>
          <span className="mt-1.5 block">
            <textarea
              className={cn(inputCls, "h-auto py-2")}
              rows={2}
              value={additionalContext}
              disabled={readOnly}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Any credentials, constraints or areas to avoid…"
            />
          </span>
        </label>
        {publishMode === "Require approval" && <p className="text-xs text-slate-500">“Require Approval” keeps tests in a draft state until manually reviewed.</p>}
        {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <Button type="button" variant="secondary" onClick={() => onCancel?.()} disabled={pending === "c"}>Cancel</Button>
          <Button type="submit" loading={pending === "c"} loadingText="Starting…" disabled={readOnly}>Start Crawl</Button>
        </div>
      </form>
    </div>
  );
}

export function CodeAnalysisRun({ hasRepo, readOnly }: { hasRepo: boolean; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={() => void run("a", "/api/dashboard/code-analysis")} loading={pending === "a"} loadingText="Analysing…" disabled={readOnly || !hasRepo}>
        Run analysis
      </Button>
      {!hasRepo && <p className="text-xs text-slate-500">Connect GitHub or GitLab in Integrations first.</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function RequirementCreate({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [code, setCode] = useState("REQ-");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<"manual" | "jira" | "linear" | "doc" | "import">("manual");
  const [importText, setImportText] = useState("");
  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 sm:grid-cols-[140px_1fr_160px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void run("r", "/api/dashboard/requirements", { json: { code, title, source } });
          setTitle("");
        }}
      >
        <Field label="Code"><input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} disabled={readOnly} /></Field>
        <Field label="Title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Users can …" disabled={readOnly} /></Field>
        <Select label="Source" value={source} onChange={setSource} options={["manual", "jira", "linear", "doc", "import"]} />
        <Button type="submit" loading={pending === "r"} disabled={readOnly}>Add</Button>
      </form>
      <form
        className="flex flex-wrap items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run("i", "/api/dashboard/requirements/import", { json: { text: importText } });
          setImportText("");
        }}
      >
        <div className="min-w-64 flex-1">
          <Field label="Bulk import (one requirement per line: CODE Title)">
            <textarea className={cn(inputCls, "h-auto py-2")} rows={2} value={importText} onChange={(e) => setImportText(e.target.value)} disabled={readOnly} />
          </Field>
        </div>
        <Button type="submit" variant="secondary" loading={pending === "i"} disabled={readOnly}>Import</Button>
      </form>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function CollectionCreate({ kind, readOnly }: { kind: "suites" | "test-plans"; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [schedule, setSchedule] = useState<"manual" | "on_pr" | "nightly" | "weekly">("manual");
  const [module, setModule] = useState("");
  const [environment, setEnvironment] = useState("");
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run("c", `/api/dashboard/collections/${kind}`, { json: { name, description, schedule, module, environment: environment || undefined } });
        setName("");
      }}
    >
      <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} /></Field>
      <Field label="Module (empty = all)"><input className={inputCls} value={module} onChange={(e) => setModule(e.target.value)} disabled={readOnly} /></Field>
      <Field label="Description"><input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly} /></Field>
      <Select label="Schedule" value={schedule} onChange={setSchedule} options={["manual", "on_pr", "nightly", "weekly"]} />
      {kind === "test-plans" && (
        <Field label="Environment"><input className={inputCls} value={environment} onChange={(e) => setEnvironment(e.target.value)} disabled={readOnly} /></Field>
      )}
      <div className="flex items-end">
        <Button type="submit" loading={pending === "c"} disabled={readOnly}>Create</Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p>}
    </form>
  );
}

export function EnvironmentCreate({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authType, setAuthType] = useState<"none" | "basic" | "bearer" | "form">("none");
  const [vars, setVars] = useState("");
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const variables: Record<string, string> = {};
        for (const line of vars.split("\n")) {
          const [k, ...v] = line.split("=");
          if (k?.trim()) variables[k.trim().toUpperCase()] = v.join("=").trim();
        }
        void run("e", "/api/dashboard/environments", { json: { name, baseUrl, authType, variables, isDefault: false } });
      }}
    >
      <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Staging" disabled={readOnly} /></Field>
      <Field label="Base URL"><input className={inputCls} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://staging.example.com" disabled={readOnly} /></Field>
      <Select label="Auth type" value={authType} onChange={setAuthType} options={["none", "basic", "bearer", "form"]} />
      <Field label="Variables (KEY=value per line)"><textarea className={cn(inputCls, "h-auto py-2")} rows={2} value={vars} onChange={(e) => setVars(e.target.value)} disabled={readOnly} /></Field>
      <div className="sm:col-span-2"><Button type="submit" loading={pending === "e"} disabled={readOnly}>Create environment</Button></div>
      {error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p>}
    </form>
  );
}

export function UploadCreate({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [fileName, setFileName] = useState("");
  const [kind, setKind] = useState<"apk" | "ipa" | "har" | "postman" | "video" | "other">("other");
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run("u", "/api/dashboard/uploads", { json: { fileName, kind, sizeBytes: 0 } });
        setFileName("");
      }}
    >
      <div className="min-w-56 flex-1">
        <Field label="File name (metadata only — simulated upload)"><input className={inputCls} value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="build.apk" disabled={readOnly} /></Field>
      </div>
      <Select label="Kind" value={kind} onChange={setKind} options={["apk", "ipa", "har", "postman", "video", "other"]} />
      <Button type="submit" loading={pending === "u"} disabled={readOnly}>Register upload</Button>
      {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

export function KnowledgeCreate({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"website" | "doc" | "openapi" | "upload">("website");
  const [urlOrPath, setUrlOrPath] = useState("");
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_140px_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        void run("k", "/api/dashboard/knowledge-base", { json: { title, type, urlOrPath } });
        setTitle(""); setUrlOrPath("");
      }}
    >
      <Field label="Title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} disabled={readOnly} /></Field>
      <Select label="Type" value={type} onChange={setType} options={["website", "doc", "openapi", "upload"]} />
      <Field label="URL or path"><input className={inputCls} value={urlOrPath} onChange={(e) => setUrlOrPath(e.target.value)} disabled={readOnly} /></Field>
      <Button type="submit" loading={pending === "k"} disabled={readOnly}>Index</Button>
      {error && <p role="alert" className="text-sm text-red-600 sm:col-span-4">{error}</p>}
    </form>
  );
}

export function TeamInvite({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"Engineer" | "QA" | "Eng manager" | "Founder" | "Admin">("Engineer");
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run("t", "/api/dashboard/team", { json: { email, role } });
        setEmail("");
      }}
    >
      <div className="min-w-56 flex-1">
        <Field label="E-mail"><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={readOnly} /></Field>
      </div>
      <Select label="Role" value={role} onChange={setRole} options={["Engineer", "QA", "Eng manager", "Founder", "Admin"]} />
      <Button type="submit" loading={pending === "t"} disabled={readOnly}>Invite</Button>
      {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

export function TunnelActions({ token, enrolled, port, readOnly }: { token: string | null; enrolled: boolean; port: number; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [shown, setShown] = useState<string | null>(null);
  const [p, setP] = useState(port);
  async function act(action: "rotate" | "enroll" | "disconnect") {
    const res = await run<{ tunnelToken?: string }>(action, "/api/onboarding/tunnel", { json: { action, localPort: p } });
    if (res?.tunnelToken) setShown(res.tunnelToken);
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Local port"><input className={inputCls} type="number" value={p} onChange={(e) => setP(Number(e.target.value))} disabled={readOnly} style={{ width: 120 }} /></Field>
        <Button onClick={() => void act("enroll")} loading={pending === "enroll"} disabled={readOnly}>Simulate enrolment</Button>
        <Button variant="secondary" onClick={() => void act("rotate")} loading={pending === "rotate"} disabled={readOnly}>Regenerate token</Button>
        <Button variant="ghost" onClick={() => void act("disconnect")} loading={pending === "disconnect"} disabled={readOnly}>Disconnect</Button>
      </div>
      <p className="text-sm text-slate-600">
        Status: {enrolled ? <strong className="text-emerald-600">Connected</strong> : "Not connected"} · Token: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{shown ?? token ?? "—"}</code>
      </p>
      <p className="text-xs text-slate-500">Install: <code>qa tunnel connect --port {p} --token {shown ?? token ?? "tnl_…"}</code></p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function IntegrationsClient({ items, readOnly }: { items: Array<{ provider: string; status: string; detail: string | null }>; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const providers = ["GITHUB", "GITLAB", "JIRA", "LINEAR", "SLACK"] as const;
  const byProvider = new Map(items.map((i) => [i.provider, i]));
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100">
        {providers.map((p) => {
          const it = byProvider.get(p);
          return (
            <li key={p} className="flex flex-wrap items-center gap-3 py-3">
              <span className="w-24 font-medium capitalize text-slate-800">{p.toLowerCase()}</span>
              <span className="flex-1 text-sm text-slate-500">{it ? `${it.status}${it.detail ? ` · ${it.detail}` : ""}` : "Not connected"}</span>
              {it ? (
                <Button variant="danger" size="sm" loading={pending === p} disabled={readOnly} onClick={() => void run(p, `/api/onboarding/integrations/${p}`, { method: "DELETE" })}>Disconnect</Button>
              ) : (
                <Button size="sm" loading={pending === p} disabled={readOnly} onClick={() => void run(p, `/api/onboarding/integrations/${p}`, { json: {} })}>Connect</Button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function BillingForm({ plan, paymentMethod, readOnly }: { plan: string; paymentMethod: string | null; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [p, setP] = useState(plan);
  const [cardholder, setCardholder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run("plan", "/api/dashboard/billing", { json: { action: "plan", plan: p } }); }}>
        <Select label="Plan" value={p as "trial" | "free" | "starter" | "pro" | "enterprise"} onChange={setP} options={["trial", "free", "starter", "pro", "enterprise"]} />
        <Button type="submit" loading={pending === "plan"} disabled={readOnly}>Change plan</Button>
      </form>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run("pay", "/api/dashboard/billing", { json: { action: "payment", cardholder, cardNumber } }); }}>
        <p className="text-sm text-slate-600">Current: <strong>{paymentMethod ?? "No payment method"}</strong></p>
        <Field label="Cardholder"><input className={inputCls} value={cardholder} onChange={(e) => setCardholder(e.target.value)} disabled={readOnly} /></Field>
        <Field label="Card number (test card, only last 4 kept)"><input className={inputCls} value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="4242 4242 4242 4242" disabled={readOnly} /></Field>
        <Button type="submit" variant="secondary" loading={pending === "pay"} disabled={readOnly}>Add payment method</Button>
      </form>
      {error && <p role="alert" className="text-sm text-red-600 md:col-span-2">{error}</p>}
    </div>
  );
}

export function McpClient({ snippet }: { snippet: string }) {
  const { run, pending, error } = useAction();
  const [tool, setTool] = useState<"list_test_cases" | "get_quality_summary" | "list_bugs" | "list_pull_requests">("get_quality_summary");
  const [result, setResult] = useState<string | null>(null);
  async function test() {
    try {
      const res = await apiFetch<{ result: unknown }>("/api/dashboard/mcp/test", { method: "POST", json: { tool } });
      setResult(JSON.stringify(res.result, null, 2));
      void run;
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return (
    <div className="space-y-4">
      <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">{snippet}</pre>
      <div className="flex flex-wrap items-end gap-2">
        <Select label="Tool" value={tool} onChange={setTool} options={["list_test_cases", "get_quality_summary", "list_bugs", "list_pull_requests"]} />
        <Button onClick={() => void test()} loading={pending === "x"}>Run tool</Button>
      </div>
      {result && <pre className="max-h-80 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-700 ring-1 ring-slate-200">{result}</pre>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function OrgSettingsForm({ name, website, readOnly }: { name: string; website: string; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [n, setN] = useState(name);
  const [w, setW] = useState(website);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run("o", "/api/dashboard/settings/organization", { method: "PATCH", json: { name: n, website: w || null } }); }}>
      <Field label="Organisation name"><input className={inputCls} value={n} onChange={(e) => setN(e.target.value)} disabled={readOnly} /></Field>
      <Field label="Website"><input className={inputCls} value={w} onChange={(e) => setW(e.target.value)} disabled={readOnly} /></Field>
      <Button type="submit" loading={pending === "o"} disabled={readOnly}>Save</Button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

export function AnalysisForm({ initial, readOnly }: { initial: { severityThreshold: string; blockOnRegression: boolean; autoHealing: boolean; minCoverage: number; prComment: boolean }; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [v, setV] = useState(initial);
  return (
    <form className="space-y-1" onSubmit={(e) => { e.preventDefault(); void run("a", "/api/dashboard/settings/analysis", { method: "PATCH", json: v }); }}>
      <Select label="Severity threshold" value={v.severityThreshold as "critical" | "high" | "medium" | "low"} onChange={(s) => setV({ ...v, severityThreshold: s })} options={["critical", "high", "medium", "low"]} />
      <Toggle label="Block on regression" checked={v.blockOnRegression} onChange={(b) => setV({ ...v, blockOnRegression: b })} />
      <Toggle label="Auto-healing" checked={v.autoHealing} onChange={(b) => setV({ ...v, autoHealing: b })} />
      <Toggle label="Comment on PRs" checked={v.prComment} onChange={(b) => setV({ ...v, prComment: b })} />
      <Field label="Minimum coverage %"><input className={inputCls} type="number" min={0} max={100} value={v.minCoverage} onChange={(e) => setV({ ...v, minCoverage: Number(e.target.value) })} disabled={readOnly} /></Field>
      <Button type="submit" loading={pending === "a"} disabled={readOnly}>Save</Button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

export function BugReproForm({ initial, readOnly }: { initial: { autoReproduce: boolean; sources: string[]; captureVideo: boolean; captureNetwork: boolean; captureConsole: boolean; maxAttempts: number }; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [v, setV] = useState({ ...initial, sources: initial.sources as Array<"jira" | "linear" | "slack"> });
  function toggleSource(s: "jira" | "linear" | "slack") {
    setV({ ...v, sources: v.sources.includes(s) ? v.sources.filter((x) => x !== s) : [...v.sources, s] });
  }
  return (
    <form className="space-y-1" onSubmit={(e) => { e.preventDefault(); void run("b", "/api/dashboard/settings/bug-reproduction", { method: "PATCH", json: v }); }}>
      <Toggle label="Auto-reproduce bugs" checked={v.autoReproduce} onChange={(b) => setV({ ...v, autoReproduce: b })} />
      <div className="flex gap-4 py-2">
        {(["jira", "linear", "slack"] as const).map((s) => (
          <label key={s} className="flex items-center gap-2 text-sm capitalize text-slate-700">
            <input type="checkbox" checked={v.sources.includes(s)} onChange={() => toggleSource(s)} disabled={readOnly} /> {s}
          </label>
        ))}
      </div>
      <Toggle label="Capture video" checked={v.captureVideo} onChange={(b) => setV({ ...v, captureVideo: b })} />
      <Toggle label="Capture network traces" checked={v.captureNetwork} onChange={(b) => setV({ ...v, captureNetwork: b })} />
      <Toggle label="Capture console logs" checked={v.captureConsole} onChange={(b) => setV({ ...v, captureConsole: b })} />
      <Field label="Max attempts"><input className={inputCls} type="number" min={1} max={10} value={v.maxAttempts} onChange={(e) => setV({ ...v, maxAttempts: Number(e.target.value) })} disabled={readOnly} /></Field>
      <Button type="submit" loading={pending === "b"} disabled={readOnly}>Save</Button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

export function ApiTokenCreate({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [name, setName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run<{ token: string }>("t", "/api/dashboard/api-tokens", { json: { name } });
    if (res?.token) { setToken(res.token); setName(""); router.refresh(); }
  }
  return (
    <div className="space-y-3">
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void submit(e)}>
        <div className="min-w-56 flex-1">
          <Field label="Token name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="CI pipeline" disabled={readOnly} /></Field>
        </div>
        <Button type="submit" loading={pending === "t"} disabled={readOnly}>Create token</Button>
      </form>
      {token && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Copy it now — it is shown once: <code className="font-mono">{token}</code>
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export { Input };
