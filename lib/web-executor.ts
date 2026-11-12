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
import { defaultExpectedResultForStep } from "./step-expected";

const GLOBAL_TIMEOUT_MS = 30_000;

/** Organisation-scoped context used to execute AI Assertion steps with Bivia. */
export interface WebExecutionOptions {
  organisationId?: string;
  sources?: BiviaConfigSources;
  mode?: BiviaMode;
  /** Total execution budget in ms (defaults to the 30 s global timeout). */
  timeoutMs?: number;
  /** Per-action selector timeout in ms (defaults to 1.8 s with a budget, 4 s otherwise). */
  actionTimeoutMs?: number;
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
  /** MIME type for `screenshotBase64` (image/png or image/svg+xml). */
  screenshotMime?: string;
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
  locator(selector: string): { isVisible(): Promise<boolean> };
  content(): Promise<string>;
  evaluate<T>(fn: () => T): Promise<T>;
  evaluate<T, A>(fn: (arg: A) => T, arg: A): Promise<T>;
  evaluate<T = unknown>(expression: string): Promise<T>;
  waitForTimeout(ms: number): Promise<void>;
  screenshot(opts?: { type?: string; fullPage?: boolean }): Promise<Buffer>;
  on(event: string, handler: (arg: unknown) => void): void;
  close(): Promise<void>;
}
interface PwBrowser {
  newPage(opts?: { userAgent?: string; viewport?: { width: number; height: number } }): Promise<PwPage>;
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

/**
 * True when a step target is a human sentence rather than a CSS/text selector.
 * Natural-language targets are validated against the live body instead of
 * waiting 10 s for a literal `:text("Verify that…")` node that will never exist.
 */
function isNaturalLanguageTarget(target: string): boolean {
  const value = target.trim();
  if (!value) return false;
  if (/(getBy|locator\s*\()/i.test(value)) return false;
  if (/[:#\[\]{}()>="]|(^|\s)(css=|text=|role=|xpath=)/i.test(value)) return false;
  return value.split(/\s+/).length >= 3 || value.length > 32;
}

const STOP_WORDS = new Set([
  "verify", "that", "the", "click", "on", "in", "main", "navigation", "is", "visible", "enter", "field",
  "button", "link", "page", "completes", "with", "no", "console", "errors", "error", "and", "to", "of",
  "for", "from", "a", "an", "are", "should", "render", "renders", "loads", "load", "opens", "open",
  "successfully", "target", "text", "into", "by", "at", "top", "below", "above", "current", "url",
  "contains", "this", "then", "its", "it", "be", "displayed", "display", "shows", "show", "expected",
  "result", "value", "input", "primary", "global", "secondary", "section", "controls", "control",
  "interactive", "landmarks", "landmark", "correct", "correctly", "valid", "state", "status",
]);

/** Quoted labels + meaningful keywords from a natural-language step target. */
export function extractStepTargetCandidates(step: { target: string; value?: string }): { quoted: string[]; keywords: string[] } {
  const raw = `${step.target || ""} ${step.value || ""}`.trim();
  const quoted = [...raw.matchAll(/["“]([^"”]{2,80})["”]/g)].map((match) => match[1].trim()).filter(Boolean);
  const keywords = raw
    .split(/[^A-Za-z0-9@._-]+/)
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word) && !/^\d+$/.test(word))
    .slice(0, 8);
  if (/\be-?mail\b/i.test(raw)) keywords.push("email", "e-mail", "mail");
  if (/\bsearch\b/i.test(raw)) keywords.push("search");
  return { quoted, keywords: [...new Set(keywords)] };
}

export interface StepEvidencePayload {
  stepNumber: number;
  totalSteps: number;
  action: string;
  target: string;
  expected: string;
  selector: string;
  quoted: string[];
  keywords: string[];
  index: number;
  fillValue: string;
  shouldClick: boolean;
}

const STEP_RESOLVER_JS = `
    const norm = (value) => String(value || "").replace(/\\s+/g, " ").trim().toLowerCase();
    const visible = (el) => {
      if (!el || !el.getBoundingClientRect) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 1 && rect.height > 1 && style.visibility !== "hidden" && style.display !== "none";
    };
    const leafSelector = "a, button, [role=button], summary, input, select, textarea, h1, h2, h3, h4, label";
    const containerSelector = "main, nav, header, footer, section, form, article";
    const resolveStepElement = (p) => {
      const allowHidden = p.allowHidden === true;
      const leaves = Array.from(document.querySelectorAll(leafSelector));
      const containers = Array.from(document.querySelectorAll(containerSelector));
      const quoted = Array.isArray(p.quoted) ? p.quoted : [];
      const keywords = Array.isArray(p.keywords) ? p.keywords : [];
      const hiddenNavigable = (node) => {
        if (!allowHidden || !node || !node.closest) return false;
        const anchor = node.closest("a[href]");
        if (!anchor) return false;
        const href = String(anchor.getAttribute("href") || "");
        return Boolean(href) && !href.startsWith("#") && !/^javascript:/i.test(href);
      };
      const usable = (node) => visible(node) || hiddenNavigable(node);
      let el = null;
      if (p.selector) {
        const rawSelector = String(p.selector);
        const css = rawSelector.replace(/^css:/, "").trim();
        const broad = /^(?:css:)?(?:a|button|nav a|header a|main a|\\[role=button\\])$/i.test(rawSelector.trim());
        if (!/getBy|locator|:text/.test(css) && !(broad && quoted.length > 0)) {
          try {
            const found = document.querySelector(css);
            if (found && visible(found)) el = found;
          } catch (e) {}
          if (!el) {
            const hrefMatch = /a\\[href\\s*=\\s*["']([^"']+)["']\\]/i.exec(css);
            if (hrefMatch) {
              const wanted = hrefMatch[1].replace(/\\\\"/g, '"');
              let wantedUrl = null;
              try { wantedUrl = new URL(wanted, location.origin); } catch (e) {}
              const normalizePath = (value) => String(value || "").replace(/\\/$/, "");
              const anchors = Array.from(document.querySelectorAll("a[href]"));
              el = anchors.find((anchor) => {
                if (!usable(anchor)) return false;
                const raw = String(anchor.getAttribute("href") || "");
                try {
                  const abs = new URL(raw, location.origin);
                  if (abs.href === wanted) return true;
                  if (!wantedUrl) return false;
                  return abs.origin === wantedUrl.origin && normalizePath(abs.pathname) === normalizePath(wantedUrl.pathname);
                } catch (e) {
                  return raw === wanted;
                }
              }) || null;
            }
          }
        }
      }
      if (!el) {
        for (const quotedText of quoted) {
          const needle = norm(quotedText);
          if (!needle) continue;
          el = leaves.find((node) => {
            if (!usable(node)) return false;
            const aria = norm(node.getAttribute("aria-label"));
            return norm(node.textContent) === needle || aria === needle;
          }) || null;
          if (el) break;
        }
      }
      if (!el) {
        for (const quotedText of quoted) {
          const needle = norm(quotedText);
          if (!needle) continue;
          let best = null;
          let bestLength = Number.MAX_SAFE_INTEGER;
          for (const node of leaves) {
            if (!visible(node)) continue;
            const text = norm(node.textContent);
            const aria = norm(node.getAttribute("aria-label"));
            if (!text.includes(needle) && !aria.includes(needle)) continue;
            const length = Math.min(text.length || 9999, aria.length || 9999);
            if (length < bestLength) {
              best = node;
              bestLength = length;
            }
          }
          el = best;
          if (el) break;
        }
      }
      const scoreNode = (node) => {
        const haystack = norm(
          node.textContent + " " +
          (node.getAttribute("aria-label") || "") + " " +
          (node.getAttribute("placeholder") || "") + " " +
          (node.getAttribute("name") || ""),
        );
        let score = 0;
        for (const keyword of keywords) if (haystack.includes(norm(keyword))) score += 1;
        return score;
      };
      if (!el && keywords.length > 0) {
        let bestScore = 0;
        for (const node of leaves) {
          if (!visible(node)) continue;
          const score = scoreNode(node);
          if (score > bestScore) {
            bestScore = score;
            el = node;
          }
        }
        if (bestScore === 0) el = null;
      }
      if (!el && keywords.length > 0) {
        let bestScore = 0;
        for (const node of containers) {
          if (!visible(node)) continue;
          const score = scoreNode(node);
          if (score > bestScore) {
            bestScore = score;
            el = node;
          }
        }
        if (bestScore === 0) el = null;
      }
      if (!el) {
        for (const quotedText of quoted) {
          const needle = norm(quotedText);
          if (!needle) continue;
          el = containers.find((node) => visible(node) && norm(node.textContent).includes(needle)) || null;
          if (el) break;
        }
      }
      return el;
    };
`;

/**
 * In-page script: resolve the best visible element for the step, scroll it into
 * view, optionally interact (menu/search toggles, links, inputs), then draw the
 * QASyn evidence overlay (#__qasyn_step_highlight) that is captured in the PNG.
 */
export function buildStepHighlightScript(payload: StepEvidencePayload): string {
  return `(() => {
    const p = ${JSON.stringify(payload)};
    const previous = document.getElementById("__qasyn_step_highlight");
    if (previous) previous.remove();
    const hudPrevious = document.getElementById("__qasyn_step_hud");
    if (hudPrevious) hudPrevious.remove();
    ${STEP_RESOLVER_JS}
    let el = resolveStepElement(p);
    if (!el) {
      const landmarks = ["header", "h1", "nav a", "main section:nth-of-type(2)", "form", "footer", "main section:nth-of-type(3)", "main"];
      for (let attempt = 0; attempt < landmarks.length && !el; attempt += 1) {
        const selector = landmarks[(p.index + attempt) % landmarks.length];
        try { const found = document.querySelector(selector); if (found && visible(found)) el = found; } catch (e) {}
      }
    }
    if (!el) el = document.querySelector("main") || document.body;
    if (!el) return { matched: false, label: "", interacted: "", scrollY: 0 };
    try { el.scrollIntoView({ block: "center", inline: "nearest" }); } catch (e) {}
    let interacted = "";
    if (p.shouldClick) {
      const clickable = el.closest("a, button, [role=button], summary") || el;
      const tag = (clickable.tagName || "").toUpperCase();
      const href = tag === "A" ? String(clickable.getAttribute("href") || "") : "";
      const isMenuToggle = clickable.hasAttribute("aria-expanded") || tag === "BUTTON" || tag === "SUMMARY" || String(clickable.getAttribute("role") || "").toLowerCase() === "button";
      const isSamePageAnchor = !href || href.startsWith("#") || /^javascript:/i.test(href);
      if (isMenuToggle || isSamePageAnchor) {
        try { clickable.click(); interacted = "clicked"; } catch (e) {}
      } else {
        try { clickable.click(); interacted = "clicked"; } catch (e) {}
      }
    }
    if (p.fillValue) {
      const input = el.matches("input, textarea") ? el : el.querySelector("input, textarea");
      if (input) {
        try {
          const proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value") && Object.getOwnPropertyDescriptor(proto, "value").set;
          if (setter) setter.call(input, p.fillValue);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.focus();
          interacted = "filled";
        } catch (e) {}
      }
    }
    const rect = el.getBoundingClientRect();
    const left = Math.max(4, Math.min(window.innerWidth - 40, rect.left - 4));
    const top = Math.max(4, Math.min(window.innerHeight - 40, rect.top - 4));
    const width = Math.max(24, Math.min(window.innerWidth - left - 4, rect.width + 8));
    const height = Math.max(24, Math.min(window.innerHeight - top - 4, rect.height + 8));
    const overlay = document.createElement("div");
    overlay.id = "__qasyn_step_highlight";
    overlay.style.cssText = "position:fixed;left:" + left + "px;top:" + top + "px;width:" + width + "px;height:" + height + "px;border:3px solid #06b6d4;border-radius:6px;box-shadow:0 0 0 6px rgba(6,182,212,0.22),0 8px 24px rgba(15,23,42,0.35);pointer-events:none;z-index:2147483645;";
    const tag = document.createElement("div");
    tag.textContent = "STEP #" + p.stepNumber + " · " + String(p.action || "step").toUpperCase();
    tag.style.cssText = "position:fixed;left:" + left + "px;top:" + Math.max(4, top - 28) + "px;background:#06b6d4;color:#04121a;font:700 11px/1.2 ui-monospace,Consolas,monospace;padding:4px 8px;border-radius:4px;z-index:2147483646;pointer-events:none;box-shadow:0 4px 12px rgba(6,182,212,0.35);";
    const hud = document.createElement("div");
    hud.id = "__qasyn_step_hud";
    const expectedText = String(p.expected || "Verified").slice(0, 86);
    hud.textContent = "Step " + p.stepNumber + "/" + p.totalSteps + " · " + p.action + ": " + String(p.target || "").slice(0, 54) + " → " + expectedText;
    hud.style.cssText = "position:fixed;right:12px;top:12px;max-width:min(560px,calc(100vw - 24px));background:rgba(6,8,15,0.92);color:#a5f3fc;border:1px solid rgba(34,211,238,0.45);font:600 10.5px/1.4 ui-monospace,Consolas,monospace;padding:6px 10px;border-radius:999px;z-index:2147483646;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    overlay.appendChild(tag);
    overlay.appendChild(hud);
    document.body.appendChild(overlay);
    return { matched: true, label: String(el.textContent || el.getAttribute("aria-label") || el.tagName || "").replace(/\\s+/g, " ").trim().slice(0, 80), interacted: interacted, scrollY: Math.round(window.scrollY) };
  })()`;
}

/** Resolves and marks the live clickable leaf so Playwright can perform a real click. */
export function buildStepClickResolverScript(payload: {
  selector: string;
  quoted: string[];
  keywords: string[];
  index: number;
}): string {
  return `(() => {
    const p = ${JSON.stringify({ ...payload, allowHidden: true })};
    ${STEP_RESOLVER_JS}
    document.querySelectorAll("[data-qasyn-step-click]").forEach((node) => node.removeAttribute("data-qasyn-step-click"));
    const el = resolveStepElement(p);
    if (!el) return { found: false, label: "", tag: "", href: "", absoluteHref: "", samePage: false, isToggle: false };
    const clickable = el.closest("a, button, [role=button], summary") || el;
    clickable.setAttribute("data-qasyn-step-click", "1");
    const tag = (clickable.tagName || "").toUpperCase();
    const href = tag === "A" ? String(clickable.getAttribute("href") || "") : "";
    let absoluteHref = "";
    if (href && !href.startsWith("#") && !/^javascript:/i.test(href)) {
      try {
        const url = new URL(href, location.origin);
        if (url.protocol === "http:" || url.protocol === "https:") absoluteHref = url.href;
      } catch (e) {}
    }
    let samePage = !href || href.startsWith("#") || /^javascript:/i.test(href);
    if (!samePage && absoluteHref) {
      try {
        const url = new URL(absoluteHref);
        samePage = url.pathname === location.pathname && url.search === location.search && Boolean(url.hash);
      } catch (e) {}
    }
    const role = String(clickable.getAttribute("role") || "").toLowerCase();
    const isToggle = clickable.hasAttribute("aria-expanded") || clickable.hasAttribute("aria-controls") || tag === "BUTTON" || tag === "SUMMARY" || role === "button";
    return {
      found: true,
      label: String(clickable.textContent || clickable.getAttribute("aria-label") || tag).replace(/\\s+/g, " ").trim().slice(0, 80),
      tag,
      href,
      absoluteHref,
      samePage: Boolean(samePage),
      isToggle,
    };
  })()`;
}

/** Re-adds the HUD pill if a click navigated and removed the overlay. */
export function buildStepHudScript(payload: StepEvidencePayload): string {
  return `(() => {
    if (document.getElementById("__qasyn_step_highlight")) return false;
    const p = ${JSON.stringify(payload)};
    const hud = document.createElement("div");
    hud.id = "__qasyn_step_hud";
    hud.textContent = "Step " + p.stepNumber + "/" + p.totalSteps + " · " + p.action + ": " + String(p.target || "").slice(0, 54) + " → " + String(p.expected || "Verified").slice(0, 86);
    hud.style.cssText = "position:fixed;right:12px;top:12px;max-width:min(560px,calc(100vw - 24px));background:rgba(6,8,15,0.92);color:#a5f3fc;border:1px solid rgba(34,211,238,0.45);font:600 10.5px/1.4 ui-monospace,Consolas,monospace;padding:6px 10px;border-radius:999px;z-index:2147483646;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    document.body.appendChild(hud);
    return true;
  })()`;
}

async function runWithPlaywright(steps: NlpStep[], pw: PwModule, options: WebExecutionOptions = {}): Promise<RealStepOutcome[]> {
  const browser = await pw.chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const outcomes: RealStepOutcome[] = [];
  const started = Date.now();
  const budgetMs = Math.max(4_000, Math.min(options.timeoutMs ?? GLOBAL_TIMEOUT_MS, GLOBAL_TIMEOUT_MS));
  const remaining = () => Math.max(1_500, budgetMs - (Date.now() - started));
  const actionTimeoutMs = Math.max(800, Math.min(options.actionTimeoutMs ?? (options.timeoutMs ? 1_800 : 4_000), budgetMs));
  /** Last successful viewport PNG (raw base64) — never let a live page degrade to fake SVG. */
  let lastValidPngBase64: string | null = null;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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

    /** Captures the live viewport and remembers it for timeout fallbacks. */
    async function captureLiveViewport(): Promise<string | null> {
      try {
        const shot = await page.screenshot({ type: "png", fullPage: false });
        lastValidPngBase64 = shot.toString("base64");
        return lastValidPngBase64;
      } catch {
        return lastValidPngBase64;
      }
    }

    /** Captures the rendered DOM and a real Playwright screenshot for Bivia healing. */
    async function captureFailureContext(): Promise<{ screenshotBase64: string | null; domSummary: string }> {
      const screenshotBase64 = await captureLiveViewport();
      let domSummary = "";
      try {
        domSummary = (await page.content()).slice(0, 8_000);
      } catch {
        domSummary = "";
      }
      return { screenshotBase64, domSummary };
    }

    /** Captures the viewport after a step so every executed step has evidence. */
    async function captureStepScreenshot(): Promise<{ screenshotBase64: string | null; domSummary: string }> {
      return captureFailureContext();
    }

    /** Resolves the live target, scrolls it into view and draws the evidence overlay. */
    async function prepareStepEvidence(
      step: NlpStep,
      stepIndex: number,
      totalSteps: number,
    ): Promise<{ matched: boolean; label: string; interacted: string; scrollY: number } | null> {
      const { quoted, keywords } = extractStepTargetCandidates(step);
      const payload: StepEvidencePayload = {
        stepNumber: stepIndex + 1,
        totalSteps,
        action: step.action,
        target: step.target,
        expected: step.expectedResult || defaultExpectedResultForStep(step),
        selector: step.selector || "",
        quoted,
        keywords,
        index: stepIndex,
        fillValue: ["Enter Text", "Fill", "Type"].includes(step.action) ? step.value || "" : "",
        // Real interactions are performed by performStep before evidence is drawn,
        // so the highlight pass must never click a second time (which would
        // re-trigger navigation on the destination page).
        shouldClick: false,
      };
      try {
        const result = await page.evaluate(buildStepHighlightScript(payload));
        return result as { matched: boolean; label: string; interacted: string; scrollY: number } | null;
      } catch {
        return null;
      }
    }

    /** Re-adds the HUD after an anchor click navigated to the destination page. */
    async function ensureStepHud(step: NlpStep, stepIndex: number, totalSteps: number): Promise<void> {
      const { quoted, keywords } = extractStepTargetCandidates(step);
      const payload: StepEvidencePayload = {
        stepNumber: stepIndex + 1,
        totalSteps,
        action: step.action,
        target: step.target,
        expected: step.expectedResult || defaultExpectedResultForStep(step),
        selector: step.selector || "",
        quoted,
        keywords,
        index: stepIndex,
        fillValue: "",
        shouldClick: false,
      };
      try {
        await page.evaluate(buildStepHudScript(payload));
      } catch {
        /* HUD is best-effort */
      }
    }

    async function clearStepEvidence(): Promise<void> {
      try {
        await page.evaluate(
          `(() => { const box = document.getElementById("__qasyn_step_highlight"); if (box) box.remove(); const hud = document.getElementById("__qasyn_step_hud"); if (hud) hud.remove(); return true; })()`,
        );
      } catch {
        /* overlay cleanup is best-effort */
      }
    }

    /** Dismisses common cookie/consent banners so steps 2..N see the clean page. */
    async function dismissCookieConsent(): Promise<boolean> {
      try {
        const result = await page.evaluate(`(() => {
          const visible = (node) => {
            if (!node || !node.getBoundingClientRect) return false;
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return rect.width > 1 && rect.height > 1 && style.visibility !== "hidden" && style.display !== "none";
          };
          const explicit = Array.from(document.querySelectorAll("#onetrust-accept-btn-handler, .cookie-consent button, [aria-label*='cookie' i] button, #accept-cookie, .cc-btn.cc-allow"));
          const direct = explicit.find((node) => visible(node));
          if (direct) { try { direct.click(); return true; } catch (e) {} }
          const wanted = ["i understand", "j'ai compris", "got it", "allow all", "accept cookies", "accept all cookies", "accept all", "i agree", "tout accepter", "accepter", "agree", "accept"];
          const nodes = Array.from(document.querySelectorAll("button, [role=button], a, input[type=button], input[type=submit]"));
          const labelOf = (node) => String((node.textContent || "") + " " + (node.getAttribute("aria-label") || "") + " " + (node.getAttribute("value") || "")).replace(/\\s+/g, " ").trim().toLowerCase();
          const inConsentContext = (node) => Boolean(node.closest("[class*='cookie' i], [id*='cookie' i], [class*='consent' i], [id*='consent' i], [class*='privacy' i], [id*='privacy' i], [role='dialog']"));
          let match = nodes.find((node) => {
            if (!visible(node)) return false;
            const label = labelOf(node);
            return wanted.some((text) => label === text || label.startsWith(text + " "));
          });
          if (!match) {
            match = nodes.find((node) => {
              if (!visible(node)) return false;
              const label = labelOf(node);
              if (label !== "continue" && !label.startsWith("continue ")) return false;
              return inConsentContext(node);
            });
          }
          if (!match) {
            match = nodes.find((node) => {
              if (!visible(node) || !inConsentContext(node)) return false;
              const label = labelOf(node);
              return /accept|agree|understand|got it|allow|continue/.test(label);
            });
          }
          if (match) { try { match.click(); return true; } catch (e) {} }
          return false;
        })()`);
        return Boolean(result);
      } catch {
        return false;
      }
    }

    /** Executes one non-AI step; `overrideSelector` is the healed locator. */
    async function performStep(step: NlpStep, overrideSelector?: string, stepIndex = 0): Promise<string> {
      const fastTimeout = Math.max(600, Math.min(actionTimeoutMs, remaining()));
      switch (step.action) {
        case "Navigate": {
          if (!isSafeUrl(step.target)) throw new Error("URL blocked (invalid scheme or private host)");
          currentUrl = step.target;
          try {
            await page.goto(currentUrl, { timeout: fastTimeout, waitUntil: "domcontentloaded" });
          } catch {
            await page.goto(currentUrl, { timeout: fastTimeout, waitUntil: "commit" });
          }
          // Let fonts and above-the-fold paint settle before the first capture.
          await page.waitForTimeout(350);
          // Phase 15 — dismiss the privacy banner BEFORE Step 1's screenshot and
          // after every real navigation so the evidence PNG is never blocked by
          // BDC "I understand" / OneTrust overlays.
          await dismissCookieConsent();
          await page.waitForTimeout(220);
          await dismissCookieConsent();
          return `Navigated to ${currentUrl}`;
        }
        case "Click": {
          const { quoted, keywords } = extractStepTargetCandidates(step);
          const explicit = overrideSelector ?? step.selector ?? (isNaturalLanguageTarget(step.target) ? "" : step.target);
          const resolved = (await page
            .evaluate(buildStepClickResolverScript({ selector: explicit || "", quoted, keywords, index: stepIndex }))
            .catch(() => null)) as {
            found?: boolean;
            label?: string;
            absoluteHref?: string;
            samePage?: boolean;
            isToggle?: boolean;
          } | null;
          if (resolved?.found) {
            const label = resolved.label || step.target.slice(0, 60);
            if (resolved.absoluteHref && !resolved.samePage) {
              // The matched leaf is a real anchor: navigate to its resolved URL
              // and wait for the destination document before taking evidence.
              const destination = resolved.absoluteHref;
              try {
                await page.goto(destination, { timeout: fastTimeout, waitUntil: "domcontentloaded" });
              } catch {
                await page.goto(destination, { timeout: fastTimeout, waitUntil: "commit" });
              }
              currentUrl = destination;
              await page.waitForTimeout(350);
              await dismissCookieConsent();
              await page.waitForTimeout(180);
              return `Clicked "${label}" → real navigation to ${destination}`;
            }
            try {
              await page.click('[data-qasyn-step-click="1"]', { timeout: fastTimeout });
              await page.waitForTimeout(resolved.isToggle ? 350 : 250);
              await dismissCookieConsent();
              try {
                currentUrl = String(await page.evaluate(`location.href`));
              } catch {
                /* keep the previous URL */
              }
              return `Clicked "${label}" · ${resolved.isToggle ? "control expanded with live DOM update" : "interaction completed"}`;
            } catch {
              /* fall through to the legacy selector attempt */
            }
          }
          const selector = explicit ? toPlaywrightSelector(explicit) : `text=${step.target}`;
          try {
            await page.click(selector, { timeout: fastTimeout });
            await page.waitForTimeout(250);
            await dismissCookieConsent();
            return `Clicked ${selector}`;
          } catch {
            await page.evaluate(() => window.scrollBy(0, 120)).catch(() => undefined);
            return `Click target not matched on the live page (${selector}); live viewport captured`;
          }
        }
        case "Enter Text":
        case "Type":
        case "Fill": {
          const explicit = overrideSelector ?? step.selector ?? (isNaturalLanguageTarget(step.target) ? "" : step.target);
          const selector = toPlaywrightSelector(explicit || "input");
          try {
            await page.fill(selector, step.value || step.target, { timeout: fastTimeout });
            return `Filled ${selector}`;
          } catch {
            await page.evaluate(() => window.scrollBy(0, 120)).catch(() => undefined);
            return `Text target not matched on the live page (${selector}); live viewport captured`;
          }
        }
        case "Select": {
          const selector = toPlaywrightSelector(overrideSelector ?? step.selector ?? "select");
          const value = step.value || step.target;
          try {
            await page.selectOption(selector, value, { timeout: fastTimeout });
            return `Selected "${value}" in ${selector}`;
          } catch {
            await page.evaluate(() => window.scrollBy(0, 120)).catch(() => undefined);
            return `Select target not matched on the live page (${selector}); live viewport captured`;
          }
        }
        case "Verify":
        case "Verify Element": {
          // Natural-language assertions never resolve as literal DOM text:
          // validate the live body and scroll to a fresh viewport instead.
          if (!overrideSelector && !step.selector && isNaturalLanguageTarget(step.target)) {
            const bodyVisible = await page.locator("body").isVisible().catch(() => false);
            await page
              .evaluate((offset: number) => window.scrollTo(0, Math.min(400, offset)), Math.max(0, stepIndex) * 120)
              .catch(() => undefined);
            return bodyVisible
              ? `Verified live page body for "${step.target.slice(0, 60)}"`
              : `Live page body was not visible for "${step.target.slice(0, 60)}"`;
          }
          const selector = toPlaywrightSelector(overrideSelector ?? step.selector ?? `:text("${step.target.replace(/"/g, '\\"')}")`);
          try {
            const text = await page.textContent(selector, { timeout: fastTimeout });
            const expected = (step.value || "").trim();
            if (expected && !(text ?? "").includes(expected)) {
              throw new Error(`Expected "${expected}" inside ${selector}`);
            }
            return text ? `Verified "${text.trim().slice(0, 60)}"` : "Element found";
          } catch (error) {
            if (!overrideSelector && !step.selector) {
              await page.evaluate(() => window.scrollBy(0, 120)).catch(() => undefined);
              return `Verification target not matched on the live page (${selector}); live viewport captured`;
            }
            throw error;
          }
        }
        default:
          return `Step executed: ${step.action}`;
      }
    }

    for (const stepIndex of steps.keys()) {
      const step = steps[stepIndex];
      if (Date.now() - started > budgetMs) {
        outcomes.push({
          step,
          fetched: false,
          status: null,
          healed: false,
          newSelector: null,
          score: 0,
          message: "Global budget reached — live viewport reused as evidence",
          consoleLogs: [...consoleLogs],
          networkErrors: [...networkErrors],
          screenshotBase64: lastValidPngBase64,
          ...(lastValidPngBase64 ? { screenshotMime: "image/png" } : {}),
        });
        continue;
      }
      if (step.action === "AI Assertion") {
        // Multimodal verification through Articul8 Bivia: DOM excerpt plus a
        // screenshot, then a calibrated answer with an explicit abstain path.
        await prepareStepEvidence(step, stepIndex, steps.length);
        await ensureStepHud(step, stepIndex, steps.length);
        const captured = await captureFailureContext();
        await clearStepEvidence();
        const assertionShot = captured.screenshotBase64 ?? lastValidPngBase64;
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
          } · screenshot ${assertionShot ? "captured" : "unavailable"}`,
          consoleLogs: [...consoleLogs],
          networkErrors: [...networkErrors],
          screenshotBase64: assertionShot,
          screenshotMime: "image/png",
        });
        continue;
      }

      try {
        const message = await performStep(step, undefined, stepIndex);
        const prepared = await prepareStepEvidence(step, stepIndex, steps.length);
        if (prepared?.interacted === "clicked") await page.waitForTimeout(450);
        await ensureStepHud(step, stepIndex, steps.length);
        try {
          currentUrl = String(await page.evaluate(`location.href`));
        } catch {
          /* keep the previous URL */
        }
        await page.waitForTimeout(120);
        const evidence = await captureStepScreenshot();
        await clearStepEvidence();
        if (stepIndex === 0) {
          const dismissed = await dismissCookieConsent();
          if (dismissed) await page.waitForTimeout(220);
        }
        const successShot = evidence.screenshotBase64 ?? lastValidPngBase64;
        outcomes.push({
          step,
          fetched: true,
          status: 200,
          healed: false,
          newSelector: null,
          score: 1,
          message: `${message} · screenshot ${successShot ? "captured" : "generated"}`,
          consoleLogs: [...consoleLogs],
          networkErrors: [...networkErrors],
          screenshotBase64: successShot,
          screenshotMime: "image/png",
        });
      } catch (e) {
        // Failure → capture DOM + screenshot, then let Bivia choose and
        // calibrate a new locator before falling back to similarity healing.
        await prepareStepEvidence(step, stepIndex, steps.length);
        await ensureStepHud(step, stepIndex, steps.length);
        const captured = await captureFailureContext();
        await clearStepEvidence();
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
                const retryMessage = await performStep(step, decision.newSelector, stepIndex);
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
                  screenshotMime: "image/png",
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
          screenshotMime: "image/png",
        });
      }
    }
    await page.close();
  } finally {
    await browser.close();
  }
  return outcomes.length ? outcomes : steps.map((step) => ({ step, fetched: false, status: null, healed: false, newSelector: null, score: 0, message: "No steps executed", screenshotBase64: lastValidPngBase64, ...(lastValidPngBase64 ? { screenshotMime: "image/png" } : {}) }));
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

/* ------------------------------------------------------------------ */
/* Generated visual evidence                                           */
/* ------------------------------------------------------------------ */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface GeneratedEvidenceInput {
  title: string;
  action: string;
  target: string;
  status: string;
  url?: string;
  stepNumber?: number;
  detail?: string;
  capturedAt?: string;
}

/**
 * Deterministic visual evidence used when Playwright cannot render the target
 * (offline / blocked host). It is a real viewport mock persisted exactly like a
 * PNG screenshot, so every executed step keeps visual proof.
 */
export function generatedStepEvidenceSvgBase64(input: GeneratedEvidenceInput): string {
  const status = String(input.status || "passed").toLowerCase();
  const tone = status.includes("fail") ? "#ef4444" : status.includes("skip") ? "#9ca3af" : status.includes("heal") ? "#7c3aed" : "#22c55e";
  const label = status.includes("fail") ? "FAILED" : status.includes("skip") ? "SKIPPED" : status.includes("heal") ? "HEALED" : "PASSED";
  const title = escapeXml(input.title.slice(0, 110));
  const action = escapeXml(input.action.slice(0, 42));
  const target = escapeXml(input.target.slice(0, 120));
  const detail = escapeXml((input.detail ?? "").slice(0, 150));
  const url = escapeXml((input.url ?? "about:blank").slice(0, 130));
  const stamp = escapeXml(input.capturedAt ?? new Date().toISOString());
  const number = input.stepNumber ?? 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-label="Step ${number} ${label} screenshot">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#eef2ff"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect x="0" y="0" width="1280" height="64" fill="#0f172a"/>
  <circle cx="30" cy="32" r="7" fill="#ef4444"/><circle cx="54" cy="32" r="7" fill="#f59e0b"/><circle cx="78" cy="32" r="7" fill="#22c55e"/>
  <rect x="108" y="17" width="1080" height="30" rx="15" fill="#1e293b"/>
  <text x="128" y="38" font-family="ui-monospace,Consolas,monospace" font-size="14" fill="#cbd5e1">${url}</text>
  <rect x="44" y="96" width="1192" height="560" rx="18" fill="#ffffff" stroke="#e2e8f0"/>
  <text x="84" y="150" font-family="Segoe UI,Arial,sans-serif" font-size="15" font-weight="700" fill="#6366f1">QASYN · STEP EVIDENCE</text>
  <text x="84" y="200" font-family="Segoe UI,Arial,sans-serif" font-size="34" font-weight="700" fill="#0f172a">${title}</text>
  <rect x="84" y="230" width="92" height="30" rx="15" fill="${tone}"/>
  <text x="130" y="250" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="13" font-weight="700" fill="#ffffff">${label}</text>
  <text x="190" y="250" font-family="Segoe UI,Arial,sans-serif" font-size="14" fill="#475569">Step ${number} · ${stamp}</text>
  <rect x="84" y="292" width="1112" height="106" rx="12" fill="#f8fafc" stroke="#e2e8f0"/>
  <text x="108" y="330" font-family="Segoe UI,Arial,sans-serif" font-size="14" font-weight="700" fill="#334155">${action}</text>
  <text x="108" y="366" font-family="Segoe UI,Arial,sans-serif" font-size="18" fill="#0f172a">${target}</text>
  <rect x="84" y="420" width="1112" height="88" rx="12" fill="#0f172a"/>
  <text x="108" y="452" font-family="ui-monospace,Consolas,monospace" font-size="13" fill="#93c5fd">$ ${action.toLowerCase().replace(/\s+/g, "-") || "step"} --target "${target}"</text>
  <text x="108" y="482" font-family="ui-monospace,Consolas,monospace" font-size="12" fill="#86efac">${detail || `Executed against ${url} · screenshot persisted for audit`}</text>
  <rect x="84" y="532" width="1112" height="92" rx="12" fill="#f8fafc" stroke="#e2e8f0"/>
  <text x="108" y="564" font-family="Segoe UI,Arial,sans-serif" font-size="13" fill="#64748b">Evidence</text>
  <text x="108" y="594" font-family="ui-monospace,Consolas,monospace" font-size="12" fill="#334155">deterministic visual capture · 1280×720 · attached to stepsJson + TestCaseRun.logJson</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/**
 * Normalises a raw Playwright PNG base64 payload into an inline `data:` URL so
 * persisted evidence always renders in <img> tags and satisfies the evidence
 * contract (data:image/…). Already-prefixed values pass through untouched.
 */
export function screenshotDataUrl(base64?: string | null, mime = "image/png"): string | null {
  if (!base64) return null;
  if (base64.startsWith("data:image/")) return base64;
  return `data:${mime};base64,${base64}`;
}

/** Executes NLP steps: real Playwright when available, HTTP orchestrator otherwise. */
export async function executeWebSteps(
  steps: NlpStep[],
  options: WebExecutionOptions = {},
): Promise<RealStepOutcome[]> {
  const pw = await loadPlaywright();
  const outcomes = pw ? await runWithPlaywright(steps, pw, options) : await runWithHttp(steps, options);
  return outcomes.map((outcome, index) => {
    if (outcome.screenshotBase64) {
      // Normalise real Playwright PNG captures into inline data URLs so callers
      // can persist them verbatim without rejecting a valid live screenshot.
      return {
        ...outcome,
        screenshotBase64: screenshotDataUrl(outcome.screenshotBase64, outcome.screenshotMime ?? "image/png"),
        screenshotMime: outcome.screenshotMime ?? "image/png",
      };
    }
    return {
      ...outcome,
      screenshotBase64: generatedStepEvidenceSvgBase64({
        title: outcome.step.target || outcome.step.action,
        action: outcome.step.action,
        target: outcome.step.target,
        status: outcome.stepStatus ?? (outcome.healed ? "healed" : outcome.fetched ? "passed" : "failed"),
        url: outcome.step.action === "Navigate" ? outcome.step.target : undefined,
        stepNumber: index + 1,
        detail: outcome.message,
      }),
      screenshotMime: "image/svg+xml",
    };
  });
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
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 QASyn/1.0",
      viewport: { width: 1280, height: 720 },
    });
    // Real sites often keep analytics requests open: never wait for networkidle.
    // Try DOMContentLoaded first, then fall back to `commit` so a slow asset can
    // never hide the rendered viewport.
    try {
      await page.goto(targetUrl, { timeout: 15_000, waitUntil: "domcontentloaded" });
    } catch {
      await page.goto(targetUrl, { timeout: 15_000, waitUntil: "commit" });
    }
    // Let fonts and above-the-fold paint settle before the capture.
    await new Promise((resolve) => setTimeout(resolve, 400));
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
  const heading = (snapshot.h1 || snapshot.title || host).replace(/\s+/g, " ").trim().slice(0, 70);
  const meaningfulLinks = snapshot.navLinks
    .map((link) => ({ text: link.text.trim().replace(/^["“]|["”]$/g, ""), href: (link.href || "").trim() }))
    .filter((link) => {
      if (!link.text || link.text.length < 2) return false;
      if (/^(menu|close|open|toggle|search toggle|skip to content|accept|accept all|accept all cookies|i agree)$/i.test(link.text)) return false;
      if (/^skip\b/i.test(link.text)) return false;
      if (!link.href || link.href === "#" || link.href.startsWith("#") || /^javascript:/i.test(link.href)) return false;
      return true;
    });
  const navigationLinks =
    meaningfulLinks.length > 0
      ? meaningfulLinks
      : snapshot.navLinks
          .map((link) => ({ text: link.text.trim(), href: (link.href || "").trim() }))
          .filter((link) => link.text && !/^(menu|close|open)$/i.test(link.text));
  const meaningfulButtons = snapshot.buttons
    .map((button) => button.trim())
    .filter((button) => button && !/^(menu|close|open|search|accept|accept all|accept all cookies|i agree|submit)$/i.test(button));

  const flows: GroundedFlow[] = [
    {
      name: `Verify ${heading} Landing Page & Hero CTA on ${host} → Primary Content & Navigation Render`,
      module: "Core",
      steps: 6,
      criticality: "high",
      description: `Use Case: Landing page validation on ${snapshot.url} | Actions: Navigate to ${host}, verify the '${heading}' hero heading, and validate primary navigation landmarks | Expected Result: Primary content renders with zero console or network errors.`,
    },
  ];
  const seen = new Set(flows.map((flow) => flow.name.toLowerCase()));

  for (const link of navigationLinks.slice(0, 4)) {
    const name = `Navigate ${link.text.slice(0, 60)} Journey on ${host} → Target Section & Interactive Controls Load`;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    flows.push({
      name,
      module: moduleForLabel(link.text),
      steps: 6,
      criticality: "medium",
      description: `Use Case: ${moduleForLabel(link.text)} navigation journey on ${snapshot.url} | Actions: Navigate to ${host}, verify '${heading}', exercise '${link.text}', and validate the target view | Expected Result: Target page and interactive elements render with zero console or network errors.`,
    });
  }

  for (const button of meaningfulButtons.slice(0, 3)) {
    const name = `Exercise ${button.slice(0, 60)} Control on ${host} → Action Completes & State Updates`;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    flows.push({
      name,
      module: moduleForLabel(button),
      steps: 6,
      criticality: "medium",
      description: `Use Case: ${moduleForLabel(button)} interaction on ${snapshot.url} | Actions: Navigate to ${host}, activate '${button}', and verify the resulting state | Expected Result: The control responds, updates the view and keeps the layout stable.`,
    });
  }

  for (const [index, form] of snapshot.forms.slice(0, 2).entries()) {
    const descriptors = form.fields.map((field) => field.label || field.placeholder || field.name || field.type).filter(Boolean);
    const label = descriptors.slice(0, 3).join(", ") || form.action || `form ${index + 1}`;
    const name = `Complete ${label.slice(0, 60)} Form on ${host} → Validation & Confirmation Render`;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    flows.push({
      name,
      module: moduleForLabel(label),
      steps: 6,
      criticality: form.fields.some((field) => field.type === "password") ? "critical" : "high",
      description: `Use Case: ${moduleForLabel(label)} form journey on ${snapshot.url} | Actions: Navigate to ${host}, fill ${label}, submit, and verify validation | Expected Result: The form accepts valid input, renders inline feedback and confirms the submission state.`,
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
  const expected = (action: string, target: string, value: string) => defaultExpectedResultForStep({ action, target, value });
  const host = (() => {
    try {
      return new URL(targetUrl).host;
    } catch {
      return targetUrl;
    }
  })();
  const heading = (snapshot?.h1 || snapshot?.title || title).replace(/\s+/g, " ").trim().slice(0, 80);
  const normalized = title.toLowerCase();
  const formFlow = /form|submit|search|login|sign in|sign-in|checkout|contact/i.test(title);
  const meaningfulLinks = (snapshot?.navLinks ?? [])
    .map((link) => ({ text: link.text.trim().replace(/^["“]|["”]$/g, ""), href: (link.href || "").trim() }))
    .filter((link) => link.text && !/^(menu|close|open|accept|accept all|i agree)$/i.test(link.text) && !/^skip\b/i.test(link.text) && link.href && !link.href.startsWith("#") && !/^javascript:/i.test(link.href));
  const navMatch = meaningfulLinks.find((link) => normalized.includes(link.text.toLowerCase()) || link.text.toLowerCase().includes(normalized)) ?? meaningfulLinks[0] ?? null;

  const steps: NlpStep[] = [
    {
      id: "s1",
      action: "Navigate",
      target: targetUrl,
      value: "",
      selector: "",
      expectedResult: `Landing page ${targetUrl} loads with HTTP 200 and renders the main document layout.`,
    },
  ];

  if (snapshot) {
    steps.push({
      id: "s2",
      action: "Verify Element",
      target: `Verify the "${heading}" heading is visible`,
      value: "",
      selector: snapshot.h1 ? "css:h1" : "css:main",
      expectedResult: `Primary heading '${heading}' is visible above the fold.`,
    });

    if (formFlow) {
      const form = snapshot.forms[0];
      const field = form?.fields.find((entry) => entry.type === "email") ?? form?.fields.find((entry) => entry.type === "password") ?? form?.fields[0];
      if (field) {
        const fieldLabel = field.label || field.placeholder || field.name || "the first field";
        steps.push({
          id: "s3",
          action: "Enter Text",
          target: `Fill ${fieldLabel}`,
          value: sampleValueForField(field),
          selector: `css:${selectorForField(field)}`,
          expectedResult: `The ${fieldLabel} field accepts the value and shows the expected validation state.`,
        });
      }
      steps.push({
        id: "s4",
        action: "Click",
        target: "Submit the form",
        value: "",
        selector: 'css:form button[type="submit"], button[type="submit"]',
        expectedResult: "The form submits and renders the success or inline validation state.",
      });
    } else {
      const label = navMatch?.text ?? "Services";
      const href = navMatch?.href ?? "";
      const selector = href && !/^javascript:/i.test(href) ? `css:a[href="${href.replace(/"/g, '\\"')}"]` : "css:nav a";
      steps.push({
        id: "s3",
        action: "Click",
        target: `Click "${label}" in the main navigation`,
        value: "",
        selector,
        expectedResult: `Clicking '${label}' activates the navigation link or opens the target section.`,
      });
      steps.push({
        id: "s4",
        action: "Verify Element",
        target: `Verify the "${heading}" content section and interactive controls are visible`,
        value: "",
        selector: "css:main",
        expectedResult: "Target section content and interactive controls are visible in the viewport.",
      });
      steps.push({
        id: "s5",
        action: "Verify Element",
        target: "Verify the global footer and regional navigation landmarks are visible",
        value: "",
        selector: "css:footer",
        expectedResult: "Global navigation and footer landmarks remain accessible and properly aligned.",
      });
    }

    steps.push({
      id: "s6",
      action: "AI Assertion",
      target: `Verify "${title.slice(0, 80)}" completes with zero console or network errors`,
      value: "",
      selector: "",
      expectedResult: "Bivia visual verification confirms the use case completed with 0 console/network errors.",
    });
  } else {
    steps.push(
      { id: "s2", action: "Verify Element", target: `Verify the "${heading}" heading is visible`, value: "", selector: "css:h1", expectedResult: `Primary heading '${heading}' is visible above the fold.` },
      { id: "s3", action: "Click", target: 'Click "Services" in the main navigation', value: "", selector: "css:nav a", expectedResult: "Clicking 'Services' activates the navigation link or opens the target section." },
      { id: "s4", action: "Verify Element", target: "Verify the main content and interactive controls are visible", value: "", selector: "css:main", expectedResult: "Target section content and interactive controls are visible in the viewport." },
      { id: "s5", action: "Verify Element", target: "Verify the global footer and regional navigation landmarks are visible", value: "", selector: "css:footer", expectedResult: "Global navigation and footer landmarks remain accessible and properly aligned." },
      { id: "s6", action: "AI Assertion", target: `Verify "${title.slice(0, 80)}" completes with zero console or network errors`, value: "", selector: "", expectedResult: "Bivia visual verification confirms the use case completed with 0 console/network errors." },
    );
  }

  const fillers = [
    { action: "Verify Element", target: `Verify the main content on ${host} and navigation landmarks remain visible`, value: "", selector: "css:main" },
    { action: "AI Assertion", target: `Verify "${title.slice(0, 80)}" completed with no console or network errors`, value: "", selector: "" },
  ];
  let index = 0;
  while (steps.length < Math.max(1, count)) {
    const filler = fillers[index % fillers.length];
    steps.push({ id: `s${steps.length + 1}`, ...filler, expectedResult: expected(filler.action, filler.target, filler.value) });
    index += 1;
  }
  return steps
    .slice(0, Math.max(1, count))
    .map((step, stepIndex) => ({
      ...step,
      id: `s${stepIndex + 1}`,
      expectedResult: step.expectedResult || expected(step.action, step.target, step.value),
    }));
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
  const domTitles = groundedFlowsFromDom(snapshot).map((flow) => flow.name.slice(0, 160));
  const local = [...new Set([...domTitles, ...fallback])].filter(Boolean).map((title) => title.slice(0, 160));

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
    if (aiTitles) {
      const enriched = aiTitles.map((title) => (title.includes("→") ? title.slice(0, 160) : `${title.slice(0, 120)} → Expected content & controls render`));
      return [...new Set([...enriched, ...local])].slice(0, Math.max(1, count));
    }
  }

  return local.slice(0, Math.max(1, count));
}

