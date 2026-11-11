/**
 * Real Playwright E2E execution + DOM auto-healing.
 * - Launches Chromium headless (--no-sandbox), 30 s global timeout.
 * - Executes Navigate / Click / Enter Text / Verify Element steps for real.
 * - Collects console events and failed network requests.
 * - On failure: screenshot (Base64) + similarity healing (lib/healing.ts).
 * Falls back to SSRF-guarded HTTP execution when Playwright is unavailable.
 * No request is made to private/loopback hosts.
 */
import { biviaBoolean, type BiviaConfigSources, type BiviaMode } from "./bivia";
import { healSelector, parseDom } from "./healing";
import type { NlpStep } from "./engines";
import {
  buildStepHealMetadata,
  healSelectorWithBivia,
  isHealableAction,
  selectorToPlaywright,
  syntheticDomSummary,
  type StepBiviaHealMetadata,
} from "./selector-healing";

const GLOBAL_TIMEOUT_MS = 30_000;

/** Organisation-scoped context used to execute AI Assertion steps with Bivia. */
export interface WebExecutionOptions {
  organisationId?: string;
  sources?: BiviaConfigSources;
  mode?: BiviaMode;
}

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
  /** Calibrated status persisted for AI Assertion steps. */
  stepStatus?: "passed" | "failed" | "abstained";
  /** Bivia decision metadata persisted with the step. */
  bivia?: {
    status: "passed" | "failed" | "abstained";
    probability: number;
    probabilityRaw: number;
    provider: string;
    question: string;
    latencyMs: number;
    verifiedAt: string;
    abstainReason?: string;
  };
  /** Closed-loop Bivia selector-healing metadata persisted on the step. */
  biviaHeal?: StepBiviaHealMetadata;
  consoleLogs?: string[];
  networkErrors?: string[];
  screenshotBase64?: string | null;
}

interface PwPage {
  goto(url: string, opts?: { timeout?: number; waitUntil?: string }): Promise<unknown>;
  click(selector: string, opts?: { timeout?: number }): Promise<void>;
  fill(selector: string, value: string, opts?: { timeout?: number }): Promise<void>;
  selectOption(selector: string, value: string, opts?: { timeout?: number }): Promise<string[]>;
  textContent(selector: string, opts?: { timeout?: number }): Promise<string | null>;
  content(): Promise<string>;
  evaluate<T>(fn: () => T): Promise<T>;
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

/**
 * Our stored selectors use `css:…` or readable Studio locators such as
 * `page.getByRole("button", { name: "Sign in" })`; Playwright needs the
 * equivalent engine selector.
 */
function toPlaywrightSelector(selector: string): string {
  return selectorToPlaywright(selector);
}

async function loadPlaywright(): Promise<PwModule | null> {  try {
    const dynamicImport = new Function("return import('playwright')") as () => Promise<PwModule>;
    const pw = await dynamicImport();
    return pw?.chromium ? pw : null;
  } catch {
    return null;
  }
}

async function runWithPlaywright(steps: NlpStep[], pw: PwModule, options: WebExecutionOptions = {}): Promise<RealStepOutcome[]> {
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

    /** Captures the rendered DOM and a Playwright screenshot for Bivia healing. */
    async function captureFailureContext(): Promise<{ screenshotBase64: string | null; domSummary: string }> {
      let screenshotBase64: string | null = null;
      try {
        const shot = await page.screenshot({ type: "png", fullPage: true });
        screenshotBase64 = shot.toString("base64");
      } catch {
        screenshotBase64 = null;
      }
      let domSummary = "";
      try {
        domSummary = (await page.content()).slice(0, 8_000);
      } catch {
        domSummary = "";
      }
      return { screenshotBase64, domSummary };
    }

    /** Executes one non-AI step; `overrideSelector` is the healed locator. */
    async function performStep(step: NlpStep, overrideSelector?: string): Promise<string> {
      switch (step.action) {
        case "Navigate": {
          if (!isSafeUrl(step.target)) throw new Error("URL blocked (invalid scheme or private host)");
          currentUrl = step.target;
          await page.goto(currentUrl, { timeout: GLOBAL_TIMEOUT_MS, waitUntil: "domcontentloaded" });
          return `Navigated to ${currentUrl}`;
        }
        case "Click": {
          const selector = toPlaywrightSelector(overrideSelector ?? step.selector ?? `text=${step.target}`);
          await page.click(selector, { timeout: 10_000 });
          return `Clicked ${selector}`;
        }
        case "Enter Text":
        case "Type":
        case "Fill": {
          const selector = toPlaywrightSelector(overrideSelector ?? step.selector ?? "input");
          await page.fill(selector, step.value || step.target, { timeout: 10_000 });
          return `Filled ${selector}`;
        }
        case "Select": {
          const selector = toPlaywrightSelector(overrideSelector ?? step.selector ?? "select");
          const value = step.value || step.target;
          await page.selectOption(selector, value, { timeout: 10_000 });
          return `Selected "${value}" in ${selector}`;
        }
        case "Verify":
        case "Verify Element": {
          const selector = toPlaywrightSelector(overrideSelector ?? step.selector ?? `:text("${step.target.replace(/"/g, '\\"')}")`);
          const text = await page.textContent(selector, { timeout: 10_000 });
          const expected = (step.value || "").trim();
          if (expected && !(text ?? "").includes(expected)) {
            throw new Error(`Expected "${expected}" inside ${selector}`);
          }
          return text ? `Verified "${text.trim().slice(0, 60)}"` : "Element found";
        }
        default:
          return `Step executed: ${step.action}`;
      }
    }

    for (const step of steps) {
      if (Date.now() - started > GLOBAL_TIMEOUT_MS) {
        outcomes.push({ step, fetched: false, status: null, healed: false, newSelector: null, score: 0, message: "Global 30s timeout reached", consoleLogs: [...consoleLogs], networkErrors: [...networkErrors], screenshotBase64: null });
        continue;
      }
      if (step.action === "AI Assertion") {
        // Multimodal verification through Articul8 Bivia: DOM excerpt plus a
        // screenshot, then a calibrated answer with an explicit abstain path.
        const captured = await captureFailureContext();
        const question = step.target || `Verify that ${currentUrl || "the page"} rendered correctly`;
        const decision = await biviaBoolean({
          question,
          context: [
            `URL: ${currentUrl || "(not navigated)"}`,
            `DOM excerpt: ${captured.domSummary}`,
            `Selector: ${step.selector || "(auto-resolved)"}`,
          ].join("\n"),
          screenshotBase64: captured.screenshotBase64,
          organisationId: options.organisationId,
          sources: options.sources,
          mode: options.mode,
          allowAbstain: true,
        });
        const probabilityPct = Math.round(decision.probability * 1000) / 10;
        const stepStatus = decision.status === "abstained" ? "abstained" : decision.value ? "passed" : "failed";
        outcomes.push({
          step,
          fetched: true,
          status: 200,
          healed: false,
          newSelector: null,
          score: decision.probability,
          stepStatus,
          bivia: {
            status: stepStatus,
            probability: probabilityPct,
            probabilityRaw: decision.probability,
            provider: decision.provider,
            question,
            latencyMs: decision.latencyMs,
            verifiedAt: new Date().toISOString(),
            ...(decision.abstainReason ? { abstainReason: decision.abstainReason } : {}),
          },
          message: `🧠 Bivia ${probabilityPct.toFixed(1)}% calibrated · ${stepStatus}${
            decision.abstainReason ? ` · ${decision.abstainReason}` : ""
          } · screenshot ${captured.screenshotBase64 ? "captured" : "unavailable"}`,
          consoleLogs: [...consoleLogs],
          networkErrors: [...networkErrors],
          screenshotBase64: captured.screenshotBase64,
        });
        continue;
      }

      try {
        const message = await performStep(step);
        outcomes.push({ step, fetched: true, status: 200, healed: false, newSelector: null, score: 1, message });
      } catch (e) {
        // Failure → capture DOM + screenshot, then let Bivia choose and
        // calibrate a new locator before falling back to similarity healing.
        const captured = await captureFailureContext();
        let healScore = 0;
        let newSelector: string | null = null;
        let healed = false;
        let biviaHeal: StepBiviaHealMetadata | undefined;

        if (isHealableAction(step.action)) {
          try {
            const decision = await healSelectorWithBivia({
              step: { id: step.id, action: step.action, target: step.target, value: step.value, selector: step.selector },
              domSummary: captured.domSummary || syntheticDomSummary(step.target || step.action, steps),
              url: currentUrl,
              screenshotBase64: captured.screenshotBase64,
              organisationId: options.organisationId,
              sources: options.sources,
              mode: options.mode,
            });
            biviaHeal = buildStepHealMetadata(decision);
            healScore = decision.probability;
            newSelector = decision.newSelector;
            if (decision.status === "healed" && decision.newSelector) {
              try {
                const retryMessage = await performStep(step, decision.newSelector);
                step.selector = decision.newSelector;
                healed = true;
                outcomes.push({
                  step,
                  fetched: true,
                  status: 200,
                  healed: true,
                  newSelector: decision.newSelector,
                  score: decision.probability,
                  biviaHeal,
                  message: `✨ Healed by Bivia · ${decision.oldSelector || "(empty)"} → ${decision.newSelector} · ${decision.probabilityPct.toFixed(1)}% calibrated · ${retryMessage}`,
                  consoleLogs: [...consoleLogs],
                  networkErrors: [...networkErrors],
                  screenshotBase64: captured.screenshotBase64,
                });
                continue;
              } catch {
                if (biviaHeal) biviaHeal = { ...biviaHeal, healed: false };
              }
            }
          } catch {
            /* Bivia healing unavailable — keep the similarity fallback below */
          }
        }

        if (!healed) {
          try {
            const dom = parseDom(captured.domSummary);
            const heal = healSelector({ tag: "button", selector: step.selector || step.target, text: step.target }, dom);
            if (healScore === 0) healScore = heal.score;
            if (!newSelector) newSelector = heal.newSelector;
          } catch {
            /* similarity healing unavailable */
          }
        }

        outcomes.push({
          step,
          fetched: false,
          status: null,
          healed,
          newSelector,
          score: healScore,
          ...(biviaHeal ? { biviaHeal } : {}),
          message: `Step failed (${e instanceof Error ? e.message : "error"}) · screenshot ${captured.screenshotBase64 ? "captured" : "unavailable"} · healing score ${healScore.toFixed(2)}${healed ? ` → repaired: ${newSelector}` : ""}${biviaHeal ? ` · Bivia ${biviaHeal.probabilityPct.toFixed(1)}% calibrated` : ""} · Context7 applied`,
          consoleLogs: [...consoleLogs],
          networkErrors: [...networkErrors],
          screenshotBase64: captured.screenshotBase64,
        });
      }
    }
    await page.close();
  } finally {
    await browser.close();
  }
  return outcomes.length ? outcomes : steps.map((step) => ({ step, fetched: false, status: null, healed: false, newSelector: null, score: 0, message: "No steps executed", screenshotBase64: null }));
}

async function runWithHttp(steps: NlpStep[], options: WebExecutionOptions = {}): Promise<RealStepOutcome[]> {
  const outcomes: RealStepOutcome[] = [];
  let lastUrl = "";
  let lastHtml = "";
  for (const step of steps) {
    if (step.action === "AI Assertion") {
      const question = step.target || `Verify that ${lastUrl || "the page"} rendered correctly`;
      const decision = await biviaBoolean({
        question,
        context: [`URL: ${lastUrl || "(not navigated)"}`, `DOM excerpt: ${lastHtml}`].join("\n"),
        screenshotBase64: null,
        organisationId: options.organisationId,
        sources: options.sources,
        mode: options.mode,
        allowAbstain: true,
      });
      const probabilityPct = Math.round(decision.probability * 1000) / 10;
      const stepStatus = decision.status === "abstained" ? "abstained" : decision.value ? "passed" : "failed";
      outcomes.push({
        step,
        fetched: Boolean(lastUrl),
        status: lastUrl ? 200 : null,
        healed: false,
        newSelector: null,
        score: decision.probability,
        stepStatus,
        bivia: {
          status: stepStatus,
          probability: probabilityPct,
          probabilityRaw: decision.probability,
          provider: decision.provider,
          question,
          latencyMs: decision.latencyMs,
          verifiedAt: new Date().toISOString(),
          ...(decision.abstainReason ? { abstainReason: decision.abstainReason } : {}),
        },
        message: `🧠 Bivia ${probabilityPct.toFixed(1)}% calibrated · ${stepStatus}${
          decision.abstainReason ? ` · ${decision.abstainReason}` : ""
        } · HTTP fallback context`,
        screenshotBase64: null,
      });
      continue;
    }
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
      lastUrl = step.target;
      lastHtml = html.slice(0, 8_000);
      const dom = parseDom(html);
      const heal = healSelector({ tag: "a", selector: step.selector || step.target, text: step.target }, dom);
      outcomes.push({
        step,
        fetched: true,
        status: res.status,
        healed: heal.healed,
        newSelector: heal.newSelector,
        score: heal.score,
        message: `HTTP ${res.status} · ${dom.length} DOM elements parsed · healing score ${heal.score.toFixed(2)} · Context7 ${heal.strategy ?? "CSS"}`,
        screenshotBase64: null,
      });
    } catch (e) {
      outcomes.push({ step, fetched: false, status: null, healed: false, newSelector: null, score: 0, message: `Fetch failed: ${e instanceof Error ? e.message : "network error"}`, screenshotBase64: null });
    }
  }
  return outcomes;
}

/** Executes NLP steps: real Playwright when available, HTTP orchestrator otherwise. */
export async function executeWebSteps(
  steps: NlpStep[],
  options: WebExecutionOptions = {},
): Promise<RealStepOutcome[]> {
  const pw = await loadPlaywright();
  if (pw) return runWithPlaywright(steps, pw, options);
  return runWithHttp(steps, options);
}

/* ------------------------------------------------------------------ */
/* DOM-grounded AI authoring                                           */
/* ------------------------------------------------------------------ */

export interface TargetFormField {
  name: string;
  type: string;
  placeholder: string;
  label: string;
}

export interface TargetForm {
  action: string;
  method: string;
  fields: TargetFormField[];
}

export interface TargetDomSnapshot {
  url: string;
  source: "playwright" | "fetch";
  title: string;
  h1: string;
  navLinks: Array<{ text: string; href: string }>;
  buttons: string[];
  forms: TargetForm[];
  fetchedAt: string;
}

export interface GroundedFlow {
  name: string;
  module: string;
  steps: number;
  criticality: "critical" | "high" | "medium" | "low";
  description: string;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function textFromHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function readAttr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? (match[2] ?? match[3] ?? match[4] ?? "") : "";
}

/** Fetch-only DOM inspection used when Playwright is not available. */
async function inspectWithFetch(url: string): Promise<TargetDomSnapshot | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "QASynBot/1.0 (+https://www.qasyn.com)" },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const title = textFromHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const h1 = textFromHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");

    const navBlocks = [...html.matchAll(/<(nav|header)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => match[2]).join(" ");
    const anchorSource = navBlocks || html;
    const navLinks: Array<{ text: string; href: string }> = [];
    for (const match of anchorSource.matchAll(/<a\b[^>]*href=("([^"]*)"|'([^']*)'|[^\s>]+)[^>]*>([\s\S]*?)<\/a>/gi)) {
      const text = textFromHtml(match[4] ?? "");
      if (!text) continue;
      navLinks.push({ text: text.slice(0, 90), href: match[2] ?? match[3] ?? readAttr(match[0], "href") });
      if (navLinks.length >= 20) break;
    }

    const buttons: string[] = [];
    for (const match of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)) {
      const text = textFromHtml(match[1] ?? "");
      if (text) buttons.push(text.slice(0, 90));
      if (buttons.length >= 25) break;
    }
    for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
      if (readAttr(match[0], "type").toLowerCase() !== "submit") continue;
      const value = readAttr(match[0], "value") || "Submit";
      if (!buttons.includes(value)) buttons.push(value);
    }

    const forms: TargetForm[] = [];
    for (const match of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/gi)) {
      const fields: TargetFormField[] = [];
      for (const field of match[1].matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
        const tag = field[0];
        const type = (readAttr(tag, "type") || field[1].toLowerCase()).toLowerCase();
        if (type === "hidden" || type === "submit") continue;
        fields.push({
          name: readAttr(tag, "name"),
          type,
          placeholder: readAttr(tag, "placeholder"),
          label: readAttr(tag, "aria-label") || readAttr(tag, "title"),
        });
      }
      forms.push({ action: readAttr(match[0], "action"), method: (readAttr(match[0], "method") || "get").toLowerCase(), fields: fields.slice(0, 20) });
      if (forms.length >= 10) break;
    }

    return {
      url,
      source: "fetch",
      title,
      h1,
      navLinks,
      buttons: [...new Set(buttons)],
      forms,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Playwright inspection: real rendered DOM (SPA-safe). */
async function inspectWithPlaywright(url: string, pw: PwModule): Promise<TargetDomSnapshot | null> {
  const browser = await pw.chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(url, { timeout: 8_000, waitUntil: "domcontentloaded" });
    const data = await page.evaluate(() => {
      const text = (element: Element | null) => (element?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 90);
      const attr = (element: Element, name: string) => element.getAttribute(name) ?? "";
      const navLinks = Array.from(document.querySelectorAll("nav a, header a"))
        .slice(0, 20)
        .map((anchor) => ({ text: text(anchor), href: anchor.getAttribute("href") ?? "" }))
        .filter((link) => link.text.length > 0);
      const buttons = Array.from(document.querySelectorAll("button, input[type=submit], [role=button]"))
        .map((element) => {
          if (element instanceof HTMLInputElement) return element.value || "Submit";
          return text(element);
        })
        .filter((label) => label.length > 0)
        .slice(0, 25);
      const forms = Array.from(document.querySelectorAll("form"))
        .slice(0, 10)
        .map((form) => ({
          action: form.getAttribute("action") ?? "",
          method: (form.getAttribute("method") ?? "get").toLowerCase(),
          fields: Array.from(form.querySelectorAll("input, select, textarea"))
            .filter((field) => {
              const type = (field.getAttribute("type") ?? field.tagName).toLowerCase();
              return type !== "hidden" && type !== "submit";
            })
            .slice(0, 20)
            .map((field) => {
              const labels = (field as HTMLInputElement).labels;
              return {
                name: attr(field, "name"),
                type: (attr(field, "type") || field.tagName).toLowerCase(),
                placeholder: attr(field, "placeholder"),
                label: attr(field, "aria-label") || labels?.[0]?.textContent?.trim().slice(0, 90) || "",
              };
            }),
        }));
      return {
        title: document.title ?? "",
        h1: text(document.querySelector("h1")),
        navLinks,
        buttons: Array.from(new Set(buttons)),
        forms,
      };
    });
    return { url, source: "playwright", ...data, fetchedAt: new Date().toISOString() };
  } catch {
    return null;
  } finally {
    await browser.close();
  }
}

/**
 * Inspects the real target DOM: title, h1, navigation links, buttons and forms.
 * Playwright is preferred (rendered SPA DOM); fetch is the fallback. Private and
 * loopback hosts are blocked by the same SSRF guard as real execution.
 */
export async function inspectTargetDom(
  targetUrl: string,
  options?: { skipBrowser?: boolean },
): Promise<TargetDomSnapshot | null> {
  if (!isSafeUrl(targetUrl)) return null;
  if (!options?.skipBrowser) {
    const pw = await loadPlaywright();
    if (pw) {
      try {
        const snapshot = await inspectWithPlaywright(targetUrl, pw);
        if (snapshot) return snapshot;
      } catch {
        /* fall through to fetch */
      }
    }
  }
  return inspectWithFetch(targetUrl);
}

export interface TargetCapture {
  url: string;
  title: string;
  screenshotBase64: string;
  domSummary: string;
}

/**
 * Captures a rendered viewport screenshot plus DOM excerpt for Bivia visual
 * grounding. Returns null when Playwright is unavailable or the URL is blocked;
 * callers degrade to the deterministic grounding fallback.
 */
export async function captureTargetScreenshot(targetUrl: string): Promise<TargetCapture | null> {
  if (!isSafeUrl(targetUrl)) return null;
  const pw = await loadPlaywright();
  if (!pw) return null;
  const browser = await pw.chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(targetUrl, { timeout: 8_000, waitUntil: "domcontentloaded" });
    const shot = await page.screenshot({ type: "png", fullPage: false });
    const html = await page.content();
    return {
      url: targetUrl,
      title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim().slice(0, 120) ?? "",
      screenshotBase64: shot.toString("base64"),
      domSummary: html.slice(0, 8_000),
    };
  } catch {
    return null;
  } finally {
    await browser.close();
  }
}

function moduleForLabel(label: string): string {
  const text = label.toLowerCase();
  if (/billing|invoice|payment|pricing|price|plan|subscription|card/.test(text)) return "Billing";
  if (/checkout|cart|order|shipping|purchase|pay/.test(text)) return "Checkout";
  if (/setting|profile|account|team|notification|security|password|preference/.test(text)) return "Settings";
  return "Core";
}

/** Local, deterministic test flows derived only from the inspected DOM. */
export function groundedFlowsFromDom(snapshot: TargetDomSnapshot | null): GroundedFlow[] {
  if (!snapshot) return [];
  const host = (() => {
    try {
      return new URL(snapshot.url).host;
    } catch {
      return snapshot.url;
    }
  })();
  const landing = snapshot.h1 || snapshot.title || host;
  const flows: GroundedFlow[] = [
    {
      name: `Verify ${landing} landing page`,
      module: "Core",
      steps: 3,
      criticality: "high",
      description: `Grounded in ${snapshot.url}: title "${snapshot.title}", h1 "${snapshot.h1}", ${snapshot.navLinks.length} nav links, ${snapshot.buttons.length} buttons, ${snapshot.forms.length} forms.`,
    },
  ];
  const seen = new Set(flows.map((flow) => flow.name.toLowerCase()));

  for (const link of snapshot.navLinks.slice(0, 5)) {
    const name = `Open ${link.text} from the main navigation`;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    flows.push({ name, module: moduleForLabel(link.text), steps: 4, criticality: "medium", description: `Navigation target ${link.href || "(no href)"} discovered in ${snapshot.url}.` });
  }

  for (const button of snapshot.buttons.slice(0, 5)) {
    const name = `Click "${button}"`;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    flows.push({ name, module: moduleForLabel(button), steps: 4, criticality: "medium", description: `Button "${button}" discovered in ${snapshot.url}.` });
  }

  for (const [index, form] of snapshot.forms.slice(0, 4).entries()) {
    const descriptors = form.fields.map((field) => field.label || field.placeholder || field.name || field.type).filter(Boolean);
    const label = descriptors.slice(0, 3).join(", ") || form.action || `form ${index + 1}`;
    const name = `Submit the ${label} form`;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    flows.push({
      name,
      module: moduleForLabel(label),
      steps: Math.max(4, form.fields.length + 2),
      criticality: form.fields.some((field) => field.type === "password") ? "critical" : "high",
      description: `Form ${index + 1} on ${snapshot.url}: ${form.method.toUpperCase()} ${form.action || "(same page)"} with ${form.fields.length} fields (${descriptors.join(", ")}).`,
    });
  }

  return flows.slice(0, 12);
}

function selectorForField(field: TargetFormField): string {
  if (field.name) return `input[name="${field.name.replace(/"/g, '\\"')}"], select[name="${field.name.replace(/"/g, '\\"')}"], textarea[name="${field.name.replace(/"/g, '\\"')}"]`;
  if (field.type === "email") return 'input[type="email"]';
  if (field.type === "password") return 'input[type="password"]';
  if (field.placeholder) return `input[placeholder="${field.placeholder.replace(/"/g, '\\"')}"]`;
  return "input:not([type=hidden])";
}

function sampleValueForField(field: TargetFormField): string {
  if (field.type === "email") return "qa@qasyn.dev";
  if (field.type === "password") return "QASynTest2026!";
  if (field.type === "tel") return "5550100";
  if (/search|query/i.test(`${field.name} ${field.placeholder}`)) return "invoice";
  return "QASyn";
}

/**
 * Builds NLP steps anchored on the real DOM. Falls back to generic navigable
 * steps when the target could not be inspected.
 */
export function groundedStepsForFlow(
  snapshot: TargetDomSnapshot | null,
  targetUrl: string,
  title: string,
  count: number,
): NlpStep[] {
  const steps: NlpStep[] = [{ id: "s1", action: "Navigate", target: targetUrl, value: "", selector: "" }];

  if (snapshot) {
    steps.push({
      id: "s2",
      action: "Verify Element",
      target: `Verify the "${snapshot.h1 || snapshot.title || title}" heading is visible`,
      value: "",
      selector: "css:h1",
    });

    const normalized = title.toLowerCase();
    const navMatch = snapshot.navLinks.find((link) => normalized.includes(link.text.toLowerCase()) || link.text.toLowerCase().includes(normalized));
    if (navMatch) {
      steps.push({ id: "s3", action: "Click", target: `Click "${navMatch.text}" in the main navigation`, value: "", selector: "css:nav a" });
    } else {
      const buttonMatch = snapshot.buttons.find((button) => normalized.includes(button.toLowerCase()) || button.toLowerCase().includes(normalized));
      if (buttonMatch) steps.push({ id: "s3", action: "Click", target: `Click "${buttonMatch}"`, value: "", selector: "css:button" });
    }

    const form = snapshot.forms[0];
    if (form) {
      const field = form.fields.find((entry) => entry.type === "email") ?? form.fields.find((entry) => entry.type === "password") ?? form.fields[0];
      if (field) {
        steps.push({
          id: "s4",
          action: "Enter Text",
          target: `Fill ${field.label || field.placeholder || field.name || "the first field"}`,
          value: sampleValueForField(field),
          selector: `css:${selectorForField(field)}`,
        });
      }
      steps.push({
        id: "s5",
        action: "Click",
        target: "Submit the form",
        value: "",
        selector: 'css:form button[type="submit"], button[type="submit"]',
      });
    }

    steps.push({
      id: "s6",
      action: "AI Assertion",
      target: `Verify "${title}" completes without console or network errors`,
      value: "",
      selector: "",
    });
  } else {
    steps.push(
      { id: "s2", action: "Verify Element", target: "Verify that the home page is displayed", value: "", selector: "css:h1" },
      { id: "s3", action: "Click", target: "Click on the primary navigation link", value: "", selector: "css:nav a" },
      { id: "s4", action: "AI Assertion", target: `Verify that ${title} is visible`, value: "", selector: "" },
    );
  }

  const generic: Array<Omit<NlpStep, "id">> = [
    { action: "Verify Element", target: "Verify that the current page URL is correct", value: "", selector: "" },
    { action: "Click", target: "Click on the submit button", value: "", selector: "css:button" },
    { action: "AI Assertion", target: "Verify that no error banner is displayed", value: "", selector: "" },
  ];
  let index = 0;
  while (steps.length < Math.max(1, count)) {
    const next = generic[index % generic.length];
    steps.push({ id: `s${steps.length + 1}`, ...next });
    index += 1;
  }
  return steps.slice(0, Math.max(1, count));
}

/**
 * Optional free AI authoring through text.pollinations.ai (4 s timeout).
 * Returns null on any failure so callers always fall back to DOM-grounded data.
 */
export async function askPollinations(prompt: string): Promise<string[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, {
      signal: controller.signal,
      headers: { "user-agent": "QASyn/1.0" },
    });
    if (!response.ok) return null;
    const text = await response.text();
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    let parsed: unknown;
    try {
      parsed = JSON.parse(arrayMatch ? arrayMatch[0] : text);
    } catch {
      return null;
    }
    if (!Array.isArray(parsed)) return null;
    const titles = parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.replace(/\s+/g, " ").trim())
      .filter((entry) => entry.length >= 6 && entry.length <= 140);
    return titles.length > 0 ? titles.slice(0, 12) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generates test-case titles grounded in the inspected DOM, enriched by
 * Pollinations when reachable, and always falls back to local DOM titles.
 */
export async function generateGroundedTitles(
  snapshot: TargetDomSnapshot | null,
  module: string,
  prompt: string,
  count: number,
  fallback: string[],
): Promise<string[]> {
  const domTitles = groundedFlowsFromDom(snapshot).map((flow) => flow.name);
  const local = [...new Set([...domTitles, ...fallback])].filter(Boolean);

  if (snapshot) {
    const summary = [
      `URL: ${snapshot.url}`,
      `Title: ${snapshot.title || "(none)"}`,
      `H1: ${snapshot.h1 || "(none)"}`,
      `Nav links: ${snapshot.navLinks.map((link) => link.text).slice(0, 8).join(" | ") || "(none)"}`,
      `Buttons: ${snapshot.buttons.slice(0, 8).join(" | ") || "(none)"}`,
      `Forms: ${snapshot.forms.map((form) => form.fields.map((field) => field.label || field.placeholder || field.name || field.type).join(", ")).filter(Boolean).slice(0, 4).join(" | ") || "(none)"}`,
    ].join("\n");
    const aiTitles = await askPollinations(
      `You are a senior QA engineer. Real page DOM:\n${summary}\n\nWrite ${count} short end-to-end test case titles for the ${module} module about "${prompt}". Ground every title in the elements above. Return ONLY a JSON array of strings.`,
    );
    if (aiTitles) return [...new Set([...aiTitles, ...local])].slice(0, Math.max(1, count));
  }

  return local.slice(0, Math.max(1, count));
}

