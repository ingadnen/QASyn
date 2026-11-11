/**
 * DOM similarity auto-healing: when a recorded selector no longer matches,
 * score every candidate element of the current DOM against the originally
 * recorded element (tag, attributes, text, position) and pick the best one.
 *
 * Context7 Playwright rules are injected into every healing decision so the
 * replacement prefers accessible, stable selectors over generated CSS chains.
 */
import { context7Guidance } from "./context7";
export interface DomElement {
  tag: string;
  attrs: Record<string, string>;
  text: string;
  index: number;
}

export interface RecordedElement {
  tag: string;
  selector?: string;
  attrs?: Record<string, string>;
  text?: string;
  index?: number;
}

/** Minimal HTML parser: extracts opening tags with attributes and inner text. */
export function parseDom(html: string): DomElement[] {
  const elements: DomElement[] = [];
  const re = /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>([^<]{0,120})/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(html)) !== null) {
    const attrs: Record<string, string> = {};
    for (const am of m[2].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[am[1]] = am[2];
    for (const am of m[2].matchAll(/([\w-]+)=('[^']*')/g)) attrs[am[1]] = am[2].slice(1, -1);
    elements.push({ tag: m[1].toLowerCase(), attrs, text: m[3].trim().slice(0, 120), index: i++ });
  }
  return elements;
}

/** Similarity score in [0,1]: tag 0.2, shared attrs 0.4, text 0.3, position 0.1. */
export function similarity(a: RecordedElement, b: DomElement): number {
  let score = 0;
  if (a.tag.toLowerCase() === b.tag) score += 0.2;
  const aAttrs = a.attrs ?? {};
  const keys = Object.keys(aAttrs);
  if (keys.length > 0) {
    const shared = keys.filter((k) => b.attrs[k] === aAttrs[k]).length;
    score += 0.4 * (shared / keys.length);
  } else if (a.selector) {
    // Fallback: token overlap between the original selector and candidate attrs.
    const tokens = a.selector.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
    const attrText = Object.values(b.attrs).join(" ").toLowerCase();
    const hits = tokens.filter((t) => attrText.includes(t)).length;
    score += 0.4 * (tokens.length ? hits / tokens.length : 0);
  }
  if (a.text && b.text) {
    const at = a.text.toLowerCase();
    const bt = b.text.toLowerCase();
    score += 0.3 * (at === bt ? 1 : at.includes(bt) || bt.includes(at) ? 0.5 : 0);
  }
  if (a.index !== undefined) {
    const dist = Math.abs(a.index - b.index);
    score += 0.1 * Math.max(0, 1 - dist / 50);
  }
  return score;
}

export interface HealResult {
  healed: boolean;
  score: number;
  newSelector: string | null;
  candidate?: DomElement;
  strategy?: "Test ID" | "Role" | "Text" | "CSS";
  guidance: string;
}

/** Tries to heal a broken selector against the current DOM. */
export function healSelector(recorded: RecordedElement, candidates: DomElement[], threshold = 0.45): HealResult {
  const guidance = context7Guidance("playwright locator healing accessible role", 3);
  let best: { el: DomElement; score: number } | null = null;
  for (const el of candidates) {
    const score = similarity(recorded, el);
    if (!best || score > best.score) best = { el, score };
  }
  if (!best || best.score < threshold) return { healed: false, score: best?.score ?? 0, newSelector: null, guidance };
  const el = best.el;
  const id = el.attrs["data-testid"] || el.attrs.id;
  const label = el.attrs["aria-label"] || el.attrs.name || el.text;
  const role = el.tag === "a" ? "link" : el.tag === "button" ? "button" : el.tag === "input" ? "textbox" : null;
  if (id) {
    return { healed: true, score: best.score, newSelector: `css:[data-testid="${id}"]`, candidate: el, strategy: "Test ID", guidance };
  }
  if (role && label) {
    return { healed: true, score: best.score, newSelector: `role=${role}[name="${label.replace(/"/g, '\\"').slice(0, 80)}"]`, candidate: el, strategy: "Role", guidance };
  }
  const newSelector = el.attrs.class ? `css:${el.tag}.${el.attrs.class.split(" ")[0]}` : `css:${el.tag} >> nth=${el.index}`;
  return { healed: true, score: best.score, newSelector, candidate: el, strategy: "CSS", guidance };
}
