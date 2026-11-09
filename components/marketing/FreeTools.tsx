"use client";

import { useState } from "react";
import { healSelector, parseDom } from "@/lib/healing";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const field = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-mono text-slate-900 shadow-sm";

export function FreeTools() {
  const [tab, setTab] = useState(0);
  const [nl, setNl] = useState("Navigate to https://app.your-domain.com/login, click Sign in, enter user@your-domain.com, verify Welcome");
  const [html, setHtml] = useState('<button data-testid="submit" class="btn primary">Submit</button>');
  const [broken, setBroken] = useState("css:.old-btn");
  const [payload, setPayload] = useState('{"user":{"id":42,"role":"QA"},"token":"tok_9f27"}');
  const [regex, setRegex] = useState("^\\d{6}$");
  const [sample, setSample] = useState("123456");

  function nlpToPlaywright(text: string): string {
    const lines = text.split(",").map((s) => s.trim()).filter(Boolean);
    return lines
      .map((line) => {
        if (/^navigate/i.test(line)) return `await page.goto("${line.replace(/^navigate to\s*/i, "").trim()}");`;
        if (/^click/i.test(line)) return `await page.getByText("${line.replace(/^click\s*/i, "").trim()}").click();`;
        if (/^enter/i.test(line)) return `await page.locator("input").fill("${line.replace(/^enter\s*/i, "").trim()}");`;
        if (/^verify/i.test(line)) return `await expect(page.locator("body")).toContainText("${line.replace(/^verify\s*/i, "").trim()}");`;
        return `// ${line}`;
      })
      .join("\n");
  }

  function healDemo(): string {
    const dom = parseDom(html);
    const heal = healSelector({ tag: "button", selector: broken, text: "Submit" }, dom);
    return heal.healed ? `Healed (${heal.score.toFixed(2)}): ${heal.newSelector}` : `No candidate above threshold 0.45 (best ${heal.score.toFixed(2)})`;
  }

  function assertionsFromPayload(text: string): string {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      const walk = (o: unknown, path: string, out: string[]) => {
        if (o && typeof o === "object") for (const [k, v] of Object.entries(o as Record<string, unknown>)) walk(v, `${path}.${k}`, out);
        else out.push(`{ kind: "value", path: "$${path}", expected: "${String(o)}" }`);
      };
      const out: string[] = [];
      walk(obj, "", out);
      return out.slice(0, 10).join("\n") || "// empty object";
    } catch {
      return "// invalid JSON";
    }
  }

  const tabs = ["NLP → Playwright", "Selector healer", "Payload assertions", "Regex tester"];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((t, i) => (
            <button key={t} type="button" onClick={() => setTab(i)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", tab === i ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600")}>{t}</button>
          ))}
        </div>
        {tab === 0 && (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Natural language steps (comma separated)</span>
              <textarea className={cn(field, "mt-1 h-auto py-2")} rows={4} value={nl} onChange={(e) => setNl(e.target.value)} />
            </label>
          </div>
        )}
        {tab === 1 && (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">HTML</span>
              <textarea className={cn(field, "mt-1 h-auto py-2")} rows={3} value={html} onChange={(e) => setHtml(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Broken selector</span>
              <input className={cn(field, "mt-1")} value={broken} onChange={(e) => setBroken(e.target.value)} />
            </label>
          </div>
        )}
        {tab === 2 && (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">JSON response payload</span>
              <textarea className={cn(field, "mt-1 h-auto py-2")} rows={4} value={payload} onChange={(e) => setPayload(e.target.value)} />
            </label>
          </div>
        )}
        {tab === 3 && (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Regex</span>
              <input className={cn(field, "mt-1")} value={regex} onChange={(e) => setRegex(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Sample text</span>
              <input className={cn(field, "mt-1")} value={sample} onChange={(e) => setSample(e.target.value)} />
            </label>
          </div>
        )}
      </div>
      <div className="rounded-xl bg-slate-900 p-5">
        <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Output</p>
        <pre className="mt-3 whitespace-pre-wrap break-all text-sm text-slate-100">
          {tab === 0 && nlpToPlaywright(nl)}
          {tab === 1 && healDemo()}
          {tab === 2 && assertionsFromPayload(payload)}
          {tab === 3 && (() => { try { return new RegExp(regex).test(sample) ? "✅ VALID — matches" : "❌ INVALID — no match"; } catch { return "Invalid regex"; } })()}
        </pre>
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={() => navigator.clipboard?.writeText(document.querySelector("pre")?.textContent ?? "")}>Copy</Button>
        </div>
      </div>
    </div>
  );
}
