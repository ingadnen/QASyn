"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const inputCls =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100";

export function ContextForm({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [type, setType] = useState<"JIRA_STORY" | "SWAGGER_DOC" | "FIGMA_LAYOUT" | "RAW_URL" | "VIDEO_LOG">("RAW_URL");
  const [sourceUrl, setSourceUrl] = useState("");
  const [extractedText, setExtractedText] = useState("");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("c", "/api/dashboard/context", { json: { type, sourceUrl, metadata: { via: "dashboard" }, extractedText } });
    if (res) {
      setSourceUrl("");
      setExtractedText("");
      router.refresh();
    }
  }
  return (
    <form onSubmit={(e) => void go(e)} className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Type</span>
        <select className={cn(inputCls, "mt-1")} value={type} disabled={readOnly} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="RAW_URL">RAW_URL</option>
          <option value="JIRA_STORY">JIRA_STORY</option>
          <option value="SWAGGER_DOC">SWAGGER_DOC</option>
          <option value="FIGMA_LAYOUT">FIGMA_LAYOUT</option>
          <option value="VIDEO_LOG">VIDEO_LOG</option>
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Source URL</span>
        <input className={cn(inputCls, "mt-1")} value={sourceUrl} disabled={readOnly} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" />
      </label>
      <Button type="submit" loading={pending === "c"} disabled={readOnly}>Ingest</Button>
      <label className="block sm:col-span-3">
        <span className="text-xs font-medium text-slate-600">Extracted text (optional, for hallucination grounding)</span>
        <textarea className={cn(inputCls, "mt-1 h-auto py-2")} rows={2} value={extractedText} disabled={readOnly} onChange={(e) => setExtractedText(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm text-red-600 sm:col-span-3">{error}</p>}
    </form>
  );
}

export function AgentSuiteForm({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [name, setName] = useState("Support agent — Agentforce");
  const [agentEndpoint, setAgentEndpoint] = useState("https://agentforce.example.com/support");
  const [guardrails, setGuardrails] = useState("no prompt injection\nno credential leaks");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("s", "/api/dashboard/agent-suites", { json: { name, agentEndpoint, guardrails: guardrails.split("\n").filter(Boolean), knowledgeBaseIds: [] } });
    if (res) router.refresh();
  }
  return (
    <form onSubmit={(e) => void go(e)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Suite name</span>
          <input className={cn(inputCls, "mt-1")} value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Agent endpoint (Agentforce / LangChain / Bedrock)</span>
          <input className={cn(inputCls, "mt-1")} value={agentEndpoint} disabled={readOnly} onChange={(e) => setAgentEndpoint(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Guardrail watchlist (one per line)</span>
        <textarea className={cn(inputCls, "mt-1 h-auto py-2")} rows={2} value={guardrails} disabled={readOnly} onChange={(e) => setGuardrails(e.target.value)} />
      </label>
      <Button type="submit" loading={pending === "s"} disabled={readOnly}>Declare agent suite</Button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

export function ApiChainForm({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [name, setName] = useState("Auth → profile chain");
  const [requests, setRequests] = useState(
    JSON.stringify(
      [
        { id: "r1", method: "POST", url: "https://jsonplaceholder.typicode.com/posts", headers: {}, body: '{"title":"qa"}', assertions: [{ kind: "status", path: "", expected: "201" }], extractionRules: [{ variable: "postId", path: "$.id" }] },
        { id: "r2", method: "GET", url: "https://jsonplaceholder.typicode.com/posts/{{postId}}", headers: {}, body: "", assertions: [{ kind: "status", path: "", expected: "200" }], extractionRules: [] },
      ],
      null,
      2,
    ),
  );
  async function go(e: React.FormEvent) {
    e.preventDefault();
    let parsed: unknown;
    try {
      parsed = JSON.parse(requests);
    } catch {
      return;
    }
    const res = await run("c", "/api/dashboard/api-chains", { json: { name, requests: parsed } });
    if (res) router.refresh();
  }
  return (
    <form onSubmit={(e) => void go(e)} className="space-y-3">
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Chain name</span>
        <input className={cn(inputCls, "mt-1")} value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Requests (JSON array with assertions + extractionRules)</span>
        <textarea className={cn(inputCls, "mt-1 h-auto py-2 font-mono text-xs")} rows={8} value={requests} disabled={readOnly} onChange={(e) => setRequests(e.target.value)} />
      </label>
      <Button type="submit" loading={pending === "c"} disabled={readOnly}>Create chain</Button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
