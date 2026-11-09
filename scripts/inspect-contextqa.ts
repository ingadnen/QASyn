/**
 * PHASE 1 — Capture recursive totale de https://gmailad.contextqa.com.
 * 19 modules de la Sidebar + toutes les sous-vues, onglets, modales,
 * drawers, menus d'actions (⋯), selects et workflows.
 * Usage: npx tsx scripts/inspect-contextqa.ts
 * - Profil persistant .playwright-contextqa-profile (une seule session navigateur).
 * - Sortie: contextqa-dump/complete-site-map.json (pages + réseau).
 * - Nécessite une session authentifiée dans le profil. Si le site redirige
 *   vers /login, le script le signale et garde les captures existantes.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.CONTEXTQA_BASE ?? "https://gmailad.contextqa.com").replace(/\/$/, "");
const OUT = path.join(process.cwd(), "contextqa-dump");
const PROFILE = path.join(process.cwd(), ".playwright-contextqa-profile");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PROFILE, { recursive: true });

const OUT_FILE = path.join(OUT, "complete-site-map.json");

const ROUTES: Record<string, string> = {
  overview: "/dashboard/overview",
  "pull-requests": "/td/1/pr-impact-analysis",
  crawl: "/td/1/crawls",
  "code-analysis": "/td/1/code-analysis",
  requirements: "/td/1/requirements",
  "test-cases": "/td/1/cases/filter/2",
  "step-groups": "/td/1/step_groups/filter/4",
  suites: "/td/1/suites",
  "test-plans": "/td/1/plans",
  environments: "/td/1/environment-data-management/environments",
  "env-test-data-profiles": "/td/1/environment-data-management/test-data-profiles",
  "env-global-data": "/td/1/environment-data-management/global-data",
  "env-auth-profiles": "/td/1/environment-data-management/auth-profiles",
  uploads: "/dashboard/uploads",
  "knowledge-base": "/dashboard/knowledge-base",
  team: "/settings/team-access",
  tunnels: "/dashboard/tunnels",
  integrations: "/dashboard/integrations",
  billing: "/dashboard/billing",
  mcp: "/dashboard/mcp",
  "settings-organization": "/dashboard/settings/organization",
  "settings-audits": "/dashboard/settings/audits",
  "settings-analysis": "/dashboard/settings/analysis",
  "settings-bug-repro": "/dashboard/settings/bug-reproduction",
  "settings-api-tokens": "/dashboard/settings/api-tokens",
};

const MODAL_TRIGGERS: Array<{ key: string; button: RegExp; dialogName?: string }> = [
  { key: "modal-new-requirement", button: /New Requirement/i },
  { key: "modal-suite-create", button: /Create Test Suite|New Test Suite/i },
  { key: "modal-plan-create", button: /Create Test Plan|New Test Plan/i },
  { key: "modal-env-create", button: /New environment/i },
  { key: "modal-tdp-create", button: /New Test Data Profile|New test data profile/i },
  { key: "modal-global-variable", button: /New Global Variable/i },
  { key: "modal-auth-profile", button: /Add auth profile|New Auth/i },
  { key: "modal-upload-folder", button: /Create Folder|Upload File/i },
  { key: "modal-knowledge-add", button: /Add Knowledge Source/Add\b/i },
  { key: "modal-team-invite", button: /Invite user/i },
  { key: "modal-tunnel-machine", button: /Add machine|New Tunnel/i },
  { key: "modal-api-token", button: /Create token|Create API Token/i },
  { key: "modal-step-group", button: /New Step Group/i },
  { key: "modal-testcase-new", button: /Create Test Case|New Test Case/i },
];

async function visibleText(page: import("playwright").Page, locator: import("playwright").Locator): Promise<string> {
  try {
    return (await locator.innerText({ timeout: 3000 })).replace(/\s+/g, " ").trim().slice(0, 6000);
  } catch {
    return "";
  }
}

async function extractControls(page: import("playwright").Page, scope: import("playwright").Locator) {
  const inputs = await scope.locator("input, select, textarea").evaluateAll((els: Element[]) =>
    els.map((el: HTMLInputElement & HTMLSelectElement) => ({
      tag: el.tagName,
      type: (el as HTMLInputElement).type ?? null,
      name: (el as HTMLInputElement).name ?? "",
      id: (el as HTMLInputElement).id ?? "",
      aria: el.getAttribute("aria-label") ?? "",
      placeholder: (el as HTMLInputElement).placeholder ?? "",
      value: (el as HTMLInputElement).value ?? "",
      options: el.tagName === "SELECT" ? Array.from(el.options).map((o) => o.text) : undefined,
      checked: (el as HTMLInputElement).checked ?? undefined,
      disabled: (el as HTMLInputElement).disabled ?? false,
    })),
  );
  return inputs;
}

async function capturePage(
  page: import("playwright").Page,
  key: string,
  route: string,
  network: unknown[],
): Promise<Record<string, unknown>> {
  const url = `${BASE}${route}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1200);
  const title = await page.title().catch(() => "");
  const bodyText = (await page.locator("body").innerText().catch(() => "")).replace(/\s+\n/g, "\n").slice(0, 30000);
  const headings = await page
    .locator("h1, h2, h3")
    .evaluateAll((els: Element[]) => els.slice(0, 30).map((el) => ({ tag: el.tagName, text: (el as HTMLElement).innerText?.trim() ?? "" })))
    .catch(() => []);
  const tabs = await page
    .locator('[role="tab"]')
    .evaluateAll((els: Element[]) => els.map((el) => (el as HTMLElement).innerText?.trim() ?? ""))
    .catch(() => []);
  const buttons = await page
    .locator("button, a.btn, [role='button']")
    .evaluateAll((els: Element[]) =>
      els.slice(0, 80).map((el) => ({ text: (el as HTMLElement).innerText?.trim().slice(0, 120) ?? "", aria: el.getAttribute("aria-label"), disabled: (el as HTMLButtonElement).disabled ?? false })),
    )
    .catch(() => []);
  const tableHeaders = await page
    .locator("table thead th")
    .evaluateAll((els: Element[]) => els.slice(0, 30).map((el) => (el as HTMLElement).innerText?.trim() ?? ""))
    .catch(() => []);
  const controls = await extractControls(page, page.locator("body"));
  // Cliquer chaque onglet visible et absorber les erreurs (page live inconnue = on garde la base).
  const tabLocators = page.locator('[role="tab"]');
  const tabCount = await tabLocators.count();
  const tabTexts: string[] = [];
  for (let i = 0; i < Math.min(tabCount, 10); i++) {
    try {
      const label = ((await tabLocators.nth(i).innerText()) ?? "").trim();
      if (!label) continue;
      await tabLocators.nth(i).click({ timeout: 4000 });
      await page.waitForTimeout(700);
      tabTexts.push(label);
      const t = (await page.locator("body").innerText().catch(() => "")).slice(0, 8000);
      network.push({ type: "tab-capture", page: key, tab: label, textSnippet: t.slice(0, 600) });
    } catch {
      /* onglet non cliquable — on continue */
    }
  }
  // Menus d'actions (⋯ / more_vert) — première ligne.
  let rowActions: string[] = [];
  try {
    const more = page.locator('summary[aria-label="More actions"], button[aria-label="More actions"], button:has-text("more_vert")').first();
    if ((await more.count()) > 0) {
      await more.first().click({ timeout: 4000 });
      await page.waitForTimeout(600);
      rowActions = await page
        .locator('[role="menuitem"], [role="menu"] *')
        .evaluateAll((els: Element[]) => els.slice(0, 20).map((el) => (el as HTMLElement).innerText?.trim() ?? "").filter(Boolean))
        .catch(() => []);
      await page.keyboard.press("Escape");
    }
  } catch {
    /* ignore */
  }
  return { url, title, headings, tabs: tabTexts.length ? tabTexts : tabs, buttons, tableHeaders, controls, rowActions, text: bodyText };
}

async function captureModal(page: import("playwright").Page, trigger: { key: string; button: RegExp; dialogName?: string }, network: unknown[]) {
  try {
    const btn = page.getByRole("button", { name: trigger.button }).first();
    if ((await btn.count()) === 0) return null;
    await btn.click({ timeout: 4000 });
    await page.waitForTimeout(900);
    const dialog = page.locator('[role="dialog"], dialog').first();
    const target = (await dialog.count()) > 0 ? dialog : page.locator("body");
    const text = (await target.innerText().catch(() => "")).slice(0, 12000);
    const controls = await extractControls(page, target);
    // Ouvrir chaque select pour lister ses options.
    const selects = target.locator("select");
    for (let i = 0; i < (await selects.count()); i++) {
      try {
        await selects.nth(i).click({ timeout: 2500 });
        await page.waitForTimeout(350);
        const opts = await page.locator('[role="option"], [role="listbox"] *').evaluateAll((els: Element[]) => els.slice(0, 30).map((el) => (el as HTMLElement).innerText?.trim() ?? "")).catch(() => []);
        network.push({ type: "select-options", page: trigger.key, index: i, options: opts });
        await page.keyboard.press("Escape");
      } catch {
        /* select non ouvrable — on garde les options natives */
      }
    }
    const snap = { key: trigger.key, url: page.url(), text, controls };
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    return snap;
  } catch {
    return null;
  }
}

async function main() {
  const browser = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    viewport: { width: 1440, height: 900 },
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const network: Record<string, unknown>[] = [];
  const watched = ["server.contextqa.com", "gcpn1.contextqa.com", "web-finder.contextqa.com"];
  page.on("request", (req) => {
    if (watched.some((h) => req.url().includes(h))) {
      network.push({ type: "request", method: req.method(), url: req.url(), postData: req.postData()?.slice(0, 2000) ?? "" });
    }
  });
  page.on("response", async (res) => {
    if (watched.some((h) => res.url().includes(h))) {
      let snippet = "";
      try {
        const text = await res.text();
        snippet = text.slice(0, 2000);
      } catch {
        /* binaire */
      }
      network.push({ type: "response", status: res.status(), url: res.url(), snippet });
    }
  });

  const pages: Record<string, unknown> = {};
  // Garder l'existant si la session n'est pas authentifiée (redirect login).
  let authenticated = true;
  try {
    await page.goto(`${BASE}/dashboard/overview`, { waitUntil: "domcontentloaded", timeout: 20000 });
    authenticated = !page.url().includes("/login") && !page.url().includes("/signin");
  } catch {
    authenticated = false;
  }
  if (!authenticated) {
    console.log("Session non authentifiée sur gmailad.contextqa.com — capture conservée telle quelle.");
    console.log("Ouvrez https://gmailad.contextqa.com dans le profil .playwright-contextqa-profile, connectez-vous, puis relancez.");
    await browser.close();
    return;
  }

  for (const [key, route] of Object.entries(ROUTES)) {
    try {
      const snap = await capturePage(page, key, route, network);
      pages[key] = snap;
      console.log(`✓ ${key} (${route})`);
    } catch (e) {
      console.log(`✗ ${key} — ${e instanceof Error ? e.message.split("\n")[0] : "error"}`);
    }
  }
  for (const trigger of MODAL_TRIGGERS) {
    try {
      const snap = await captureModal(page, trigger, network);
      if (snap) {
        pages[trigger.key] = snap;
        console.log(`✓ ${trigger.key}`);
      }
    } catch (e) {
      console.log(`✗ ${trigger.key} — ${e instanceof Error ? e.message.split("\n")[0] : "error"}`);
    }
  }

  let existing: Record<string, unknown> = {};
  if (fs.existsSync(OUT_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(OUT_FILE, "utf8")) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }
  const mergedPages = { ...((existing.pages as Record<string, unknown>) ?? {}), ...pages };
  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify(
      {
        source: BASE,
        capturedAt: new Date().toISOString(),
        pages: mergedPages,
        network,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(`Capturé: ${Object.keys(mergedPages).length} pages + ${network.length} événements réseau → contextqa-dump/complete-site-map.json`);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
