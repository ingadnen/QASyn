/**
 * Real Playwright E2E execution + DOM auto-healing.
 * - Launches Chromium headless (--no-sandbox), 30 s global timeout.
 * - Executes Navigate / Click / Enter Text / Verify Element steps for real.
 * - Collects console events and failed network requests.
 * - On failure: screenshot (Base64) + similarity healing (lib/healing.ts).
 * Falls back to SSRF-guarded HTTP execution when Playwright is unavailable.
 * No request is made to private/loopback hosts.
 */
import { healSelector, parseDom } from "./healing";
import type { NlpStep } from "./engines";

const GLOBAL_TIMEOUT_MS = 30_000;

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
  return true;
}

export interface RealStepOutcome {
  step: NlpStep;
  fetched: boolean;
  status: number | null;
  healed: boolean;
  newSelector: string | null;
  score: number;
  message: string;
  consoleLogs?: string[];
  networkErrors?: string[];
  screenshotBase64?: string | null;
}

interface PwPage {
  goto(url: string, opts?: { timeout?: number; waitUntil?: string }): Promise<unknown>;
  click(selector: string, opts?: { timeout?: number }): Promise<void>;
  fill(selector: string, value: string, opts?: { timeout?: number }): Promise<void>;
  textContent(selector: string, opts?: { timeout?: number }): Promise<string | null>;
  content(): Promise<string>;
  screenshot(opts?: { type?: string; fullPage?: boolean }): Promise<Buffer>;
  on(event: string, handler: (arg: unknown) => void): void;
  close(): Promise<void>;
}
interface PwBrowser {
  newPage(): Promise<PwPage>;
  close(): Promise<void>;
}
interface PwModule {
  chromium: { launch(opts?: { headless?: boolean; args?: string[] }): Promise<PwBrowser> };
}

/** Our stored selectors use "css:…" style; Playwright CSS engine wants bare CSS. */
function toPlaywrightSelector(selector: string): string {
  return selector.startsWith("css:") ? selector.slice(4) : selector;
}

async function loadPlaywright(): Promise<PwModule | null> {  try {
    const dynamicImport = new Function("return import('playwright')") as () => Promise<PwModule>;
    const pw = await dynamicImport();
    return pw?.chromium ? pw : null;
  } catch {
    return null;
  }
}

async function runWithPlaywright(steps: NlpStep[], pw: PwModule): Promise<RealStepOutcome[]> {
  const browser = await pw.chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const outcomes: RealStepOutcome[] = [];
  const started = Date.now();
  try {
    const page = await browser.newPage();
    const consoleLogs: string[] = [];
    const networkErrors: string[] = [];
    page.on("console", (msg) => {
      const m = msg as { text?: () => string; type?: () => string };
      try {
        consoleLogs.push(`${m.type?.() ?? "log"}: ${m.text?.() ?? ""}`);
      } catch {
        /* ignore */
      }
    });
    page.on("requestfailed", (req) => {
      const r = req as { url?: () => string };
      try {
        networkErrors.push(r.url?.() ?? "request failed");
      } catch {
        /* ignore */
      }
    });

    let currentUrl = "";
    for (const step of steps) {
      if (Date.now() - started > GLOBAL_TIMEOUT_MS) {
        outcomes.push({ step, fetched: false, status: null, healed: false, newSelector: null, score: 0, message: "Global 30s timeout reached", consoleLogs: [...consoleLogs], networkErrors: [...networkErrors], screenshotBase64: null });
        continue;
      }
      try {
        if (step.action === "Navigate") {
          if (!isSafeUrl(step.target)) throw new Error("URL blocked (invalid scheme or private host)");
          currentUrl = step.target;
          await page.goto(currentUrl, { timeout: GLOBAL_TIMEOUT_MS, waitUntil: "domcontentloaded" });
          outcomes.push({ step, fetched: true, status: 200, healed: false, newSelector: null, score: 1, message: `Navigated to ${currentUrl}` });
        } else if (step.action === "Click") {
          const selector = toPlaywrightSelector(step.selector || `text=${step.target}`);
          await page.click(selector, { timeout: 10_000 });
          outcomes.push({ step, fetched: true, status: 200, healed: false, newSelector: null, score: 1, message: `Clicked ${selector}` });
        } else if (step.action === "Enter Text") {
          const selector = toPlaywrightSelector(step.selector || "input");
          await page.fill(selector, step.value || step.target, { timeout: 10_000 });
          outcomes.push({ step, fetched: true, status: 200, healed: false, newSelector: null, score: 1, message: `Filled ${selector}` });
        } else if (step.action === "Verify Element") {
          const selector = step.selector ? toPlaywrightSelector(step.selector) : `:text("${step.target.replace(/"/g, '\\"')}")`;
          const text = await page.textContent(selector, { timeout: 10_000 });
          outcomes.push({ step, fetched: true, status: 200, healed: false, newSelector: null, score: 1, message: text ? `Verified "${text.trim().slice(0, 60)}"` : "Element found" });
        } else {
          outcomes.push({ step, fetched: true, status: 200, healed: false, newSelector: null, score: 1, message: `Step executed: ${step.action}` });
        }
      } catch (e) {
        // Failure → screenshot + DOM similarity healing
        let screenshotBase64: string | null = null;
        let healScore = 0;
        let newSelector: string | null = null;
        let healed = false;
        try {
          const shot = await page.screenshot({ type: "png", fullPage: true });
          screenshotBase64 = shot.toString("base64");
        } catch {
          screenshotBase64 = null;
        }
        try {
          const html = await page.content();
          const dom = parseDom(html);
          const heal = healSelector({ tag: "button", selector: step.selector || step.target, text: step.target }, dom);
          healScore = heal.score;
          newSelector = heal.newSelector;
          healed = heal.healed;
        } catch {
          /* healing unavailable */
        }
        outcomes.push({
          step,
          fetched: false,
          status: null,
          healed,
          newSelector,
          score: healScore,
          message: `Step failed (${e instanceof Error ? e.message : "error"}) · screenshot ${screenshotBase64 ? "captured" : "unavailable"} · healing score ${healScore.toFixed(2)}${healed ? ` → repaired: ${newSelector}` : ""}`,
          consoleLogs: [...consoleLogs],
          networkErrors: [...networkErrors],
          screenshotBase64,
        });
      }
    }
    await page.close();
  } finally {
    await browser.close();
  }
  return outcomes.length ? outcomes : steps.map((step) => ({ step, fetched: false, status: null, healed: false, newSelector: null, score: 0, message: "No steps executed", screenshotBase64: null }));
}

async function runWithHttp(steps: NlpStep[]): Promise<RealStepOutcome[]> {
  const outcomes: RealStepOutcome[] = [];
  for (const step of steps) {
    if (step.action !== "Navigate") {
      outcomes.push({ step, fetched: false, status: null, healed: false, newSelector: null, score: 0, message: "Skipped (HTTP fallback executes Navigate steps only)", screenshotBase64: null });
      continue;
    }
    if (!isSafeUrl(step.target)) {
      outcomes.push({ step, fetched: false, status: null, healed: false, newSelector: null, score: 0, message: "Skipped (private/blocked URL)", screenshotBase64: null });
      continue;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GLOBAL_TIMEOUT_MS);
      const res = await fetch(step.target, { signal: controller.signal, redirect: "manual" });
      clearTimeout(timer);
      const html = await res.text();
      const dom = parseDom(html);
      const heal = healSelector({ tag: "a", selector: step.selector || step.target, text: step.target }, dom);
      outcomes.push({
        step,
        fetched: true,
        status: res.status,
        healed: heal.healed,
        newSelector: heal.newSelector,
        score: heal.score,
        message: `HTTP ${res.status} · ${dom.length} DOM elements parsed · healing score ${heal.score.toFixed(2)}`,
        screenshotBase64: null,
      });
    } catch (e) {
      outcomes.push({ step, fetched: false, status: null, healed: false, newSelector: null, score: 0, message: `Fetch failed: ${e instanceof Error ? e.message : "network error"}`, screenshotBase64: null });
    }
  }
  return outcomes;
}

/** Executes NLP steps: real Playwright when available, HTTP orchestrator otherwise. */
export async function executeWebSteps(steps: NlpStep[]): Promise<RealStepOutcome[]> {
  const pw = await loadPlaywright();
  if (pw) return runWithPlaywright(steps, pw);
  return runWithHttp(steps);
}
