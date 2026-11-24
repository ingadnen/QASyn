/* QASyn content script: records clicks, inputs, form submissions and
 * navigations with resilient selectors (data-testid, ARIA label, CSS path),
 * and draws a highlight overlay on hover while recording. */

(() => {
  if (window.__qasynRecorder) return;
  window.__qasynRecorder = true;

  let recording = false;
  let steps = [];

  const SELECTOR_PRIORITY = ["data-testid", "data-test", "aria-label", "name", "id"];

  function selectorFor(el) {
    for (const attr of SELECTOR_PRIORITY) {
      const value = el.getAttribute && el.getAttribute(attr);
      if (value) return attr === "data-testid" || attr === "data-test" ? `[data-testid="${value}"]` : `[${attr}="${value}"]`;
    }
    const path = [];
    let node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE && path.length < 5) {
      let part = node.nodeName.toLowerCase();
      if (node.parentNode && node.parentNode.children) {
        const siblings = Array.from(node.parentNode.children).filter((c) => c.nodeName === node.nodeName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      path.unshift(part);
      node = node.parentNode;
    }
    return path.join(" > ");
  }

  function labelFor(el) {
    return (
      el.getAttribute("aria-label") ||
      (el.textContent || "").trim().slice(0, 60) ||
      el.getAttribute("name") ||
      el.tagName.toLowerCase()
    );
  }

  function push(step) {
    if (!recording) return;
    steps.push({ at: Date.now(), ...step });
    chrome.runtime.sendMessage({ type: "step-recorded", step }).catch(() => {});
  }

  document.addEventListener(
    "click",
    (event) => {
      const el = event.target.closest("a,button,[role=button],[type=submit]") || event.target;
      push({ action: "click", selector: selectorFor(el), label: labelFor(el) });
    },
    true,
  );

  document.addEventListener(
    "change",
    (event) => {
      const el = event.target;
      if (!el.matches("input,textarea,select")) return;
      push({
        action: el.type === "checkbox" || el.type === "radio" ? "toggle" : "fill",
        selector: selectorFor(el),
        label: labelFor(el),
        value: el.type === "password" ? "•••" : String(el.value || "").slice(0, 80),
      });
    },
    true,
  );

  document.addEventListener("submit", (event) => {
    push({ action: "submit", selector: selectorFor(event.target), label: labelFor(event.target) });
  }, true);

  let highlight = null;
  document.addEventListener("mouseover", (event) => {
    if (!recording) return;
    highlight = highlight || document.createElement("div");
    const rect = event.target.getBoundingClientRect();
    highlight.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;border:2px solid #0F6B5C;border-radius:4px;pointer-events:none;z-index:2147483647;background:rgba(15,107,92,.08)`;
    document.documentElement.appendChild(highlight);
  });
  document.addEventListener("mouseout", () => {
    if (highlight) { highlight.remove(); highlight = null; }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "start-recording") {
      recording = true;
      steps = [];
      sendResponse({ ok: true });
    } else if (message.type === "stop-recording") {
      recording = false;
      if (highlight) { highlight.remove(); highlight = null; }
      sendResponse({ ok: true, steps, url: location.href, title: document.title });
    } else if (message.type === "recording-state") {
      sendResponse({ ok: true, recording, steps });
    } else if (message.type === "page-summary") {
      const interactive = document.querySelectorAll("a,button,input,select,textarea,[role=button]").length;
      sendResponse({
        ok: true,
        url: location.href,
        title: document.title,
        domSummary: { interactiveElements: interactive, headings: Array.from(document.querySelectorAll("h1,h2")).slice(0, 8).map((h) => h.textContent.trim().slice(0, 60)) },
      });
    } else {
      sendResponse({ ok: false });
    }
  });
})();
