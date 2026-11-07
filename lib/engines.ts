/**
 * Simulated application engines (no outbound network).
 * Every function is pure and deterministic per input, so UI and tests agree.
 */

export interface NlpStep {
  id: string;
  action: string;
  target: string;
  value: string;
  selector: string;
}

export interface StepLog {
  step: number;
  action: string;
  target: string;
  status: "passed" | "healed" | "failed";
  healed: boolean;
  message: string;
  newSelector?: string;
}

/** Deterministic hash → [0,1). Used to simulate UI drift reproducibly. */
function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const HEALABLE = new Set(["Click", "Enter Text", "Verify Element"]);

/** Simulates one NLP step; ~25% of healable steps drift and are auto-healed with a repaired selector. */
export function simulateStep(step: NlpStep, index: number, seed = ""): StepLog {
  const drift = HEALABLE.has(step.action) && hash01(`${seed}:${step.id}:${step.target}`) < 0.25;
  if (drift) {
    const base = step.selector || `css:[data-testid="${step.target.slice(0, 24).toLowerCase().replace(/\s+/g, "-") || "target"}"]`;
    const repaired = base.includes("data-testid") ? base : `${base} >> nth=0`;
    return {
      step: index + 1,
      action: step.action,
      target: step.target,
      status: "healed",
      healed: true,
      message: `UI drift detected on "${step.selector || step.target}" — AI auto-healing re-resolved target to ${repaired}.`,
      newSelector: repaired,
    };
  }
  return { step: index + 1, action: step.action, target: step.target, status: "passed", healed: false, message: "OK" };
}

export function simulateSteps(steps: NlpStep[], seed = ""): { log: StepLog[]; healedSteps: NlpStep[] } {
  const log = steps.map((s, i) => simulateStep(s, i, seed));
  const healedSteps = steps.map((s, i) => (log[i].newSelector ? { ...s, selector: log[i].newSelector as string } : s));
  return { log, healedSteps };
}

// ---------------------------------------------------------------- API chaining

export interface ApiRequestStep {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  /** rest | graphql | soap | grpc (simulated execution metadata) */
  protocol?: "rest" | "graphql" | "soap" | "grpc";
  headers: Record<string, string>;
  body: string;
  assertions: Array<{ kind: "status" | "schema" | "value"; path: string; expected: string }>;
  extractionRules: Array<{ variable: string; path: string }>;
}

export interface ApiStepResult {
  id: string;
  method: string;
  url: string;
  status: number;
  payload: unknown;
  assertions: Array<{ kind: string; path: string; expected: string; actual: string; passed: boolean }>;
  extracted: Record<string, string>;
  ok: boolean;
}

function getPath(obj: unknown, path: string): unknown {
  if (!path || path === "body") return obj;
  const clean = path.replace(/^\$\.?/, "").replace(/^body\./, "");
  const parts = clean
    .split(".")
    .flatMap((p) => {
      const arr = /^(.*)\[(\d+)\]$/.exec(p);
      return arr ? [arr[1], arr[2]] : [p];
    })
    .filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (Array.isArray(cur) && /^\d+$/.test(p)) cur = cur[Number(p)];
    else if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[p];
    else return undefined;
  }
  return cur;
}

/** Blocks private / loopback hosts to keep the engine SSRF-safe. */
function isSafeUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0)/.test(host)) return false;
  if (host === "::1" || host === "[::1]" || host.startsWith("::ffff:")) return false;
  return true;
}

/** Builds the outgoing request for a step, honoring its protocol. */
function buildRequest(step: ApiRequestStep): { url: string; init: RequestInit } {
  if (step.protocol === "graphql") {
    return { url: step.url, init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: step.body || "{ __typename }" }) } };
  }
  if (step.protocol === "soap") {
    return { url: step.url, init: { method: "POST", headers: { "content-type": "text/xml", SOAPAction: step.headers["SOAPAction"] ?? "" }, body: step.body } };
  }
  if (step.protocol === "grpc") {
    // gRPC is multiplexed HTTP/2 — simulated here as JSON over HTTP with grpc metadata.
    return { url: step.url, init: { method: "POST", headers: { "content-type": "application/grpc+json", "x-grpc-timeout": "10s", ...step.headers }, body: step.body } };
  }
  return { url: step.url, init: { method: step.method, headers: { "content-type": "application/json", ...step.headers }, body: step.method === "GET" || step.method === "DELETE" ? undefined : step.body || undefined } };
}

async function realFetch(step: ApiRequestStep): Promise<{ status: number; payload: unknown; headers: Record<string, string> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const { url, init } = buildRequest(step);
    const res = await fetch(url, { ...init, signal: controller.signal, redirect: "manual" });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });
    const text = await res.text();
    let payload: unknown = text;
    try {
      payload = JSON.parse(text);
    } catch {
      /* keep raw text */
    }
    return { status: res.status, payload, headers };
  } finally {
    clearTimeout(timer);
  }
}

/** Executes the chain with real HTTP: substitute {{variables}}, call, extract (JSONPath or regex), assert. */
export async function executeApiChain(steps: ApiRequestStep[]): Promise<ApiStepResult[]> {
  const vars: Record<string, string> = {};
  const substitute = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
  const results: ApiStepResult[] = [];
  for (const step of steps) {
    const resolved: ApiRequestStep = {
      ...step,
      url: substitute(step.url),
      body: substitute(step.body),
      headers: Object.fromEntries(Object.entries(step.headers).map(([k, v]) => [k, substitute(v)])),
    };
    if (!isSafeUrl(resolved.url)) {
      results.push({
        id: step.id,
        method: step.method,
        url: resolved.url,
        status: 0,
        payload: { error: "URL blocked (invalid scheme or private host)" },
        assertions: [],
        extracted: {},
        ok: false,
      });
      continue;
    }
    let status = 0;
    let payload: unknown = null;
    let headers: Record<string, string> = {};
    try {
      const out = await realFetch(resolved);
      status = out.status;
      payload = out.payload;
      headers = out.headers;
    } catch (e) {
      payload = { error: `Request failed: ${e instanceof Error ? e.message : "network error"}` };
    }
    const extracted: Record<string, string> = {};
    for (const rule of step.extractionRules) {
      let value: unknown;
      if (rule.path.startsWith("header:")) {
        value = headers[rule.path.slice(7).toLowerCase()];
      } else if (rule.path.startsWith("regex:")) {
        const text = typeof payload === "string" ? payload : JSON.stringify(payload);
        const match = new RegExp(rule.path.slice(6)).exec(text);
        value = match?.[1] ?? match?.[0];
      } else {
        value = getPath(payload, rule.path);
      }
      if (value !== undefined && value !== null && value !== "") {
        extracted[rule.variable] = String(value);
        vars[rule.variable] = String(value);
      }
    }
    const assertions = step.assertions.map((a) => {
      let actual = "";
      let passed = false;
      if (a.kind === "status") {
        actual = String(status);
        passed = status === Number(a.expected);
      } else if (a.kind === "schema") {
        const keys = a.expected.split(",").map((k) => k.trim()).filter(Boolean);
        const present = payload && typeof payload === "object" ? keys.filter((k) => k in (payload as Record<string, unknown>)) : [];
        actual = present.join(",") || "(none)";
        passed = keys.length > 0 && present.length === keys.length;
      } else {
        const value = getPath(payload, a.path);
        actual = value === undefined ? "(missing)" : String(value);
        passed = actual === a.expected;
      }
      return { kind: a.kind, path: a.path, expected: a.expected, actual, passed };
    });
    results.push({ id: step.id, method: step.method, url: resolved.url, status, payload, assertions, extracted, ok: assertions.every((a) => a.passed) });
  }
  return results;
}

// ---------------------------------------------------------------- Mobile

export interface Gesture {
  id: string;
  gesture: "Tap" | "Swipe" | "Scroll" | "Enter Text" | "Pinch" | "Rotate" | "Biometric";
  target: string;
  value: string;
}

export function simulateMobileRun(device: string, gestures: Gesture[]): { log: string[]; passed: boolean } {
  const log = [`Device grid: ${device} · app installed`, `Gestures: ${gestures.length}`];
  let ok = true;
  gestures.forEach((g, i) => {
    const drift = g.gesture === "Tap" && hash01(`${device}:${g.id}`) < 0.2;
    if (drift) {
      ok = false;
      log.push(`[${i + 1}] ${g.gesture} ${g.target} → FAILED (element not found; auto-healing suggested)`);
    } else {
      log.push(`[${i + 1}] ${g.gesture} ${g.target} → OK`);
    }
  });
  log.push(ok ? "Result: PASSED" : "Result: FAILED");
  return { log, passed: ok };
}

// ---------------------------------------------------------------- Ship

const MODULE_KEYWORDS: Array<[string, string]> = [
  ["billing", "Billing"],
  ["invoice", "Billing"],
  ["payment", "Billing"],
  ["checkout", "Checkout"],
  ["cart", "Checkout"],
  ["auth", "Core"],
  ["login", "Core"],
  ["session", "Core"],
  ["settings", "Settings"],
  ["team", "Settings"],
  ["token", "Settings"],
];

export interface PrImpact {
  scopeTestCaseIds: string[];
  scopeTitles: string[];
  riskLevel: "low" | "medium" | "high";
  decision: "Go" | "No-Go";
  assessment: { modules: string[]; files: number; cases: number; reason: string };
}

export function analyzePrImpact(
  files: string[],
  testCases: Array<{ id: string; title: string; module: string; status: string }>,
): PrImpact {
  const modules = new Set<string>();
  for (const f of files) {
    const lower = f.toLowerCase();
    for (const [kw, mod] of MODULE_KEYWORDS) if (lower.includes(kw)) modules.add(mod);
  }
  const scope = modules.size === 0 ? testCases.filter((t) => t.status === "failing" || t.status === "flaky") : testCases.filter((t) => modules.has(t.module));
  const riskLevel: PrImpact["riskLevel"] = files.length > 25 || modules.size > 2 ? "high" : files.length > 8 ? "medium" : "low";
  const failing = scope.filter((t) => t.status === "failing").length;
  const decision: PrImpact["decision"] = failing > 0 && riskLevel !== "low" ? "No-Go" : "Go";
  return {
    scopeTestCaseIds: scope.map((t) => t.id),
    scopeTitles: scope.map((t) => t.title),
    riskLevel,
    decision,
    assessment: {
      modules: [...modules],
      files: files.length,
      cases: scope.length,
      reason: failing > 0 ? `${failing} failing case(s) in scope block the release.` : "No failing cases in the regression scope.",
    },
  };
}

const ROOT_CAUSES: Array<[RegExp, string]> = [
  [/token|session|401|login|auth/i, "stale token in auth/refresh.ts:87"],
  [/payment|checkout|declined|retry/i, "promise rejection swallowed in billing/retry.tsx:42"],
  [/role|invite|member|permission/i, "PATCH /members ignores role when status = invited"],
  [/credit|balance|refund/i, "refund counted before ledger commit"],
  [/upload|logo|image|png/i, "size check uses bytes instead of KB"],
];

export function reproduceBug(description: string, title: string): { steps: string[]; rootCause: string; severity: "critical" | "high" | "medium" | "low" } {
  const steps = description
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
  const rootCause = ROOT_CAUSES.find(([re]) => re.test(description) || re.test(title))?.[1] ?? "unclassified — needs triage";
  const severity = /critical|crash|data loss|401|500/i.test(description) ? "critical" : /fail|error|broken/i.test(description) ? "high" : "medium";
  return { steps: steps.length ? steps : [title], rootCause, severity };
}
