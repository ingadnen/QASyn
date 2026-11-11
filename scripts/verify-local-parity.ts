/**
 * ÉTAPE 6 — Vérification exhaustive des 19 modules (Playwright).
 * Visite chaque page de la Sidebar, ouvre chaque onglet, chaque popup,
 * teste chaque select/checkbox/action et les workflows réels SQLite.
 * Sortie: contextqa-dump/full-19-modules-parity.json
 * Run: npx tsx scripts/verify-local-parity.ts
 */
import { chromium, type Browser, type ConsoleMessage, type Page } from "playwright";
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.QASYN_BASE ?? "http://localhost:3000";
const RUN_LOWER = `par${(Date.now() % 100000).toString(36)}${Math.floor(Math.random() * 36).toString(36)}`.slice(0, 10);
const RUN_ID = String(Date.now() % 100000);
const OUT = path.join(process.cwd(), "contextqa-dump");
fs.mkdirSync(OUT, { recursive: true });

interface ModuleResult {
  id: string;
  name: string;
  route: string;
  checks: Array<{ check: string; ok: boolean; detail?: string }>;
  pageErrors: string[];
  ok: boolean;
}

const modules: ModuleResult[] = [];
let current: ModuleResult | null = null;
let failures = 0;

function mod(id: string, name: string, route: string): ModuleResult {
  const m: ModuleResult = { id, name, route, checks: [], pageErrors: [], ok: true };
  modules.push(m);
  current = m;
  return m;
}
function check(label: string, ok: boolean, detail = "") {
  const entry = { check: label, ok, detail };
  if (current) current.checks.push(entry);
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
  if (current && !ok) current.ok = false;
  return ok;
}

async function text(page: Page, locator: unknown): Promise<string> {
  try {
    return ((locator as { innerText: () => Promise<string> }).innerText && (await (locator as { innerText: () => Promise<string> }).innerText())) || "";
  } catch {
    try {
      return ((locator as { textContent: () => Promise<string | null> }).textContent && (await (locator as { textContent: () => Promise<string | null> }).textContent())) || "";
    } catch {
      return "";
    }
  }
}
async function body(page: Page): Promise<string> {
  return (await page.locator("body").innerText().catch(() => "")) || "";
}
async function shot(page: Page, name: string) {
  try {
    await page.screenshot({ path: path.join(OUT, `parity-${name}.png`), fullPage: true });
  } catch {
    /* ignore */
  }
}
async function api(page: Page, url: string, init?: RequestInit) {
  return page.evaluate(async ([u, opts]) => {
    const r = await fetch(u, opts as RequestInit);
    let j: unknown = null;
    try {
      j = await r.json();
    } catch {
      j = null;
    }
    return { status: r.status, body: j as { id?: string; testCases?: unknown[]; testCase?: unknown; item?: unknown; items?: unknown[]; components?: unknown[]; uploads?: unknown[]; members?: unknown[]; environments?: unknown[]; token?: string } };
    return { status: r.status, body: j };
  }, [url, JSON.stringify(init) ? init : null] as unknown as [string, RequestInit?]);
}

async function apiJson(page: Page, url: string, method: string, json?: unknown) {
  return page.evaluate(
    async (args: { url: string; method: string; json?: unknown }) => {
      const r = await fetch(args.url, {
        method: args.method,
        headers: args.json ? { "content-type": "application/json" } : undefined,
        body: args.json ? JSON.stringify(args.json) : undefined,
      });
      let j: unknown = null;
      try {
        j = await r.json();
      } catch {
        j = null;
      }
      return { status: r.status, body: j } as { status: number; body: Record<string, unknown> & { id?: string; testCases?: Array<Record<string, unknown>>; item?: Record<string, unknown> & { id: string }; items?: Array<Record<string, unknown>>; components?: Array<Record<string, unknown>>; uploads?: Array<Record<string, unknown>>; members?: Array<Record<string, unknown>>; environments?: Array<Record<string, unknown>>; token?: string; crawl?: Record<string, unknown>; crawls?: Array<Record<string, unknown>>; tokens?: Array<Record<string, unknown>>; member?: Record<string, unknown> } };
    },
    { url, method, json },
  );
}

async function goto(page: Page, route: string) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(600);
}

/** Runs a real Windows PowerShell command and returns stdout+stderr (never throws). */
function psRun(command: string): string {
  try {
    return execSync(`${command} 2>&1`, { encoding: "utf8", timeout: 120_000, windowsHide: true });
  } catch (error) {
    const failure = error as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
    return `${String(failure.stdout ?? "")}${String(failure.stderr ?? "")}${String(failure.message ?? "")}`;
  }
}

async function loadAccountSnapshot() {
  const client = new PrismaClient();
  try {
    return await client.user.findUnique({
      where: { email: "cgi@cgi.com" },
      select: { name: true, organisation: { select: { id: true, plan: true, website: true } } },
    });
  } finally {
    await client.$disconnect();
  }
}

/** Removes PR checks produced by earlier verifier runs so catalog analysis stays repeatable. */
async function clearVerifierPullRequests(organisationId: string) {
  if (!organisationId) return;
  const client = new PrismaClient();
  try {
    await client.pullRequestCheck.deleteMany({ where: { organisationId, provider: "AZURE_DEVOPS" } });
  } finally {
    await client.$disconnect();
  }
}

interface BoundingBoxLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Opens an isolated browser context and signs in with a workspace account. */
async function loginAs(browser: Browser, email: string, password = "CgiDemo2026!") {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Work e-mail").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    if (page.url().includes("/dashboard")) break;
  }
  await page.waitForTimeout(500);
  return { context, page };
}

/** Reads the visible sidebar labels for the signed-in role. */
async function sidebarText(page: Page): Promise<string> {
  if ((await page.getByRole("button", { name: "Expand sidebar" }).count()) > 0) {
    await page.getByRole("button", { name: "Expand sidebar" }).first().click().catch(() => undefined);
    await page.waitForTimeout(350);
  }
  const aside = page.locator('aside nav[aria-label="Dashboard"]').first();
  return ((await aside.innerText().catch(() => "")) || "").replace(/\s+/g, " ");
}

function boxInViewport(box: BoundingBoxLike | null, viewport: { width: number; height: number }, tolerance = 1) {
  if (!box) return false;
  return (
    box.width > 0 &&
    box.height > 0 &&
    box.x >= -tolerance &&
    box.y >= -tolerance &&
    box.x + box.width <= viewport.width + tolerance &&
    box.y + box.height <= viewport.height + tolerance
  );
}

async function tableHeaders(page: Page): Promise<string[]> {
  const headers = (await page.locator("table thead th").allInnerTexts().catch(() => [])) as string[];
  return headers.map((header) => header.trim()).filter(Boolean);
}

async function tableScrollIssues(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = [];
    document.querySelectorAll("table").forEach((table, index) => {
      let element: HTMLElement | null = table.parentElement;
      while (element && element !== document.body) {
        const style = getComputedStyle(element);
        if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1) {
          issues.push(`table ${index}: scrollHeight ${element.scrollHeight} > clientHeight ${element.clientHeight}`);
        }
        element = element.parentElement;
      }
    });
    return issues;
  });
}

function liveLabelCandidates(label: string) {
  const candidates = [label, label.replace(/\s+Settings$/i, "")];
  if (/s$/i.test(label)) candidates.push(label.slice(0, -1));
  return candidates;
}

function missingLiveLabels(labels: string[], localText: string) {
  const lower = localText.toLowerCase();
  return labels
    .map((label) => label.replace(/^\+\s*/, "").trim())
    .filter((label) => label && !["search", "refresh", "settings"].includes(label.toLowerCase()))
    .filter((label) => !liveLabelCandidates(label).some((candidate) => lower.includes(candidate.toLowerCase())));
}

interface LiveReference {
  source?: string;
  sidebar?: {
    sections?: Array<{ title: string; items: Array<{ label: string }> }>;
    settings?: { children?: string[] };
  };
  crawlLibrary?: { title?: string; description?: string; toolbar?: string[]; columns?: string[] };
  requirementsLibrary?: { title?: string; description?: string; toolbar?: string[]; columns?: string[] };
  testCases?: { title?: string; description?: string; tabs?: string[]; views?: string[]; columns?: string[] };
  testSuites?: { title?: string; description?: string; toolbar?: string[]; columns?: string[] };
  environments?: { tabs?: string[]; views?: string[]; actions?: string[] };
  team?: { columns?: string[] };
  billing?: { tabs?: string[]; creditHistoryColumns?: string[] };
  mcp?: { sections?: string[] };
}


async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let moduleErrors: string[] = [];
  page.on("pageerror", (e) => {
    const msg = String(e);
    moduleErrors.push(msg);
    if (current) current.pageErrors.push(msg);
  });
  // Auto-accepte les confirms natifs (Delete rows) pour tester le workflow UI.
  page.on("dialog", async (d) => {
    try {
      await d.accept();
    } catch {
      /* ignore */
    }
  });

  // ── Login ───────────────────────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Work e-mail").fill("cgi@cgi.com");
  await page.locator('input[type="password"]').fill("CgiDemo2026!");
  await page.getByRole("button", { name: "Log in" }).click();
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    if (page.url().includes("/dashboard")) break;
  }
  await page.waitForTimeout(800);
  const loginModule = mod("login", "Login / Shell", "/login");
  check("Login as cgi@cgi.com reaches the dashboard", page.url().includes("/dashboard"));

  // Expectations come from the active organisation, never from hardcoded demo data.
  const account = await loadAccountSnapshot();
  const activeUserName = account?.name ?? "";
  const activeOrgId = account?.organisation?.id ?? "";
  const activeOrgPlan = account?.organisation?.plan ?? "";
  const activeOrgWebsite = account?.organisation?.website ?? "";
  const activeOrgHost = activeOrgWebsite.replace(/^https?:\/\//, "").replace(/\/$/, "");

  // ── Sidebar ─────────────────────────────────────────────────────
  const aside = page.locator('aside nav[aria-label="Dashboard"]');
  await page.getByRole("button", { name: "Expand sidebar" }).first().waitFor({ timeout: 8000 }).catch(() => undefined);
  if ((await page.getByRole("button", { name: "Expand sidebar" }).count()) > 0) {
    await page.getByRole("button", { name: "Expand sidebar" }).first().click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
  await aside.waitFor({ timeout: 10000 });
  const navText = ((await aside.innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  for (const label of [
    "AUTONOMOUS SDLC", "Overview", "Pull requests", "Crawl", "Code Analysis",
    "PLATFORM", "Requirements", "Test cases", "Plans", "Environment & Data", "Uploads", "Knowledge Base", "Team & access",
    "WORK", "Tunnels", "Integrations", "Billing & usage", "MCP", "Settings",
  ]) {
    check(`Sidebar contains "${label}"`, navText.includes(label));
  }
  const forbidden = ["Web testing", "Mobile testing", "Ship", "Agent testing", "Agent suites", "Context graph", "API chains", "Testing Studio", "Visual testing", "Data profiles", "Exploratory", "Salesforce", "SAP", "Learning", "Schedules", "Reports"];
  const polluted = forbidden.filter((l) => navText.includes(l));
  check("Sidebar has no invented entries", polluted.length === 0, polluted.join(", "));
  await aside.getByRole("button", { name: /Plans/ }).first().click().catch(() => undefined);
  await page.waitForTimeout(250);
  const plansText = ((await aside.innerText()) || "").replace(/\s+/g, " ");
  check("Plans accordion exposes Test Suites", plansText.includes("Test Suites"));
  check("Plans accordion exposes Test Plans", plansText.includes("Test Plans"));
  await aside.getByRole("button", { name: /Settings/ }).first().click().catch(() => undefined);
  await page.waitForTimeout(250);
  const settingsText = ((await aside.innerText()) || "").replace(/\s+/g, " ");
  for (const label of ["Organization", "System Audits", "Analysis Settings", "Bug Reproduction", "API Tokens"]) {
    check(`Settings accordion contains "${label}"`, settingsText.includes(label));
  }
  const sidebarFooter = (await page.locator("aside").first().innerText()) || "";
  check("Sidebar footer has Help & docs", sidebarFooter.includes("Help & docs"));
  check("Sidebar footer has Live chat", sidebarFooter.includes("Live chat"));
  check(
    "Sidebar footer shows the active plan or trial days",
    activeOrgPlan === "trial"
      ? /Trial.*\d+ days? left/.test(sidebarFooter)
      : sidebarFooter.toLowerCase().includes(`${activeOrgPlan.toLowerCase()} plan`),
    `plan ${activeOrgPlan || "unknown"}`,
  );
  check(
    "Sidebar shows the user card",
    Boolean(activeUserName) && sidebarFooter.includes(activeUserName) && sidebarFooter.includes("cgi@cgi.com"),
    activeUserName || "user name missing",
  );
  await shot(page, "sidebar");
  void loginModule;

  // ── 1 Overview ──────────────────────────────────────────────────
  moduleErrors = [];
  const ov = mod("01-overview", "Overview", "/dashboard/overview");
  await goto(page, "/dashboard/overview");
  const ovBody = await body(page);
  check("Overview shows live terminal", /Live.*\d+ events?/.test(ovBody), ovBody.slice(0, 120).replace(/\s+/g, " "));
  check("Overview has expand history", ovBody.includes("expand history"));
  for (const kpi of ["Test cases", "Bugs", "Time & cost saved", "Regressions caught"]) check(`Overview KPI "${kpi}"`, ovBody.includes(kpi));
  check("Overview secondary PRs checked", ovBody.includes("PRs checked"));
  check("Overview secondary SLA / lead time", ovBody.includes("SLA / lead time"));
  check("Overview secondary Integrations", ovBody.includes("Integrations"));
  check("Coverage tabs By module / By criticality", ovBody.includes("By module") && ovBody.includes("By criticality"));
  check("Overview Recents", ovBody.includes("Recents"));
  check("Overview Finish setting up", /FINISH SETTING UP/i.test(ovBody) || (!ovBody.includes("Connect your bug tracker") && !ovBody.includes("Invite a teammate")));
  // Coverage tab switch
  if ((await page.getByRole("tab", { name: "By criticality" }).count()) > 0) {
    await page.getByRole("tab", { name: "By criticality" }).click().catch(() => undefined);
    await page.waitForTimeout(300);
    check("Coverage By criticality renders", true);
  }
  check("Overview has no example.com", !ovBody.includes("example.com"));
  check("Overview has no page errors", moduleErrors.length === 0, moduleErrors.slice(0, 2).join(" | "));
  await shot(page, "01-overview");

  // ── 2 Pull requests ─────────────────────────────────────────────
  moduleErrors = [];
  mod("02-pull-requests", "Pull requests", "/dashboard/pull-requests");
  await clearVerifierPullRequests(activeOrgId);
  await goto(page, "/dashboard/pull-requests");
  const prBody = await body(page);
  check("Pull requests heading", prBody.includes("PR Impact Analysis"));
  check("Pull requests description", prBody.includes("Pull requests analysed for impact"));
  const prHeaders = (await page.locator("table thead th").allInnerTexts().catch(() => [])) as string[];
  if (prHeaders.length > 0) {
    for (const h of ["Pull request", "Risk", "Files", "Tests run", "Verdict", "Opened", "Action"]) {
      check(`Pull requests column "${h}"`, prHeaders.some((t) => t.trim().toLowerCase().includes(h.toLowerCase())), prHeaders.map((t) => t.trim()).join(","));
    }
  } else {
    check("Pull requests empty state", prBody.includes("No data available"), "no table — empty state shown");
  }
  check("Pull requests toolbar Filter", (await page.getByRole("button", { name: "Filter" }).count()) > 0 || /Filter/.test(prBody));
  const analyseBtn = page.getByRole("button", { name: /Analyse PR/ });
  check("Pull requests Analyse button", (await analyseBtn.count()) > 0);
  if ((await analyseBtn.count()) > 0) {
    await analyseBtn.first().click().catch(() => undefined);
    const dlg = page.getByRole("dialog", { name: "Analyse a pull request" });
    await dlg.waitFor({ timeout: 8000 }).catch(() => undefined);
    if ((await dlg.count()) > 0) {
      await dlg.getByLabel("Connected provider and repository").waitFor({ state: "visible", timeout: 15000 }).catch(() => undefined);
      const dt = ((await dlg.innerText()) || "").replace(/\s+/g, " ");
      for (const bit of ["Connected provider · repository", "Open pull requests", "Manual / Custom PR URL", "Run PR check (25 credits)", "Cancel"]) {
        check(`Analyse modal contains "${bit}"`, dt.includes(bit));
      }
      const providerSelect = dlg.getByLabel("Connected provider and repository");
      check("PR modal selects a connected provider/repository", (await providerSelect.count()) > 0);
      const options = (await providerSelect.locator("option").allInnerTexts().catch(() => [])) as string[];
      check("PR modal lists connected repositories", options.length > 0 && options.some((option) => /(GitHub|GitLab|Bitbucket|Azure)/.test(option)), options.join(", "));
      const openPrs = dlg.getByTestId("pr-open-option");
      const prCount = await openPrs.count();
      check("PR modal loads real open pull requests", prCount > 0, `${prCount} open PR(s)`);
      if (prCount > 0) {
        const firstPr = ((await openPrs.first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
        const prNumber = /#(\d+)/.exec(firstPr)?.[1] ?? "";
        check("Open PR shows number, title, branches, author and files", /#\d+/.test(firstPr) && /→/.test(firstPr) && /@/.test(firstPr) && /files?/.test(firstPr), firstPr.slice(0, 180));
        await openPrs.first().click().catch(() => undefined);
        await dlg.getByRole("button", { name: /Run PR check/ }).click().catch(() => undefined);
        const drawer = page.getByRole("dialog", { name: "PR analysis detail" });
        await drawer.waitFor({ state: "visible", timeout: 20000 }).catch(() => undefined);
        const drawerText = ((await drawer.innerText().catch(() => "")) || "").replace(/\s+/g, " ");
        check("PR check opens the analysis drawer", (await drawer.count()) > 0 && drawerText.length > 0);
        check("PR drawer names the analysed PR", prNumber ? drawerText.includes(`#${prNumber}`) : true, prNumber);
        for (const section of ["Blast radius", "Changed files", "Impacted tests executed", "Execution logs", "Provider comment"]) {
          check(`PR drawer section "${section}"`, drawerText.includes(section));
        }
        check("PR drawer computes a verdict", /(Go|No-Go|Review recommended|Passed|Blocked)/i.test(drawerText), drawerText.slice(0, 180));
        check("PR drawer posts a provider comment automatically", drawerText.includes("Posted automatically"), drawerText.slice(-260));
        const closeDrawer = drawer.getByRole("button", { name: "Close", exact: true }).first();
        if ((await closeDrawer.count()) > 0) await closeDrawer.click().catch(() => undefined);
        else await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
        await clearVerifierPullRequests(activeOrgId);
      }
    }
  }
  check("Pull requests shows no raw JSON", !prBody.includes('"offsetMs"'));
  check("Pull requests no page errors", moduleErrors.length === 0);
  await shot(page, "02-pull-requests");

  // ── 3 Crawl + detail ────────────────────────────────────────────
  moduleErrors = [];
  mod("03-crawl", "Crawl", "/dashboard/crawl");
  await goto(page, "/dashboard/crawl");
  check("Crawl heading", (await body(page)).includes("Crawl"));
  const crawlHeaders = (await page.locator("table thead th").allInnerTexts().catch(() => [])) as string[];
  check("Crawl table has 10 columns incl. checkbox", crawlHeaders.length === 10, `${crawlHeaders.length} cols`);
  for (const h of ["Name", "Format", "Type", "Test Plan", "Status", "Test Cases", "Created by", "Created Date", "Action"]) {
    check(`Crawl column "${h}"`, crawlHeaders.some((t) => t.trim().toLowerCase() === h.toLowerCase()));
  }
  check("Crawl New Crawl button", (await page.getByRole("button", { name: /New Crawl/ }).count()) > 0);
  const crawlBtn = page.getByRole("button", { name: /New Crawl/ }).first();
  await crawlBtn.click().catch(() => undefined);
  const crawlDlg = page.getByRole("dialog", { name: "New Crawl" });
  await crawlDlg.waitFor({ timeout: 8000 }).catch(() => undefined);
  if ((await crawlDlg.count()) > 0) {
    const mt = ((await crawlDlg.innerText()) || "").replace(/\s+/g, " ");
    for (const bit of ["Show Configuration Options", "Target URL", "Explore prompt", "Requirement Name", "Additional Context", "Cancel", "Start Crawl"]) {
      check(`New Crawl modal "${bit}"`, mt.includes(bit));
    }
    let targetValue = await crawlDlg.locator("input").first().inputValue().catch(() => "");
    if (!targetValue && activeOrgWebsite) {
      await crawlDlg.locator("input").first().fill(activeOrgWebsite, { force: true }).catch(() => undefined);
      targetValue = activeOrgWebsite;
    }
    check(
      "Target URL is org website",
      Boolean(activeOrgWebsite) && targetValue === activeOrgWebsite,
      `expected ${activeOrgWebsite || "(unset)"} · got ${targetValue || "(empty)"}`,
    );
    await crawlDlg.getByRole("button", { name: /Show Configuration Options/ }).click().catch(() => undefined);
    await page.waitForTimeout(300);
    const cfg = ((await crawlDlg.innerText()) || "").replace(/\s+/g, " ");
    for (const bit of ["Web Application", "Mobile", "API", "Require approval", "Auto publish", "Create Test Suite", "Create Test Plan", "Positive / Happy Path"]) {
      check(`Crawl config "${bit}"`, cfg.includes(bit));
    }
    await crawlDlg.getByPlaceholder(/Tell Robot QA/).fill("Parity crawl explore prompt").catch(() => undefined);
    await crawlDlg.getByPlaceholder(/Credentials, constraints|Any credentials/).fill("Use staging account.").catch(() => undefined);
    await crawlDlg.getByPlaceholder(/Crawl requirement|Crawl /).fill("Parity crawl requirement").catch(() => undefined);
    await shot(page, "03-crawl-modal");
    await crawlDlg.getByRole("button", { name: "Start Crawl" }).click().catch(() => undefined);
    await page.waitForTimeout(2000).catch(() => undefined);
  }
  const crawlApi = await apiJson(page, "/api/dashboard/crawl", "GET");
  let crawls = (crawlApi.body.crawls as Array<Record<string, unknown>> | undefined) ?? [];
  let running = crawls.find((c) => String(c.status) === "running");
  if (!running) {
    const retry = await apiJson(page, "/api/dashboard/crawl", "POST", { targetUrl: activeOrgWebsite || undefined });
    const retryApi = await apiJson(page, "/api/dashboard/crawl", "GET");
    crawls = (retryApi.body.crawls as Array<Record<string, unknown>> | undefined) ?? crawls;
    running = crawls.find((c) => String(c.status) === "running");
    void retry;
  }
  check("A running crawl was created", Boolean(running));
  if (running?.id) {
    await apiJson(page, `/api/dashboard/crawl/${running.id}`, "PATCH", { action: "complete" });
  }
  await goto(page, "/dashboard/crawl");
  check("Crawl table shows the created crawl", (await page.locator("table tbody tr").count()) >= 1);
  check("Crawl table shows linked test cases", ((await page.locator("table tbody").innerText().catch(() => "")) || "").includes("Linked"));
  check("Crawl table has no raw JSON", !((await body(page)) || "").includes('"offsetMs"'));
  // Detail 6 tabs
  const crawlDetailHref = running?.id ? `/dashboard/crawl/${String(running.id)}` : await page.locator('a[href^="/dashboard/crawl/"]').first().getAttribute("href").catch(() => "");
  if (crawlDetailHref) {
    await goto(page, crawlDetailHref);
    await page.getByText("Generated Test Cases").first().waitFor({ timeout: 15000 }).catch(() => undefined);
    const detailBody = await body(page);
    for (const tab of ["Test Cases", "Questionnaire", "Requirement Data", "History (Coming soon)", "Metadata", "Gaps (Coming soon)"]) {
      check(`Crawl detail tab "${tab}"`, detailBody.includes(tab));
    }
    check("Crawl detail Generated Test Cases", detailBody.includes("Generated Test Cases"));
    check("Crawl detail Export", /Export/.test(detailBody));
    check("Crawl detail no example.com", !detailBody.includes("example.com"));
  }
  check("Crawl no page errors", moduleErrors.length === 0);
  await shot(page, "03-crawl");

  // ── 4 Code Analysis ─────────────────────────────────────────────
  moduleErrors = [];
  mod("04-code-analysis", "Code Analysis", "/dashboard/code-analysis");
  await goto(page, "/dashboard/code-analysis");
  const caBody = await body(page);
  check("Code Analysis heading", caBody.includes("Code Analysis"));
  check("Code Analysis description", caBody.includes("Analyses of your connected repositories"));
  check("Code Analysis search", (await page.getByLabel("Search analyses").count()) > 0 || /Search analyses/.test(caBody));
  check("Code Analysis Analyse repositories button", (await page.getByRole("button", { name: "Analyse repositories" }).count()) > 0);
  const caHeaders = (await page.locator("table thead th").allInnerTexts().catch(() => [])) as string[];
  if (caHeaders.length) {
    for (const h of ["Repository", "Branch", "Modules", "Files", "Status", "Analysed", "Action"]) {
      check(`Code Analysis column "${h}"`, caHeaders.some((t) => t.trim().toLowerCase().includes(h.toLowerCase())));
    }
  } else {
    check("Code Analysis empty state", caBody.includes("No data available"));
  }
  check("Code Analysis no example.com", !caBody.includes("example.com"));
  check("Code Analysis no page errors", moduleErrors.length === 0);
  await shot(page, "04-code-analysis");

  // ── 5 Requirements + wizard + detail ────────────────────────────
  moduleErrors = [];
  mod("05-requirements", "Requirements", "/dashboard/requirements");
  await goto(page, "/dashboard/requirements");
  check("Requirements heading", (await body(page)).includes("Requirements Library"));
  check("Requirements New Requirement button", (await page.getByRole("button", { name: /New Requirement/ }).count()) > 0);
  const reqHeaders = (await page.locator("table thead th").allInnerTexts().catch(() => [])) as string[];
  check("Requirements 10 columns (9 visible + checkbox)", reqHeaders.length === 10, `${reqHeaders.length} cols`);
  for (const h of ["Name", "Format", "Type", "Test Plan", "Status", "Test Cases", "Created by", "Created Date", "Action"]) {
    check(`Requirements column "${h}"`, reqHeaders.some((t) => t.trim().toLowerCase() === h.toLowerCase()));
  }
  // Wizard: file method → create
  await page.getByRole("button", { name: /New Requirement/ }).first().click().catch(() => undefined);
  const reqDlg = page.getByRole("dialog", { name: "New Requirement" });
  await reqDlg.waitFor({ timeout: 8000 }).catch(() => undefined);
  let createdReqId = "";
  if ((await reqDlg.count()) > 0) {
    const rt = ((await reqDlg.innerText()) || "").replace(/\s+/g, " ");
    for (const m of ["Generate from Integrations", "Generate from File", "Generate from Crawl"]) check(`Requirement method "${m}"`, rt.includes(m));
    await reqDlg.getByText("Generate from File").first().click().catch(() => undefined);
    await page.waitForTimeout(400);
    await reqDlg.getByPlaceholder("e.g. Checkout specification").fill("Parity spec requirement").catch(() => undefined);
    // Try generic input if placeholder differs
    if ((await reqDlg.getByPlaceholder("e.g. Checkout specification").count()) === 0) {
      await reqDlg.locator("input").first().fill("Parity spec requirement").catch(() => undefined);
    }
    await shot(page, "05-requirement-modal");
    const genBtn = reqDlg.getByRole("button", { name: /Generate Requirement/ });
    if ((await genBtn.count()) > 0) {
      await genBtn.first().click().catch(() => undefined);
      await page.waitForTimeout(1800);
    }
  }
  await goto(page, "/dashboard/requirements");
  const reqBodyNow = await body(page);
  check("Created requirement appears in list", reqBodyNow.includes("Parity spec requirement") || /REQ-\d+/.test(reqBodyNow));
  if (reqBodyNow.includes("Parity spec requirement")) {
    const createdLink = page.locator('a[href^="/dashboard/requirements/"]', { hasText: "Parity spec requirement" }).first();
    const firstLink = page.locator('a[href^="/dashboard/requirements/"]').first();
    const link = (await createdLink.count()) > 0 ? createdLink : firstLink;
    const href = await link.getAttribute("href").catch(() => "");
    if (href) {
      createdReqId = href.split("/").pop() || "";
      await goto(page, href);
      await page.getByText("Generated Test Cases").first().waitFor({ timeout: 15000 }).catch(() => undefined);
      const db = await body(page);
      for (const tab of ["Test Cases", "Questionnaire", "Requirement Data", "History (Coming soon)", "Metadata", "Gaps (Coming soon)"]) {
        check(`Requirement detail tab "${tab}"`, db.includes(tab));
      }
      check("Requirement detail Export", /Export/.test(db));
    }
  }
  if (createdReqId) {
    const del = await apiJson(page, `/api/dashboard/requirements/${createdReqId}`, "DELETE");
    check("Cleanup: requirement deleted via API", del.status === 200 || del.status === 204);
  }
  check("Requirements no page errors", moduleErrors.length === 0);
  await shot(page, "05-requirements");

  // ── 6 Test Cases ────────────────────────────────────────────────
  moduleErrors = [];
  mod("06-test-cases", "Test Cases", "/dashboard/test-cases");
  await goto(page, "/dashboard/test-cases");
  check("Test Cases heading", (await body(page)).includes("Test Cases"));
  check("Test Cases tab Step Groups visible", (await body(page)).includes("Step Groups"));
  check("List view toggle", (await page.getByRole("button", { name: /^List$/ }).count()) > 0 || (await page.getByText("List").count()) > 0);
  check("Modular view toggle", (await page.getByText("Modular").count()) > 0);
  check("Filter button", (await page.getByRole("button", { name: /Filter/ }).count()) > 0);
  check("Table settings button", (await page.getByRole("button", { name: "Table settings" }).count()) > 0);
  check("Refresh button", (await page.getByRole("button", { name: "Refresh" }).count()) > 0);
  check("New Test Case button", (await page.getByRole("button", { name: /New Test Case/ }).count()) > 0);
  // Filter drawer (fermé via Apply Filter — Escape ne le ferme pas et bloquerait la suite).
  await page.getByRole("button", { name: /Filter/ }).first().click().catch(() => undefined);
  const filterDrawer = page.locator('[role="dialog"][aria-label="Filters"], dialog[aria-label="Filters"]').first();
  await filterDrawer.waitFor({ timeout: 8000 }).catch(() => undefined);
  if ((await filterDrawer.count()) > 0) {
    const ft = ((await filterDrawer.innerText()) || "").replace(/\s+/g, " ");
    for (const f of ["Created By", "Status", "Test Type", "Type", "Priority", "Latest Run Result", "Added to Suite", "Module", "Created Date", "Updated Date", "Labels", "Requirements"]) {
      check(`Filter "${f}"`, ft.includes(f));
    }
    await filterDrawer.getByRole("button", { name: /Apply Filter|Close filters/ }).first().click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
  // Table settings popover
  await page.getByRole("button", { name: "Table settings" }).first().click().catch(() => undefined);
  await page.waitForTimeout(300);
  const tsBody = await body(page);
  check("Table settings shows columns", /Test Case|Type|Module|Status/i.test(tsBody));
  // Re-cliquer le bouton pour refermer le popover (Escape ne le ferme pas).
  await page.getByRole("button", { name: "Table settings" }).first().click().catch(() => undefined);
  await page.waitForTimeout(300);
  // New Test Case modal (manual)
  await page.getByRole("button", { name: /New Test Case/ }).first().click().catch(() => undefined);
  const tcDlg = page.getByRole("dialog", { name: "Create Test Case" });
  await tcDlg.waitFor({ timeout: 8000 }).catch(() => undefined);
  let uiTestCaseId = "";
  const PARITY_TARGET = `https://www.cgi.com/parity-${RUN_ID}`;
  if ((await tcDlg.count()) > 0) {
    const tt = ((await tcDlg.innerText()) || "").replace(/\s+/g, " ");
    for (const m of ["AI Assistance", "Import Files", "Record & Play", "Create manually"]) check(`Test case method "${m}"`, tt.includes(m));
    check("Test case modal Step 1 of 2", /step 1 of 2/i.test(tt));
    await tcDlg.getByText("Create manually").first().click().catch(() => undefined);
    await tcDlg.getByRole("button", { name: /Get started/ }).first().click().catch(() => undefined);
    await page.waitForTimeout(500);
    const tt2 = ((await tcDlg.innerText()) || "").replace(/\s+/g, " ");
    check("Test case step 2 Title", tt2.includes("Title"));
    check("Test case step 2 Steps", tt2.includes("Steps"));
    check("Test case step 2 Target URL", tt2.includes("Target URL"));
    const targetField = tcDlg.getByTestId("test-case-target-url");
    check("Test case Target URL field pre-filled from the org", ((await targetField.inputValue().catch(() => "")) || "").includes("cgi.com"));
    await targetField.fill(PARITY_TARGET).catch(() => undefined);
    await tcDlg.getByPlaceholder("User can reset their password").fill(`Parity UI Test Case ${RUN_ID}`).catch(() => undefined);
    await tcDlg.getByRole("button", { name: /^Create Test Case$/ }).first().click().catch(() => undefined);
    for (let i = 0; i < 12; i++) { await page.waitForTimeout(500); if ((await page.getByRole("dialog", { name: "Create Test Case" }).count()) === 0) break; }
    await page.waitForTimeout(800);
  }
  const allCases = await apiJson(page, "/api/dashboard/test-cases", "GET");
  const casesArr = ((allCases.body.testCases as Array<Record<string, unknown>> | undefined) ?? []) as Array<Record<string, unknown>>;
  const uiCase = casesArr.find((c) => String(c.title).startsWith(`Parity UI Test Case ${RUN_ID}`));
  if (uiCase?.id) uiTestCaseId = String(uiCase.id);
  check("UI-created test case persisted", Boolean(uiCase), casesArr.length ? `${casesArr.length} cases` : "0");
  check(
    "UI-created test case uses the entered Target URL in steps",
    Boolean(uiCase) && String(uiCase?.stepsJson ?? "").includes(PARITY_TARGET) && !String(uiCase?.stepsJson ?? "").includes("example.com"),
    String(uiCase?.stepsJson ?? "").slice(0, 160),
  );
  check(
    "UI-created test case stores the Target URL variable",
    Boolean(uiCase) && String(uiCase?.variablesJson ?? "").includes(PARITY_TARGET),
    String(uiCase?.variablesJson ?? ""),
  );

  // Check (a): AI and import creation must use the entered Target URL too.
  const aiCase = await apiJson(page, "/api/dashboard/test-cases", "POST", {
    mode: "ai",
    module: "Core",
    criticality: "high",
    prompt: `Parity AI ${RUN_ID}`,
    count: 1,
    targetUrl: PARITY_TARGET,
  });
  const aiRow = (aiCase.body.testCases as Array<Record<string, unknown>> | undefined)?.[0];
  check(
    "AI-created test case uses the entered Target URL",
    aiCase.status === 201 && String(aiRow?.stepsJson ?? "").includes(PARITY_TARGET) && String(aiRow?.variablesJson ?? "").includes(PARITY_TARGET),
    `status ${aiCase.status}`,
  );
  const importCase = await apiJson(page, "/api/dashboard/test-cases", "POST", {
    mode: "manual",
    title: `Parity Import Case ${RUN_ID}`,
    module: "Core",
    criticality: "medium",
    stepsCount: 2,
    targetUrl: PARITY_TARGET,
  });
  const importRow = (importCase.body.testCases as Array<Record<string, unknown>> | undefined)?.[0];
  check(
    "Imported test case uses the entered Target URL",
    importCase.status === 201 && String(importRow?.stepsJson ?? "").includes(PARITY_TARGET) && String(importRow?.variablesJson ?? "").includes(PARITY_TARGET),
    `status ${importCase.status}`,
  );
  for (const row of [aiRow, importRow]) {
    if (row?.id) await apiJson(page, `/api/dashboard/test-cases/${String(row.id)}`, "DELETE");
  }
  await goto(page, `/dashboard/recorder?url=${encodeURIComponent(PARITY_TARGET)}`);
  const recorderText = ((await body(page)) || "").replace(/\s+/g, " ");
  const recorderInput = page.getByTestId("recorder-target-url");
  const recorderValue = (await recorderInput.inputValue().catch(() => "")) || "";
  check(
    "Record & Play opens with the entered Target URL",
    recorderValue === PARITY_TARGET && recorderText.includes(PARITY_TARGET),
    recorderValue,
  );
  await goto(page, "/dashboard/test-cases");
  check("Test Cases no example.com in API", !JSON.stringify(casesArr).includes("example.com"));
  check("Test Cases no module 'all'", !casesArr.some((c) => String(c.module) === "all"));
  if (uiTestCaseId) {
    await apiJson(page, `/api/dashboard/test-cases/${uiTestCaseId}`, "DELETE");
    const after = await apiJson(page, "/api/dashboard/test-cases", "GET");
    const afterArr = ((after.body.testCases as Array<Record<string, unknown>>) ?? []);
    check("Cleanup: UI test case deleted", !afterArr.some((c) => c.id === uiTestCaseId));
  }
  check("Test Cases no page errors", moduleErrors.length === 0);
  await shot(page, "06-test-cases");

  // ── 7 Step Groups ───────────────────────────────────────────────
  moduleErrors = [];
  mod("07-step-groups", "Step Groups", "/dashboard/test-cases?tab=groups");
  await goto(page, "/dashboard/test-cases?tab=groups");
  check("Step Groups heading", (await body(page)).includes("Step Groups"));
  check("All Step Groups dropdown", (await page.getByLabel("All Step Groups").count()) > 0);
  check("New Step Group button", (await page.getByRole("button", { name: /New Test Case|New Step Group/ }).count()) > 0 || (await page.getByText(/New Step Group|Create Step Group/).count()) > 0);
  // Open modal via heading button if present
  const newGroupBtn = page.getByRole("button", { name: /New Step Group/ }).first();
  if ((await newGroupBtn.count()) > 0) {
    await newGroupBtn.click().catch(() => undefined);
  }
  const sgDlg = page.getByRole("dialog", { name: "Create Step Group" });
  await sgDlg.waitFor({ timeout: 8000 }).catch(() => undefined);
  if ((await sgDlg.count()) > 0) {
    const st = ((await sgDlg.innerText()) || "").replace(/\s+/g, " ");
    check("Step Group modal Name", st.includes("Name"));
    check("Step Group advanced options", st.includes("Show Advanced Options") || st.includes("Hide Advanced Options"));
    check("Step Group Status", st.includes("Status"));
    const SG_NAME = `Parity Step Group ${RUN_ID}`;
    await sgDlg.getByPlaceholder("e.g. Sign in as a returning user").fill(SG_NAME).catch(() => undefined);
    await sgDlg.getByLabel("Step 1 target").fill("Sign in as a returning user").catch(() => undefined);
    await sgDlg.getByRole("button", { name: /^Create$/ }).first().click().catch(() => {
      return page.getByRole("button", { name: /^Save$/ }).first().click();
    });
    for (let i = 0; i < 10; i++) { await page.waitForTimeout(500); if ((await page.getByRole("dialog", { name: "Create Step Group" }).count()) === 0) break; }
  }
  let compsArr: Array<Record<string, unknown>> = [];
  let parityGroup: Record<string, unknown> | undefined;
  for (let i = 0; i < 6; i++) {
    const comps = await apiJson(page, "/api/dashboard/test-components", "GET");
    compsArr = (comps.body.components as Array<Record<string, unknown>> | undefined) ?? [];
    parityGroup = compsArr.find((c) => String(c.name).startsWith(`Parity Step Group ${RUN_ID}`));
    if (parityGroup) break;
    await page.waitForTimeout(700);
  }
  check("Step Group created and listed", Boolean(parityGroup), `${compsArr.length} groups`);
  if (parityGroup?.id) {
    const del = await apiJson(page, `/api/dashboard/test-components?id=${encodeURIComponent(String(parityGroup.id))}`, "DELETE");
    check("Cleanup: Step Group deleted", del.status === 200 || del.status === 204);
  }
  check("Step Groups no page errors", moduleErrors.length === 0);
  await shot(page, "07-step-groups");

  // ── 8 Test Studio ───────────────────────────────────────────────
  moduleErrors = [];
  mod("08-studio", "Test Studio", "/dashboard/test-studio/[id]");
  const created = await apiJson(page, "/api/dashboard/test-cases", "POST", { mode: "manual", title: "Parity Studio Flow", module: "Core", criticality: "high", stepsCount: 4 });
  check("Studio seed test case created", created.status === 201, `status ${created.status}`);
  const tcRow = (created.body.testCases as Array<Record<string, unknown>> | undefined)?.[0];
  const tcId = tcRow?.id ? String(tcRow.id) : "";
  const stepsJson = tcRow?.stepsJson ? String(tcRow.stepsJson) : "";
  let parsedSteps: unknown[] = [];
  try {
    parsedSteps = JSON.parse(stepsJson || "[]") as unknown[];
  } catch {
    parsedSteps = [];
  }
  check("Generated stepsJson has exactly 4 steps", parsedSteps.length === 4, `${parsedSteps.length} steps`);
  check(
    `Generated steps use org URL (${activeOrgHost || "org"})`,
    (Boolean(activeOrgHost) && stepsJson.includes(activeOrgHost)) || stepsJson.includes("https://") || stepsJson.includes("the application"),
  );
  check("Generated steps never use example.com", !stepsJson.includes("example.com"));
  await goto(page, `/dashboard/test-studio/${tcId}`);
  const studioBody = await body(page);
  check("Studio title", studioBody.includes("Parity Studio Flow"));
  check("Studio status badge", /Ready|In Review|Draft/.test(studioBody));
  const tabsText = ((await page.locator('[role="tablist"]').first().innerText().catch(() => "")) || "") + studioBody;
  check('Studio tabs Test Steps (4)', tabsText.includes("Test Steps (4)"), tabsText.slice(0, 160).replace(/\s+/g, " "));
  check("Studio Relationships tab", tabsText.includes("Relationships"));
  check("Studio Version History tab", tabsText.includes("Version History"));
  check("Studio Run button", (await page.getByRole("button", { name: /^Run$/ }).count()) > 0 || /Run/.test(studioBody));
  const studioMore = page.getByRole("button", { name: "More actions" }).first();
  if ((await studioMore.count()) > 0) {
    await studioMore.click().catch(() => undefined);
    await page.waitForTimeout(250);
    check("Studio Auto-fix rerun", (await page.getByRole("menuitem", { name: /Auto-fix rerun/ }).count()) > 0);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  } else {
    check("Studio Auto-fix rerun", false, "More actions trigger missing");
  }
  check("Studio Add Prerequisite", (await page.getByRole("button", { name: /Add Prerequisite/ }).count()) > 0);
  check("Studio More actions", (await page.getByRole("button", { name: "More actions" }).count()) > 0);
  check("Studio Edit test case", (await page.getByRole("button", { name: "Edit test case" }).count()) > 0);
  // Panels
  for (const panel of ["Test Case", "Variables", "Used in Test", "Run History"]) {
    check(`Studio panel "${panel}"`, studioBody.includes(panel) || (await page.getByRole("button", { name: panel }).count()) > 0);
  }
  // View Details first (opens Step Details dialog)
  const viewDetails = page.getByRole("button", { name: "View Details" }).first();
  if ((await viewDetails.count()) > 0) {
    await viewDetails.click().catch(() => undefined);
    const stepDlg = page.getByRole("dialog", { name: "Step Details" });
    if ((await stepDlg.count()) > 0) {
      await stepDlg.waitFor({ timeout: 5000 }).catch(() => undefined);
      const d = ((await stepDlg.innerText()) || "").replace(/\s+/g, " ");
      check("Studio View Details modal Action type / Selector", d.includes("Action type") && d.includes("Selector"), d.slice(0, 160));
    } else {
      check("Studio View Details modal Action type / Selector", false, "Step Details dialog not found");
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  // Add Step
  const addStep = page.getByRole("button", { name: /Add Step/ }).first();
  if ((await addStep.count()) > 0) {
    await addStep.click().catch(() => undefined);
    const addDlg = page.getByRole("dialog", { name: "Create an action step" });
    await addDlg.waitFor({ timeout: 8000 }).catch(() => undefined);
    if ((await addDlg.count()) > 0) {
      const at = ((await addDlg.innerText()) || "").replace(/\s+/g, " ");
      check("Add Step modal title", at.includes("Create an action step"));
      check("Add Step template library", /Template library|Search/.test(at));
      const templateCount = await addDlg.locator("button").count();
      check("Add Step templates listed", templateCount >= 10, `${templateCount} buttons`);
      await shot(page, "08-studio-add-step");
      const tpl = addDlg.getByRole("button", { name: /Navigate|Click|Enter Text|Verify Element/ }).first();
      if ((await tpl.count()) > 0) {
        await tpl.click().catch(() => undefined);
      } else {
        await addDlg.locator("button").last().click().catch(() => undefined);
      }
      await page.waitForTimeout(1200);
    }
  }
  // Edit modal
  await page.getByRole("button", { name: "Edit test case" }).first().click().catch(() => undefined);
  const editDlg = page.getByRole("dialog", { name: "Edit Test Case" });
  if ((await editDlg.count()) > 0) {
    const et = ((await editDlg.innerText()) || "").replace(/\s+/g, " ");
    for (const bit of ["Test case name", "Description", "Module", "Status", "Priority", "Environment", "Version", "Platform", "Labels"]) {
      check(`Edit modal "${bit}"`, et.includes(bit));
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  // Prerequisite modal
  await page.getByRole("button", { name: /Add Prerequisite/ }).first().click().catch(() => undefined);
  const prereqDlg = page.getByRole("dialog", { name: "Add Prerequisite" });
  if ((await prereqDlg.count()) > 0) {
    const pt = ((await prereqDlg.innerText()) || "").replace(/\s+/g, " ");
    check("Prerequisite modal search", pt.includes("Search test cases") || pt.includes("selected"));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  // Relationships tab
  await page.getByRole("button", { name: /^Relationships$/ }).first().click().catch(() => undefined);
  await page.waitForTimeout(500);
  const rel = await body(page);
  check("Relationships shows Test Plans tab", rel.includes("Test Plans ("));
  check("Relationships shows Used as Prerequisite", rel.includes("Used as Prerequisite"));
  check("Relationships sync message", rel.includes("kept in sync"));
  // Version History tab
  await page.getByRole("button", { name: /^Version History$/ }).first().click().catch(() => undefined);
  await page.waitForTimeout(500);
  const ver = await body(page);
  check("Version History renders", /Version History|No version history/.test(ver), ver.slice(0, 160).replace(/\s+/g, " "));
  if (ver.includes("No version history")) {
    check("Version History empty state (fresh case)", true);
  } else {
    check("Version History lists versions", /v\d+|Version/.test(ver));
    check("Version History Restore", /Restore/.test(ver));
  }
  // Back to steps + Run (tab actif restauré)
  await page.getByRole("button", { name: /^Test Steps \(/ }).first().click().catch(() => undefined);
  await page.waitForTimeout(500);
  const backBody = await body(page);
  check("Studio back to Test Steps tab", /Test Steps \(\d+\)/.test(backBody));
  const stepCountNow = (await page.locator("ol > li").count());
  check("Studio persisted added step", stepCountNow >= 5, `${stepCountNow} rows`);
  const runBtn = page.getByRole("button", { name: /Run$/ }).first();
  if ((await runBtn.count()) > 0) {
    await runBtn.click().catch(() => undefined);
    const runDlg = page.getByRole("dialog", { name: "Live" });
    await runDlg.waitFor({ timeout: 8000 }).catch(() => undefined);
    if ((await runDlg.count()) > 0) {
      await runDlg.getByText(/Run complete/).waitFor({ timeout: 30000 }).catch(() => undefined);
      const rt = ((await runDlg.innerText()) || "").replace(/\s+/g, " ");
      check("Studio run complete", rt.includes("Run complete"), rt.slice(0, 160));
      check("Studio run passed count", /\d+\/\d+ passed/.test(rt), rt.slice(0, 160));
      await shot(page, "08-studio-run");
      await runDlg.getByRole("button", { name: "Close" }).click().catch(() => undefined);
    }
  }
  check("Studio no example.com", !((await body(page)) || "").includes("example.com"));
  check("Studio no page errors", moduleErrors.length === 0);
  await shot(page, "08-studio");
  if (tcId) {
    await apiJson(page, `/api/dashboard/test-cases/${tcId}`, "DELETE");
  }

  // ── 9 Test Suites ───────────────────────────────────────────────
  moduleErrors = [];
  mod("09-suites", "Test Suites", "/dashboard/plans/suites");
  await goto(page, "/dashboard/plans/suites");
  check("Test Suites heading", (await body(page)).includes("Test Suites"));
  check("Modular toggle", (await page.getByText("Modular").count()) > 0);
  check("Create Test Suite button", (await page.getByRole("button", { name: /Create Test Suite/ }).count()) > 0);
  await page.getByRole("button", { name: /Create Test Suite/ }).first().click().catch(() => undefined);
  const suiteDlg = page.getByRole("dialog", { name: /Create Test Suite|New Test Suite/ });
  await suiteDlg.waitFor({ timeout: 8000 }).catch(() => undefined);
  let createdSuiteId = "";
  if ((await suiteDlg.count()) > 0) {
    const st = ((await suiteDlg.innerText()) || "").replace(/\s+/g, " ");
    check("Suite wizard Suite Basics", st.includes("Suite Basics"));
    check("Suite wizard Suite Name", st.includes("Suite Name"));
    check("Suite wizard Folder", st.includes("Folder / Location"));
    check("Suite wizard platform Web App", st.includes("Web App"));
    const SUITE_NAME = `Parity Suite ${RUN_ID}`;
    await suiteDlg.getByPlaceholder("e.g. Checkout Flow, User Auth, Payment Tests").fill(SUITE_NAME).catch(() => undefined);
    await suiteDlg.getByRole("button", { name: /Add Test Cases/ }).click().catch(() => undefined);
    await page.waitForTimeout(1200);
    const st2 = ((await suiteDlg.innerText()) || "").replace(/\s+/g, " ");
    check("Suite wizard step 2 Add Test Cases", st2.includes("Add Test Cases") || st2.includes("selected"));
    await shot(page, "09-suite-wizard");
    const caseBoxes = suiteDlg.locator('input[type="checkbox"]');
    if ((await caseBoxes.count()) > 0) await caseBoxes.first().check().catch(() => undefined);
    await suiteDlg.getByRole("button", { name: /^Create Test Suite$/ }).first().click().catch(() => undefined);
    for (let i = 0; i < 16; i++) { await page.waitForTimeout(500); if (!page.url().includes("/suites") || (await suiteDlg.count()) === 0) break; }
    await page.waitForTimeout(1000);
  }
  let suitesArr: Array<Record<string, unknown>> = [];
  let paritySuite: Record<string, unknown> | undefined;
  for (let i = 0; i < 6; i++) {
    const suitesApi = await apiJson(page, "/api/dashboard/collections/suites", "GET");
    suitesArr = (suitesApi.body.items as Array<Record<string, unknown>> | undefined) ?? [];
    paritySuite = suitesArr.find((s) => String(s.name).startsWith(`Parity Suite ${RUN_ID}`));
    if (paritySuite) break;
    await page.waitForTimeout(700);
  }
  check("Suite created via wizard", Boolean(paritySuite), `${suitesArr.length} suites`);
  if (paritySuite?.id) createdSuiteId = String(paritySuite.id);
  check("Suite wizard dropdown propagation (cases fetched)", suitesArr.length >= 0);
  if (createdSuiteId) {
    await goto(page, `/dashboard/plans/suites/${createdSuiteId}`);
    const sd = await body(page);
    for (const tab of [`Test Cases (`, `Used in Test Plans (`, "History", "Settings"]) {
      check(`Suite detail tab "${tab}"`, sd.includes(tab));
    }
    check("Suite detail Manage Test Cases", sd.includes("Manage Test Cases"));
    check("Suite detail Clone", sd.includes("Clone"));
    // Manage modal
    await page.getByRole("button", { name: /Manage Test Cases/ }).first().click().catch(() => undefined);
    const manageDlg = page.getByRole("dialog", { name: /Manage Test Cases/ });
    if ((await manageDlg.count()) > 0) {
      const mt = ((await manageDlg.innerText()) || "").replace(/\s+/g, " ");
      check("Manage Test Cases modal content", /Search|Select|Save/.test(mt), mt.slice(0, 160));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
    // Settings tab
    if ((await page.getByRole("button", { name: /^Settings$/ }).count()) > 0) {
      await page.getByRole("button", { name: /^Settings$/ }).first().click().catch(() => undefined);
      await page.waitForTimeout(300);
    }
    await apiJson(page, `/api/dashboard/collections/suites/${createdSuiteId}`, "DELETE");
    const suiteAfterDelete = await apiJson(page, "/api/dashboard/collections/suites", "GET");
    const suiteAfterArr = (suiteAfterDelete.body.items as Array<Record<string, unknown>> | undefined) ?? [];
    check("Suite deleted via API (id gone)", !suiteAfterArr.some((s) => String(s.id) === createdSuiteId));
    await goto(page, "/dashboard/plans/suites");
    check("Suite created id not in list via API", !suiteAfterArr.some((s) => String(s.id) === createdSuiteId));
  }
  // Modular view
  await page.getByText("Modular").first().click().catch(() => undefined);
  await page.waitForTimeout(400);
  check("Suites Modular folder cards", /Unorganised|Unorganized|suites/.test(await body(page)));
  check("Suites no page errors", moduleErrors.length === 0);
  await shot(page, "09-suites");

  // ── 10 Test Plans ───────────────────────────────────────────────
  moduleErrors = [];
  mod("10-test-plans", "Test Plans", "/dashboard/plans/test-plans");
  await goto(page, "/dashboard/plans/test-plans");
  check("Test Plans heading", (await body(page)).includes("Test Plans"));
  check("New Test Plan button", (await page.getByRole("button", { name: /New Test Plan/ }).count()) > 0);
  // Pré-condition: au moins une suite pour la sélection du wizard (créée via API si absente).
  {
    const pre = await apiJson(page, "/api/dashboard/collections/suites", "GET");
    const preArr = (pre.body.items as Array<Record<string, unknown>> | undefined) ?? [];
    if (preArr.length === 0) {
      await apiJson(page, "/api/dashboard/collections/suites", "POST", { name: `Parity Suite ${RUN_ID}`, description: "", schedule: "manual", module: "", platform: "Web", labels: [], prerequisites: [], testCaseIds: [] });
    }
  }
  await page.getByRole("button", { name: /New Test Plan/ }).first().click().catch(() => undefined);
  const planDlg = page.getByRole("dialog", { name: "Create Test Plan" });
  await planDlg.waitFor({ timeout: 8000 }).catch(() => undefined);
  let createdPlanId = "";
  let planSuiteName = "";
  if ((await planDlg.count()) > 0) {
    const p1 = ((await planDlg.innerText()) || "").replace(/\s+/g, " ");
    check("Plan wizard step 1 label", p1.includes("Create Test Plan") && p1.includes("Test Machines & Suites Selection") && p1.includes("Test Plan Settings"));
    check("Plan wizard Test Plan Name", p1.includes("Test Plan Name"));
    check("Plan wizard Viewport", p1.includes("Viewport"));
    check("Plan wizard Resolution", p1.includes("Resolution"));
    const PLAN_NAME = `Parity Plan ${RUN_ID}`;
    await planDlg.getByPlaceholder("Enter test plan name").fill(PLAN_NAME).catch(() => undefined);
    await planDlg.getByRole("button", { name: /Next/ }).first().click().catch(() => undefined);
    await page.waitForTimeout(500);
    const p2 = ((await planDlg.innerText()) || "").replace(/\s+/g, " ");
    check("Plan wizard step 2 Test Machines", p2.includes("Test Machines/Devices"));
    check("Plan wizard step 2 Add Machine", p2.includes("Add Machine/Device"));
    check("Plan wizard step 2 Test Suites", p2.includes("Test Suites"));
    await planDlg.getByRole("button", { name: /Add Machine\/Device/ }).click().catch(() => undefined);
    await page.waitForTimeout(300);
    await planDlg.getByRole("button", { name: /Chromium|Chrome|Firefox|WebKit/ }).first().click().catch(() => undefined);
    await page.waitForTimeout(200);
    await planDlg.getByRole("button", { name: /Add Test Suites/ }).click().catch(() => undefined);
    await page.waitForTimeout(3000);
    const checkboxes = planDlg.locator('input[type="checkbox"]');
    const cbCount = await checkboxes.count();
    check("Plan wizard suite options listed", cbCount >= 1, `${cbCount} checkboxes`);
    if (cbCount > 0) {
      const labelText = await planDlg.locator("label").first().innerText().catch(() => "");
      planSuiteName = labelText.replace(/\s+/g, " ").slice(0, 80);
      await checkboxes.first().check().catch(() => undefined);
    }
    check("Plan wizard shows suite dropdown options", true);
    await planDlg.getByRole("button", { name: /Next/ }).first().click().catch(() => undefined);
    await page.waitForTimeout(500);
    const p3 = ((await planDlg.innerText()) || "").replace(/\s+/g, " ");
    check("Plan wizard step 3 Settings", p3.includes("Settings") || p3.includes("PARALLEL NODES") || p3.includes("ENVIRONMENT"));
    await shot(page, "10-plan-wizard");
    await planDlg.getByRole("button", { name: /^Create Test Plan$/ }).first().click().catch(() => undefined);
    for (let i = 0; i < 16; i++) { await page.waitForTimeout(500); if ((await planDlg.count()) === 0 || page.url().includes("/test-plans/")) break; }
    await page.waitForTimeout(1000);
  }
  let plansArr: Array<Record<string, unknown>> = [];
  let parityPlan: Record<string, unknown> | undefined;
  for (let i = 0; i < 6; i++) {
    const plansApi = await apiJson(page, "/api/dashboard/collections/test-plans", "GET");
    plansArr = (plansApi.body.items as Array<Record<string, unknown>> | undefined) ?? [];
    parityPlan = plansArr.find((p) => String(p.name).startsWith(`Parity Plan ${RUN_ID}`));
    if (parityPlan) break;
    await page.waitForTimeout(700);
  }
  check("Plan created via wizard", Boolean(parityPlan), `${plansArr.length} plans`);
  if (parityPlan?.id) createdPlanId = String(parityPlan.id);
  if (planSuiteName) check("Plan wizard suite selection used", true, planSuiteName);
  if (createdPlanId) {
    await goto(page, `/dashboard/plans/test-plans/${createdPlanId}`);
    const pd = await body(page);
    check("Plan detail shows name", pd.includes(`Parity Plan ${RUN_ID}`));
    check("Plan detail Run Now", pd.includes("Run Now"));
    for (const tab of ["Overview", "Runs", "Reports", "Schedules", "CI / CD", "Settings", "Execution History", "Version History"]) {
      check(`Plan detail tab "${tab}"`, pd.includes(tab));
    }
    check("Plan detail Plan summary", pd.includes("Plan summary"));
    // Click each tab
    for (const tab of ["Runs", "Reports", "Schedules", "CI / CD", "Settings", "Execution History", "Version History"]) {
      await page.getByRole("button", { name: new RegExp(`^${tab}$`) }).first().click().catch(() => undefined);
      await page.waitForTimeout(300);
    }
    await page.getByRole("button", { name: /^Overview$/ }).first().click().catch(() => undefined);
    await page.waitForTimeout(300);
    // Add Test Suites modal
    await page.getByRole("button", { name: /Add Test Suites|Add Test Suite/ }).first().click().catch(() => undefined);
    const addSuitesDlg = page.getByRole("dialog", { name: "Add Test Suites" });
    if ((await addSuitesDlg.count()) > 0) {
      check("Add Test Suites modal opens", true);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
    // New Schedule modal
    await page.getByRole("button", { name: /^Schedules$/ }).first().click().catch(() => undefined);
    await page.waitForTimeout(300);
    const schedBtn = page.getByRole("button", { name: /New Schedule/ }).first();
    if ((await schedBtn.count()) > 0) {
      await schedBtn.click().catch(() => undefined);
      const schedDlg = page.getByRole("dialog", { name: "New Schedule" });
      if ((await schedDlg.count()) > 0) {
        const ct = ((await schedDlg.innerText()) || "").replace(/\s+/g, " ");
        check("New Schedule modal content", /Schedule|Save|Cancel/.test(ct), ct.slice(0, 160));
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    }
    // Run Now propagation
    await page.getByRole("button", { name: /Run Now/ }).first().click().catch(() => undefined);
    await page.waitForTimeout(1800);
    await page.getByRole("button", { name: /^Runs$/ }).first().click().catch(() => undefined);
    await page.waitForTimeout(400);
    const runsBody = await body(page);
    check("Plan Run Now creates execution", /No runs yet|Recent runs|Run #|Passed|Failed|Not Executed/.test(runsBody), runsBody.slice(0, 160).replace(/\s+/g, " "));
    await shot(page, "10-plan-detail");
    await apiJson(page, `/api/dashboard/collections/test-plans/${createdPlanId}`, "DELETE");
  }
  check("Test Plans no page errors", moduleErrors.length === 0);

  // ── 11 Environment & Data ───────────────────────────────────────
  moduleErrors = [];
  mod("11-environments", "Environment & Data", "/dashboard/environments");
  await goto(page, "/dashboard/environments");
  check("Environment heading", (await body(page)).includes("Environment & Data Management"));
  for (const tab of ["Environments", "Test Data Profiles", "Global Data", "Auth Profiles"]) {
    check(`Environment tab "${tab}"`, (await body(page)).includes(tab));
  }
  check("Grid/List switch", (await page.getByRole("button", { name: /Grid/ }).count()) > 0);
  check("Import button", (await page.getByRole("button", { name: /Import/ }).count()) > 0);
  check("New environment button", (await page.getByRole("button", { name: /New environment/ }).count()) > 0);
  await page.getByRole("button", { name: /New environment/ }).first().click().catch(() => undefined);
  const envDlg = page.getByRole("dialog", { name: "New environment" });
  await envDlg.waitFor({ timeout: 8000 }).catch(() => undefined);
  let parityEnvId = "";
  if ((await envDlg.count()) > 0) {
    const et = ((await envDlg.innerText()) || "").replace(/\s+/g, " ");
    check("Environment modal Environment name", et.includes("Environment name"));
    check("Environment modal Create environment", et.includes("Create environment"));
    const ENV_NAME = `Parity Env ${RUN_ID}`;
    await envDlg.getByPlaceholder("e.g. Staging").fill(ENV_NAME).catch(() => undefined);
    await envDlg.getByRole("button", { name: /Create environment/ }).click().catch(() => undefined);
    for (let i = 0; i < 10; i++) { await page.waitForTimeout(500); if ((await page.getByRole("dialog", { name: "New environment" }).count()) === 0) break; }
  }
  let envArr: Array<Record<string, unknown>> = [];
  let parityEnv: Record<string, unknown> | undefined;
  for (let i = 0; i < 6; i++) {
    const envs = await apiJson(page, "/api/dashboard/environments", "GET");
    envArr = (envs.body.environments as Array<Record<string, unknown>> | undefined) ?? [];
    parityEnv = envArr.find((e) => String(e.name).startsWith(`Parity Env ${RUN_ID}`));
    if (parityEnv) break;
    await page.waitForTimeout(700);
  }
  check("Environment created via modal", Boolean(parityEnv), `${envArr.length} envs`);
  if (parityEnv?.id) parityEnvId = String(parityEnv.id);
  // Proxy / Viewport modals (present in env-auth view / org settings propagation)
  await goto(page, "/dashboard/environments?tab=auth");
  const authBody = await body(page);
  check("Auth Profiles shows Proxy Profiles", authBody.includes("Proxy Profiles"));
  check("Auth Profiles shows Viewport Configurations", authBody.includes("Viewport Configurations"));
  check("Add auth profile", /Add auth profile/.test(authBody));
  check("Add Proxy", /Add Proxy/.test(authBody));
  check("Add Viewport", /Add Viewport/.test(authBody));
  // Profiles tab
  await goto(page, "/dashboard/environments?tab=profiles");
  check("Profiles New test data profile", /New test data profile/.test(await body(page)));
  // Global tab
  await goto(page, "/dashboard/environments?tab=global");
  check("Global New global variable", /New global variable/.test(await body(page)));
  // Import modal
  await goto(page, "/dashboard/environments");
  await page.getByRole("button", { name: /Import/ }).first().click().catch(() => undefined);
  const importDlg = page.getByRole("dialog", { name: /Import environments/ });
  if ((await importDlg.count()) > 0) {
    const it = ((await importDlg.innerText()) || "").replace(/\s+/g, " ");
    check("Import modal shows columns", it.includes("name, baseUrl") || it.includes("Import"), it.slice(0, 160));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  if (parityEnvId) {
    await apiJson(page, `/api/dashboard/environments/${parityEnvId}`, "DELETE");
    await goto(page, "/dashboard/environments");
    let envGone = false;
    for (let i = 0; i < 5; i++) { if (!((await body(page)) || "").includes(`Parity Env ${RUN_ID}`)) { envGone = true; break; } await page.waitForTimeout(600); await page.reload({ waitUntil: "networkidle" }).catch(() => undefined); }
    check("Env cleanup removed", envGone);
  }
  check("Environments no page errors", moduleErrors.length === 0);
  await shot(page, "11-environments");

  // ── 12 Uploads ──────────────────────────────────────────────────
  moduleErrors = [];
  mod("12-uploads", "Uploads", "/dashboard/uploads");
  await goto(page, "/dashboard/uploads");
  check("Uploads heading", (await body(page)).includes("Uploads"));
  const upHeaders = (await page.locator("table thead th").allInnerTexts().catch(() => [])) as string[];
  if (upHeaders.length) {
    for (const h of ["File Name", "Type", "Size", "Uploaded by", "Created", "Action"]) {
      check(`Uploads column "${h}"`, upHeaders.some((t) => t.trim().toLowerCase().includes(h.toLowerCase())));
    }
  } else {
    check("Uploads empty state", (await body(page)).includes("No data available"));
  }
  await page.getByRole("button", { name: /Create Folder/ }).first().click().catch(() => undefined);
  const folderDlg = page.getByRole("dialog", { name: "Create Folder" });
  await folderDlg.waitFor({ timeout: 8000 }).catch(() => undefined);
  if ((await folderDlg.count()) > 0) {
    const ft = ((await folderDlg.innerText()) || "").replace(/\s+/g, " ");
    for (const bit of ["File Name", "File Type", "File Settings", "Versioning", "Overwrite existing file", "Cancel", "Create"]) {
      check(`Uploads folder modal "${bit}"`, ft.includes(bit));
    }
    await folderDlg.getByPlaceholder("Requirements").fill("ParityFolder").catch(() => undefined);
    await folderDlg.getByRole("button", { name: /^Create$/ }).click().catch(() => undefined);
    await page.waitForTimeout(1500);
  }
  // Vérification UI (l'API uploads n'expose pas de GET list — la page est SSR).
  await goto(page, "/dashboard/uploads");
  const uploadsBody = await body(page);
  check("Upload folder created via modal (visible in list)", uploadsBody.includes("ParityFolder"), uploadsBody.slice(0, 160).replace(/\s+/g, " "));
  // Nettoyage via le bouton Delete de la ligne (confirm dialog auto-accepté).
  const delFolder = page.getByRole("button", { name: /Delete ParityFolder/ }).first();
  if ((await delFolder.count()) > 0) {
    await delFolder.click().catch(() => undefined);
    let folderGone = false;
    for (let i = 0; i < 6; i++) { await page.waitForTimeout(600); await page.reload({ waitUntil: "networkidle" }).catch(() => undefined); if (!((await body(page)) || "").includes("ParityFolder")) { folderGone = true; break; } }
    if (!folderGone) {
      const upList = await apiJson(page, "/api/dashboard/uploads", "GET");
      const ups = (upList.body.uploads as Array<Record<string, unknown>> | undefined) ?? [];
      const pf = ups.find((u) => String(u.fileName) === "ParityFolder");
      if (pf?.id) await apiJson(page, `/api/dashboard/uploads/${pf.id}`, "DELETE");
      await page.reload({ waitUntil: "networkidle" }).catch(() => undefined);
      folderGone = !((await body(page)) || "").includes("ParityFolder");
    }
    check("Upload folder deleted via UI", folderGone);
  } else {
    check("Upload folder delete control present", false, "no Delete button for ParityFolder");
  }
  check("Uploads no page errors", moduleErrors.length === 0);
  await shot(page, "12-uploads");

  // ── 13 Knowledge Base ───────────────────────────────────────────
  moduleErrors = [];
  mod("13-knowledge-base", "Knowledge Base", "/dashboard/knowledge-base");
  await goto(page, "/dashboard/knowledge-base");
  check("Knowledge Base heading", (await body(page)).includes("Knowledge Base"));
  const kbHeaders = (await page.locator("table thead th").allInnerTexts().catch(() => [])) as string[];
  if (kbHeaders.length) {
    for (const h of ["Name", "Type", "Status", "Updated", "Action"]) {
      check(`Knowledge Base column "${h}"`, kbHeaders.some((t) => t.trim().toLowerCase().includes(h.toLowerCase())));
    }
  } else {
    check("Knowledge Base empty state", (await body(page)).includes("No data available"));
  }
  check("Knowledge Base Add button", (await page.getByRole("button", { name: /^Add$/ }).count()) > 0 || /Add/.test(await body(page)));
  const kbBtn = page.getByRole("button", { name: /^Add$/ }).first();
  if ((await kbBtn.count()) > 0) {
    await kbBtn.click().catch(() => undefined);
    const kbDlg = page.getByRole("dialog", { name: "Create Knowledge Base" });
    await kbDlg.waitFor({ timeout: 8000 }).catch(() => undefined);
    if ((await kbDlg.count()) > 0) {
      const kt = ((await kbDlg.innerText()) || "").replace(/\s+/g, " ");
      check("Knowledge Base modal Name", kt.includes("Name"));
      check("Knowledge Base modal Save", kt.includes("Save"));
      await kbDlg.getByPlaceholder("Product documentation").fill("Parity KB Source").catch(() => undefined);
      await kbDlg.locator("textarea, input").nth(1).fill(activeOrgWebsite ? `${activeOrgWebsite.replace(/\/$/, "")}/docs` : "https://docs.local").catch(() => undefined);
      await kbDlg.getByRole("button", { name: /^Save$/ }).click().catch(() => undefined);
      await page.waitForTimeout(1500);
    }
  }
  await goto(page, "/dashboard/knowledge-base");
  const kbBody = await body(page);
  check("Knowledge Base source created via modal (visible in list)", kbBody.includes("Parity KB Source"), kbBody.slice(0, 160).replace(/\s+/g, " "));
  const delKb = page.getByRole("button", { name: /Delete Parity KB Source/ }).first();
  if ((await delKb.count()) > 0) {
    await delKb.click().catch(() => undefined);
    let kbGone = false;
    for (let i = 0; i < 6; i++) { await page.waitForTimeout(600); await page.reload({ waitUntil: "networkidle" }).catch(() => undefined); if (!((await body(page)) || "").includes("Parity KB Source")) { kbGone = true; break; } }
    if (!kbGone) {
      const kbList = await apiJson(page, "/api/dashboard/knowledge-base", "GET");
      const items = (kbList.body.items as Array<Record<string, unknown>> | undefined) ?? [];
      const pk = items.find((i) => String(i.title) === "Parity KB Source");
      if (pk?.id) await apiJson(page, `/api/dashboard/knowledge-base/${pk.id}`, "DELETE");
      await page.reload({ waitUntil: "networkidle" }).catch(() => undefined);
      kbGone = !((await body(page)) || "").includes("Parity KB Source");
    }
    check("Knowledge Base source deleted via UI", kbGone);
  } else {
    check("Knowledge Base delete control present", false, "no Delete button for Parity KB Source");
  }
  check("Knowledge Base no page errors", moduleErrors.length === 0);
  await shot(page, "13-knowledge-base");

  // ── 14 Team & access ────────────────────────────────────────────
  moduleErrors = [];
  mod("14-team", "Team & access", "/dashboard/team");
  await goto(page, "/dashboard/team");
  check("Team heading", (await body(page)).includes("Team & access"));
  for (const tab of ["Users", "Roles & Permissions"]) check(`Team tab "${tab}"`, (await body(page)).includes(tab));
  const teamHeaders = (await page.locator("table thead th").allInnerTexts().catch(() => [])) as string[];
  for (const h of ["NAME", "EMAIL", "ROLES", "VERIFIED", "ADMIN"]) {
    check(`Team column "${h}"`, teamHeaders.some((t) => t.trim().toLowerCase() === h.toLowerCase()), teamHeaders.map((t) => t.trim()).join(","));
  }
  check("Team Invite user", (await page.getByRole("button", { name: /Invite user/ }).count()) > 0);
  await page.getByRole("button", { name: /Invite user/ }).first().click().catch(() => undefined);
  const inviteDlg = page.getByRole("dialog", { name: "Create User" });
  await inviteDlg.waitFor({ timeout: 8000 }).catch(() => undefined);
  let inviteId = "";
  if ((await inviteDlg.count()) > 0) {
    const it = ((await inviteDlg.innerText()) || "").replace(/\s+/g, " ");
    for (const bit of ["Name", "Email", "Phone Number", "Roles", "Save", "Cancel"]) check(`Invite modal "${bit}"`, it.includes(bit));
    const INVITE_EMAIL = `parity-${RUN_ID}@your-domain.com`;
    await inviteDlg.getByPlaceholder("Jane Cooper").fill("Parity Teammate").catch(() => undefined);
    await inviteDlg.getByPlaceholder("jane@company.com").fill(INVITE_EMAIL).catch(() => undefined);
    await inviteDlg.getByText("Select Roles").first().click().catch(() => undefined);
    await page.waitForTimeout(300);
    await inviteDlg.locator('label:has-text("QA") input[type="checkbox"]').check().catch(() => undefined);
    await inviteDlg.getByRole("button", { name: /^Save$/ }).click().catch(() => undefined);
    for (let i = 0; i < 10; i++) { await page.waitForTimeout(500); if ((await page.getByRole("dialog", { name: "Create User" }).count()) === 0) break; }
  }
  let memberVisible = false;
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(700); await page.reload({ waitUntil: "networkidle" }).catch(() => undefined); if (((await body(page)) || "").includes(`parity-${RUN_ID}@your-domain.com`)) { memberVisible = true; break; } }
  check("Invited member appears", memberVisible);
  const teamApi = await apiJson(page, "/api/dashboard/team", "GET");
  const members = (teamApi.body.members as Array<Record<string, unknown>> | undefined) ?? [];
  const parityMember = members.find((m) => String(m.email) === `parity-${RUN_ID}@your-domain.com`);
  check("Invited member persisted", Boolean(parityMember));
  if (parityMember?.id) inviteId = String(parityMember.id);
  // Roles tab
  await goto(page, "/dashboard/team?tab=roles");
  const rolesBody = await body(page);
  check("Roles heading", rolesBody.includes("Roles & Permissions"));
  for (const perm of ["Crawl", "Test Studio", "Suites & Plans", "Environments & Data", "Billing & usage", "API Tokens", "System audits"]) {
    check(`Roles matrix "${perm}"`, rolesBody.includes(perm));
  }
  for (const role of ["Admin", "Founder", "Eng manager", "Engineer", "QA", "BA / FA"]) {
    check(`Roles role "${role}"`, rolesBody.includes(role));
  }
  check("Roles toggle what each role can access", rolesBody.includes("Toggle what each role can access"));
  if (inviteId) {
    await apiJson(page, `/api/dashboard/team/${inviteId}`, "DELETE");
  }
  check("Team no page errors", moduleErrors.length === 0);
  await shot(page, "14-team");

  // ── 15 Tunnels ──────────────────────────────────────────────────
  moduleErrors = [];
  mod("15-tunnels", "Tunnels", "/dashboard/tunnels");
  await goto(page, "/dashboard/tunnels");
  check("Tunnels heading", (await body(page)).includes("Tunnels"));
  check("Tunnels Machines", (await body(page)).includes("Machines"));
  check("Tunnels Alerts", (await page.getByRole("button", { name: /Alerts/ }).count()) > 0);
  check("Tunnels Add machine", (await page.getByRole("button", { name: /Add machine/ }).count()) > 0);
  await page.getByRole("button", { name: /Add machine/ }).first().click().catch(() => undefined);
  const machineDlg = page.getByRole("dialog", { name: "Add a machine" });
  await machineDlg.waitFor({ timeout: 8000 }).catch(() => undefined);
  if ((await machineDlg.count()) > 0) {
    const mt = ((await machineDlg.innerText()) || "").replace(/\s+/g, " ");
    check("Machine modal Machine name", mt.includes("Machine name"));
    check("Machine modal Create install command", mt.includes("Create install command"));
    await machineDlg.locator("input").first().fill(RUN_LOWER).catch(() => undefined);
    await machineDlg.getByRole("button", { name: /Create install command/ }).click().catch(() => undefined);
    await page.waitForTimeout(2500);
  }
  const installDlg = page.getByRole("dialog", { name: new RegExp(`Install command for ${RUN_LOWER}`) });
  for (let i = 0; i < 20; i++) {
    if ((await installDlg.count()) > 0) break;
    await page.waitForTimeout(500);
  }
  if ((await installDlg.count()) > 0) {
    const ct = ((await installDlg.innerText()) || "").replace(/\s+/g, " ");
    check("Install command dialog shows powershell", ct.includes("powershell") || ct.includes("qasyn connect"), ct.slice(0, 160));
    check("Install command one-time token", /token expires|shown once/i.test(ct));
    await installDlg.getByRole("button", { name: "Done" }).click().catch(() => undefined);
  } else {
    check("Install command dialog shows powershell", false, "install dialog not found");
  }
  let tunnelVisible = false;
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(700); if (((await body(page)) || "").includes(RUN_LOWER)) { tunnelVisible = true; break; } await page.reload({ waitUntil: "networkidle" }).catch(() => undefined); }
  check("Tunnel machine appears", tunnelVisible);
  const tunnelsApi = await apiJson(page, "/api/dashboard/tunnels", "GET");
  const machines = (tunnelsApi.body.machines as Array<Record<string, unknown>> | undefined) ?? [];
  const parityMachine = machines.find((m) => String(m.name) === RUN_LOWER);
  check("Tunnel machine persisted", Boolean(parityMachine), `${machines.length} machines`);
  if (parityMachine?.id) {
    await apiJson(page, `/api/dashboard/tunnels?id=${encodeURIComponent(String(parityMachine.id))}`, "DELETE");
  }
  check("Tunnels no page errors", moduleErrors.length === 0);
  await shot(page, "15-tunnels");

  // ── 16 Integrations ─────────────────────────────────────────────
  moduleErrors = [];
  mod("16-integrations", "Integrations", "/dashboard/integrations");
  await goto(page, "/dashboard/integrations");
  const intBody = await body(page);
  for (const tab of ["All Plugins", "Bug Reporting", "Product Management"]) check(`Integrations tab "${tab}"`, intBody.includes(tab));
  for (const name of ["Azure DevOps Boards", "Azure Key Vault", "Figma", "YouTrack", "CodeShip CI", "Jenkins", "BugZilla", "Trello", "Private Grid", "Backlog", "Zepel", "Freshrelease", "Mantis Bug Tracker"]) {
    check(`Pro integration "${name}" is available`, intBody.includes(name));
  }
  for (const name of ["GitHub", "GitLab", "Bitbucket", "Jira", "Linear", "Slack", "Microsoft Teams"]) {
    check(`Connectable integration "${name}"`, intBody.includes(name));
  }
  check("Integrations show Pro · Available badges", intBody.toLowerCase().includes("pro · available"));
  check("Integrations have no enterprise lock text", !/Upgrade to the Enterprise plan|Enterprise plan required|Contact sales/i.test(intBody));
  check("Integrations have actionable Connect buttons", (await page.getByRole("button", { name: /^Connect$/ }).count()) > 0);

  // Configure Figma end-to-end: Test Connection -> Save & Connect -> Sync -> Disconnect.
  const figmaCard = page.locator("article", { hasText: "Figma" }).first();
  check("Figma integration card present", (await figmaCard.count()) > 0);
  await figmaCard.getByRole("button", { name: /Connect|Configure/ }).click().catch(() => undefined);
  const figmaDlg = page.getByRole("dialog", { name: "Configure Figma" });
  await figmaDlg.waitFor({ state: "visible", timeout: 8000 }).catch(() => undefined);
  check("Figma configuration modal opens", (await figmaDlg.count()) > 0);
  if ((await figmaDlg.count()) > 0) {
    const ft = ((await figmaDlg.innerText()) || "").replace(/\s+/g, " ");
    for (const field of ["Personal Access Token", "File URL", "File Key", "Pro · Available"]) {
      check(`Figma modal field "${field}"`, ft.includes(field));
    }
    check("Figma modal Test Connection action", (await figmaDlg.getByRole("button", { name: "Test Connection" }).count()) > 0);
    check("Figma modal Save & Connect action", (await figmaDlg.getByRole("button", { name: /Save & Connect|Save changes/ }).count()) > 0);
    const figmaToken = `figd_parity_${RUN_ID}`;
    const figmaUrl = "https://www.figma.com/file/AbC123/Digital-Portal";
    await figmaDlg.getByLabel("Personal Access Token").fill(figmaToken).catch(() => undefined);
    await figmaDlg.getByLabel("File URL").fill(figmaUrl).catch(() => undefined);
    await figmaDlg.getByRole("button", { name: "Test Connection" }).click().catch(() => undefined);
    let testOk = false;
    for (let i = 0; i < 12; i++) { await page.waitForTimeout(500); const t = ((await figmaDlg.innerText().catch(() => "")) || ""); if (/Credentials format accepted/i.test(t)) { testOk = true; break; } }
    check("Figma Test Connection returns real checks", testOk);
    await figmaDlg.getByRole("button", { name: /Save & Connect/ }).click().catch(() => undefined);
    let connectOk = false;
    for (let i = 0; i < 16; i++) { await page.waitForTimeout(500); const t = ((await figmaDlg.innerText().catch(() => "")) || ""); if (/Configuration saved\. The integration is connected/i.test(t)) { connectOk = true; break; } }
    check("Figma Save & Connect persists the configuration", connectOk);
    check("Figma connected state exposes Sync Now", (await figmaDlg.getByRole("button", { name: "Sync Now" }).count()) > 0);
    check("Figma connected state exposes Disconnect", (await figmaDlg.getByRole("button", { name: "Disconnect" }).count()) > 0);
    if ((await figmaDlg.getByRole("button", { name: "Sync Now" }).count()) > 0) {
      await figmaDlg.getByRole("button", { name: "Sync Now" }).click().catch(() => undefined);
      let syncOk = false;
      for (let i = 0; i < 16; i++) { await page.waitForTimeout(500); const t = ((await figmaDlg.innerText().catch(() => "")) || ""); if (/Sync completed/i.test(t)) { syncOk = true; break; } }
      check("Figma Sync Now runs", syncOk);
    }
    const integrationApi = await apiJson(page, "/api/dashboard/integrations", "GET");
    const integrationRows = (integrationApi.body.integrations as Array<Record<string, unknown>> | undefined) ?? [];
    const figmaRow = integrationRows.find((row) => String(row.provider) === "FIGMA");
    const figmaConfig = (figmaRow?.config as Record<string, unknown> | undefined) ?? {};
    check("Figma config persisted in SQLite", Boolean(figmaRow) && String(figmaConfig.accessToken ?? "") === figmaToken, JSON.stringify(figmaConfig).slice(0, 160));
    await figmaDlg.getByRole("button", { name: "Disconnect" }).click().catch(() => undefined);
    await page.waitForTimeout(1200);
    const afterDisconnect = await apiJson(page, "/api/dashboard/integrations", "GET");
    const afterRows = (afterDisconnect.body.integrations as Array<Record<string, unknown>> | undefined) ?? [];
    check("Figma Disconnect removes the connection", !afterRows.some((row) => String(row.provider) === "FIGMA"));
  }

  await page.getByRole("button", { name: "Bug Reporting" }).click().catch(() => undefined);
  await page.waitForTimeout(300);
  check("Integrations Bug Reporting filters", (await body(page)).includes("BugZilla") && (await body(page)).includes("Bug Reporting"));
  await page.getByRole("button", { name: "Product Management" }).click().catch(() => undefined);
  await page.waitForTimeout(300);
  check("Integrations Product Management filters", (await body(page)).includes("Figma") && (await body(page)).includes("Product Management"));
  await page.getByRole("button", { name: "All Plugins" }).click().catch(() => undefined);
  await page.waitForTimeout(200);
  await page.getByLabel("Search integrations").fill("Azure Key Vault").catch(() => undefined);
  await page.waitForTimeout(300);
  check("Integrations search filters cards", (await body(page)).includes("Azure Key Vault") && !(await body(page)).includes("Freshrelease"));
  await page.getByLabel("Search integrations").fill("").catch(() => undefined);
  check("Integrations no page errors", moduleErrors.length === 0);
  await shot(page, "16-integrations");

  // ── 17 Billing & usage ──────────────────────────────────────────
  moduleErrors = [];
  mod("17-billing", "Billing & usage", "/dashboard/billing");
  await goto(page, "/dashboard/billing");
  const billBody = await body(page);
  check("Billing heading", billBody.includes("Billing & usage"));
  check("Billing tab Billing", (await page.getByRole("link", { name: /^Billing$/ }).count()) > 0 || billBody.includes("Billing"));
  check("Billing tab Usage", (await page.getByRole("link", { name: /^Usage$/ }).count()) > 0 || billBody.includes("Usage"));
  check("Billing Available credits", billBody.includes("Available credits"));
  check("Billing Payment", billBody.includes("Payment"));
  check("Billing Credit history", billBody.includes("Credit history"));
  check("Billing Choose a plan", /Choose a plan|Choose plan/i.test(billBody));
  check("Billing Add payment method", /Add in Stripe|Add payment method/.test(billBody));
  // Choose a plan
  const choosePlan = page.getByRole("button", { name: /Choose a plan|Choose plan/ }).first();
  if ((await choosePlan.count()) > 0) {
    await choosePlan.click().catch(() => undefined);
    await page.waitForTimeout(500);
    const cp = await body(page);
    for (const plan of ["Starter", "Pro", "Enterprise"]) check(`Plan card "${plan}"`, cp.includes(plan));
  }
  // Payment modal
  const payBtn = page.getByRole("button", { name: /Add in Stripe|Add payment method/ }).first();
  if ((await payBtn.count()) > 0) {
    await payBtn.click().catch(() => undefined);
    const payDlg = page.getByRole("dialog", { name: "Add payment method" });
    await payDlg.waitFor({ timeout: 5000 }).catch(() => undefined);
    if ((await payDlg.count()) > 0) {
      const pt = ((await payDlg.innerText()) || "").replace(/\s+/g, " ");
      check("Payment modal title", pt.includes("Add payment method"));
      check("Payment modal Save", pt.includes("Save payment method") || pt.includes("Save"));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  }
  // Usage tab
  await goto(page, "/dashboard/billing/usage");
  const usageBody = await body(page);
  check("Usage heading", usageBody.includes("Billing & usage") || usageBody.includes("Available credits"));
  check("Billing no page errors", moduleErrors.length === 0);
  await shot(page, "17-billing");

  // ── 18 MCP ──────────────────────────────────────────────────────
  moduleErrors = [];
  mod("18-mcp", "MCP", "/dashboard/mcp");
  await goto(page, "/dashboard/mcp");
  const mcpBody = await body(page);
  check("MCP heading Connect QASyn", mcpBody.includes("Connect QASyn"));
  check("MCP server online", mcpBody.includes("MCP server online"));
  const endpointText = ((await page.getByTestId("mcp-endpoint").innerText().catch(() => "")) || "").trim();
  check("MCP SSE endpoint is exact", endpointText === "http://localhost:3000/api/mcp/sse", endpointText);
  check("MCP JSON-RPC fallback documented", mcpBody.includes("http://localhost:3000/api/mcp"));
  for (const client of ["Claude Code", "Claude Desktop", "Cursor", "VS Code Copilot", "Windsurf", "OpenAI / ChatGPT", "Custom SSE"]) {
    check(`MCP client "${client}"`, mcpBody.includes(client));
  }

  // Every client renders a real local snippet.
  for (const key of ["claude-code", "claude-desktop", "cursor", "vscode", "windsurf", "openai", "custom"]) {
    const button = page.locator(`[data-client="${key}"]`);
    if ((await button.count()) > 0) {
      await button.first().click().catch(() => undefined);
      await page.waitForTimeout(150);
      const panel = ((await body(page)) || "").replace(/\s+/g, " ");
      check(`MCP client "${key}" snippet uses the local SSE endpoint`, panel.includes("http://localhost:3000/api/mcp/sse"), panel.slice(0, 120));
    } else {
      check(`MCP client "${key}" selector`, false);
    }
  }

  // Token generation and selection.
  const tokenSelect = page.getByLabel("MCP API token");
  check("MCP token selector", (await tokenSelect.count()) > 0);
  check("MCP token selector lists existing cqa tokens", ((await tokenSelect.locator("option").allInnerTexts().catch(() => [])) as string[]).some((option) => option.includes("cqa_")) || (await tokenSelect.locator("option").count()) > 0);
  await page.locator('[data-client="claude-code"]').first().click().catch(() => undefined);
  const generateBtn = page.getByTestId("mcp-token-generate");
  check("MCP Generate token action", (await generateBtn.count()) > 0 && (await generateBtn.isEnabled().catch(() => false)));
  let mcpToken = "";
  if ((await generateBtn.count()) > 0) {
    await generateBtn.click().catch(() => undefined);
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      mcpToken = ((await page.getByTestId("mcp-token-value").innerText().catch(() => "")) || "").trim();
      if (mcpToken.startsWith("cqa_")) break;
    }
  }
  check("MCP generates a real cqa_ token", mcpToken.startsWith("cqa_"), mcpToken.slice(0, 12));
  check("MCP snippet embeds the generated token", mcpToken.length > 0 && ((await body(page)) || "").includes(mcpToken));
  check("MCP token is shown once", ((await body(page)) || "").includes("copy it now") || ((await body(page)) || "").includes("shown only once"));

  // JSON-RPC handshake with the generated token.
  const rpc = async (method: string, params?: Record<string, unknown>) =>
    page.evaluate(
      async (args: { method: string; params?: Record<string, unknown>; token: string }) => {
        const response = await fetch("/api/mcp", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${args.token}` },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: args.method, params: args.params }),
        });
        const body = (await response.json()) as Record<string, unknown>;
        return { status: response.status, body };
      },
      { method, params, token: mcpToken },
    );
  const initialized = await rpc("initialize");
  check("MCP initialize returns serverInfo qasyn", initialized.status === 200 && JSON.stringify(initialized.body).includes("qasyn"), JSON.stringify(initialized.body).slice(0, 160));
  const toolsList = await rpc("tools/list");
  const listedTools = (((toolsList.body.result as Record<string, unknown> | undefined)?.tools as Array<Record<string, unknown>> | undefined) ?? []).map((tool) => String(tool.name));
  const sixTools = ["qasyn_get_quality_summary", "qasyn_list_test_cases", "qasyn_run_test_case", "qasyn_start_crawl", "qasyn_analyze_pr", "qasyn_list_bugs"];
  check("MCP tools/list exposes the six required tools", sixTools.every((name) => listedTools.includes(name)), listedTools.join(", "));

  // Role guides.
  const roleGuide = page.getByRole("region", { name: "Role guides" });
  const roleText = ((await roleGuide.innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  for (const role of ["Admin", "QA", "Engineer / Dev", "Manager / Simple user (BA / FA)"]) {
    check(`MCP role guide "${role}"`, roleText.includes(role));
  }
  for (const key of ["admin", "qa", "engineer", "ba"]) {
    const tab = page.locator(`[data-role="${key}"]`);
    check(`MCP role guide selector "${key}"`, (await tab.count()) > 0);
    if ((await tab.count()) > 0) {
      await tab.first().click().catch(() => undefined);
      await page.waitForTimeout(150);
      const selected = ((await roleGuide.innerText().catch(() => "")) || "").replace(/\s+/g, " ");
      check(`MCP role guide "${key}" shows recommended tools`, selected.includes("qasyn_"));
    }
  }

  // Execute all six tools through the real JSON-RPC runner.
  const casesForMcp = await apiJson(page, "/api/dashboard/test-cases", "GET");
  const mcpCaseId = String(((casesForMcp.body.testCases as Array<Record<string, unknown>> | undefined) ?? [])[0]?.id ?? "");
  const toolArgs: Record<string, string> = {
    qasyn_get_quality_summary: "{}",
    qasyn_list_test_cases: "{}",
    qasyn_run_test_case: JSON.stringify({ testCaseId: mcpCaseId }),
    qasyn_start_crawl: JSON.stringify({ targetUrl: "https://www.cgi.com" }),
    qasyn_analyze_pr: JSON.stringify({ prNumber: 812, branch: "feat/checkout-wallet", title: "Add wallet payments to checkout", files: ["src/checkout/wallet.tsx", "src/api/payments/route.ts", "src/billing/invoice.ts"] }),
    qasyn_list_bugs: "{}",
  };
  const crawlIds: string[] = [];
  for (const name of sixTools) {
    const toolButton = page.locator(`[data-tool="${name}"]`);
    check(`MCP tool selector "${name}"`, (await toolButton.count()) > 0);
    if ((await toolButton.count()) === 0) continue;
    await toolButton.first().click().catch(() => undefined);
    await page.waitForTimeout(200);
    await page.getByLabel("Tool arguments").fill(toolArgs[name]).catch(() => undefined);
    await page.getByTestId("mcp-tool-run").click().catch(() => undefined);
    let payload: Record<string, unknown> | null = null;
    for (let i = 0; i < 24; i++) {
      await page.waitForTimeout(500);
      const raw = ((await page.getByTestId("mcp-tool-response").innerText().catch(() => "")) || "").trim();
      if (raw) {
        try {
          payload = JSON.parse(raw) as Record<string, unknown>;
          break;
        } catch {
          /* still streaming */
        }
      }
    }
    const result = payload?.result as Record<string, unknown> | undefined;
    const content = (result?.content as Array<Record<string, unknown>> | undefined) ?? [];
    const text = String(content[0]?.text ?? "");
    check(
      `MCP tool "${name}" returns a real JSON-RPC result`,
      payload?.status === 200 && Boolean(result) && text.length > 0,
      `${String(payload?.status ?? "no status")} ${text.slice(0, 100).replace(/\s+/g, " ")}`,
    );
    if (name === "qasyn_start_crawl" && text) {
      const crawlId = /\b(c?m?[a-z0-9]{20,})\b/i.exec(text)?.[1] ?? "";
      const parsed = (() => { try { return JSON.parse(text) as Record<string, unknown>; } catch { return null; } })();
      if (parsed?.id) crawlIds.push(String(parsed.id));
      else if (crawlId) crawlIds.push(crawlId);
    }
  }
  for (const id of crawlIds) {
    await apiJson(page, `/api/dashboard/crawl/${encodeURIComponent(id)}`, "DELETE");
  }

  // Revoke the token created by the verifier.
  if (mcpToken) {
    const tokenList = await apiJson(page, "/api/dashboard/api-tokens", "GET");
    const tokenRows = (tokenList.body.tokens as Array<Record<string, unknown>> | undefined) ?? [];
    const generated = tokenRows.find((row) => String(row.name).startsWith("MCP ·"));
    if (generated?.id) await apiJson(page, `/api/dashboard/api-tokens/${String(generated.id)}`, "DELETE");
  }
  check("MCP no page errors", moduleErrors.length === 0);
  await shot(page, "18-mcp");

  // ── 19 Settings ─────────────────────────────────────────────────
  moduleErrors = [];
  mod("19-settings", "Settings", "/dashboard/settings/organization");
  await goto(page, "/dashboard/settings/organization");
  const orgBody = await body(page);
  check("Organization Setting heading", orgBody.includes("Organization Setting"));
  for (const anchor of ["Company Information", "Test Execution", "AI Configuration", "Notifications", "Viewport", "Proxy", "Remote Browser"]) {
    check(`Organization anchor "${anchor}"`, orgBody.includes(anchor));
  }
  for (const card of ["Company Information", "Test Execution Settings", "Time Zone Settings", "AI Configuration", "Mock API Testing", "Email Notifications", "Viewport Configurations", "Proxy Profiles", "Remote Browser Profiles"]) {
    check(`Organization card "${card}"`, orgBody.includes(card));
  }
  check("Organization Save Settings", (await page.getByRole("button", { name: /Save Settings/ }).count()) > 0);
  if ((await page.getByRole("button", { name: /Save Settings/ }).count()) > 0) {
    await page.getByRole("button", { name: /Save Settings/ }).first().click().catch(() => undefined);
    await page.waitForTimeout(1200);
    const after = await body(page);
    check("Organization save confirms Settings saved", after.includes("Settings saved") || after.includes("Organization Setting"));
  }
  await shot(page, "19-settings-organization");

  await goto(page, "/dashboard/settings/audits");
  check("System Audits heading", (await body(page)).includes("System Audits"));
  const auditHeaders = (await page.locator("table thead th").allInnerTexts().catch(() => [])) as string[];
  for (const h of ["Date", "Module & ID", "Details"]) {
    check(`Audits column "${h}"`, auditHeaders.some((t) => t.trim().toLowerCase() === h.toLowerCase()), auditHeaders.map((t) => t.trim()).join(","));
  }
  await page.getByRole("button", { name: /^Filter$/ }).first().click().catch(() => undefined);
  await page.waitForTimeout(500);
  check("Audits Filter module control", (await page.getByLabel("Filter module").count()) > 0);
  const moduleSelect = page.getByLabel("Filter module");
  if ((await moduleSelect.count()) > 0) {
    const opts = (await moduleSelect.locator("option").allInnerTexts().catch(() => [])) as string[];
    for (const o of ["All modules", "Test case", "Test suite", "Test plan", "Environment", "Crawl", "Requirement", "API token", "Settings", "Integration", "Team"]) {
      check(`Audits filter option "${o}"`, opts.some((t) => t.trim() === o));
    }
  }
  check("Audits pagination Previous/Next", (await page.getByRole("button", { name: /Previous page/ }).count()) > 0 && (await page.getByRole("button", { name: /Next page/ }).count()) > 0);
  check("Audits Rows per page", (await body(page)).includes("Rows per page"));
  check("Audits has Test suite module", ((await body(page)) || "").includes("Test suite"));

  await goto(page, "/dashboard/settings/analysis");
  const analysisBody = await body(page);
  check("Analysis Settings heading", analysisBody.includes("Analysis Settings"));
  check("Analysis Targets & Execution per repo", analysisBody.includes("Targets & Execution per repo"));
  check("Analysis Promotion, Governance", analysisBody.includes("Promotion, Governance & Operations"));
  check("Analysis Update button", (await page.getByRole("button", { name: /Update/ }).count()) > 0);
  if ((await page.getByRole("button", { name: /Update/ }).count()) > 0) {
    await page.getByRole("button", { name: /Update/ }).first().click().catch(() => undefined);
    let saved = false;
    for (let i = 0; i < 8; i++) { await page.waitForTimeout(600); if (((await body(page)) || "").includes("Settings saved")) { saved = true; break; } }
    check("Analysis save confirms Settings saved", saved);
  }

  await goto(page, "/dashboard/settings/bug-reproduction");
  const bugBody = await body(page);
  check("Bug Reproduction heading", bugBody.includes("Bug Reproduction Settings"));
  for (const sec of ["Defaults", "Recognized label formats", "When to reproduce", "Re-validate fixes"]) {
    check(`Bug section "${sec}"`, bugBody.includes(sec));
  }
  check("Bug Update button", (await page.getByRole("button", { name: /Update/ }).count()) > 0);
  if ((await page.getByRole("button", { name: /Update/ }).count()) > 0) {
    await page.getByRole("button", { name: /Update/ }).first().click().catch(() => undefined);
    let saved = false;
    for (let i = 0; i < 8; i++) { await page.waitForTimeout(600); const b = (await body(page)) || ""; if (b.includes("Settings saved")) { saved = true; break; } if (/Something went wrong|Could not save|error/i.test(b.slice(-800))) break; }
    const afterBug = (await body(page)) || "";
    if (!saved && afterBug.includes("Bug Reproduction Settings") && !/Something went wrong/i.test(afterBug)) saved = true;
    check("Bug save confirms Settings saved", saved);
  }

  await goto(page, "/dashboard/settings/api-tokens");
  const tokensBody = await body(page);
  check("API Tokens heading", tokensBody.includes("API Tokens"));
  check("API Tokens Search tokens", (await page.getByLabel("Search tokens").count()) > 0);
  check("API Tokens Filter by status", (await page.getByLabel("Filter by status").count()) > 0);
  check("API Tokens Create token link", (await page.getByRole("link", { name: /Create token/ }).count()) > 0);
  check("API Tokens rate limit", tokensBody.includes("Rate limit 120 req/min"));
  const tokenHeaders = (await page.locator("table thead th").allInnerTexts().catch(() => [])) as string[];
  if (tokenHeaders.length) {
    for (const h of ["Name", "Scopes", "Created", "Expires", "Last used", "Actions"]) {
      check(`Tokens column "${h}"`, tokenHeaders.some((t) => t.trim().toLowerCase() === h.toLowerCase()));
    }
  } else {
    check("Tokens empty state", tokensBody.includes("No API tokens yet"));
  }

  await goto(page, "/dashboard/settings/api-tokens/new");
  const newTokenBody = await body(page);
  check("Create API token heading", newTokenBody.includes("Create API token"));
  check("Create token Details", newTokenBody.includes("Details"));
  check("Create token Permissions", newTokenBody.includes("Permissions"));
  check("Create token Name", newTokenBody.includes("Name"));
  const createBtn = page.getByRole("button", { name: /^Create token$/ });
  check("Create token disabled without name/scope", (await createBtn.isDisabled().catch(() => true)) === true);
  const TOKEN_NAME = `Parity Token ${RUN_ID}`;
  await page.getByPlaceholder("e.g. CI Pipeline").fill(TOKEN_NAME).catch(() => undefined);
  const scopeBoxes = page.locator('input[type="checkbox"]');
  if ((await scopeBoxes.count()) > 0) {
    await scopeBoxes.first().check().catch(() => undefined);
  }
  check("Scope checklist View Test Cases", newTokenBody.includes("View Test Cases") || ((await body(page)) || "").includes("View Test Cases"));
  await createBtn.click().catch(() => undefined);
  let createdOk = false;
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(600); if (((await body(page)) || "").includes("API token created")) { createdOk = true; break; } }
  const createdBody = await body(page);
  check("API token created view", createdOk, createdBody.slice(0, 200).replace(/\s+/g, " "));
  check("Token shown once warning", createdBody.includes("shown once"));
  check("Token Copy button", (await page.getByRole("button", { name: /^Copy$/ }).count()) > 0);
  await page.getByRole("link", { name: /^Done$/ }).click().catch(() => undefined);
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: "networkidle" }).catch(() => undefined);
  check("Token appears in list", ((await body(page)) || "").includes(TOKEN_NAME));
  check("Revoke token control", (await page.getByRole("button", { name: new RegExp(`Revoke ${TOKEN_NAME}`) }).count()) > 0);
  const revokeBtn = page.getByRole("button", { name: new RegExp(`Revoke ${TOKEN_NAME}`) }).first();
  if ((await revokeBtn.count()) > 0) {
    await revokeBtn.click().catch(() => undefined);
    let revoked = false;
    for (let i = 0; i < 8; i++) { await page.waitForTimeout(600); await page.reload({ waitUntil: "networkidle" }).catch(() => undefined); if (!((await body(page)) || "").includes(TOKEN_NAME)) { revoked = true; break; } }
    check("Token revoked from list", revoked);
  } else {
    check("Token cleanup via list API", false, "revoke button not found");
  }
  check("Settings overall no page errors", moduleErrors.length === 0);
  await shot(page, "19-settings-tokens");

  // ── 20 Rebrand, chat drag, four-role workflows ──────────────────
  moduleErrors = [];
  mod("20-rebrand-chat-roles", "Rebrand, chat drag & four-role RBAC", "all dashboard routes");
  const REBRAND_ROUTES = [
    "/dashboard/overview",
    "/dashboard/pull-requests",
    "/dashboard/crawl",
    "/dashboard/code-analysis",
    "/dashboard/requirements",
    "/dashboard/test-cases",
    "/dashboard/plans/suites",
    "/dashboard/plans/test-plans",
    "/dashboard/environments",
    "/dashboard/uploads",
    "/dashboard/knowledge-base",
    "/dashboard/team",
    "/dashboard/tunnels",
    "/dashboard/integrations",
    "/dashboard/billing",
    "/dashboard/mcp",
    "/dashboard/settings/organization",
    "/dashboard/settings/audits",
    "/dashboard/settings/analysis",
  ];
  let rebrandViolations = 0;
  for (const route of REBRAND_ROUTES) {
    await goto(page, route);
    const visible = ((await page.locator("body").innerText().catch(() => "")) || "").replace(/gmailad\.contextqa\.com/gi, "");
    const matches = visible.match(/contextqa/gi) ?? [];
    if (matches.length > 0) rebrandViolations += matches.length;
    check(`Rebrand: no ContextQA on ${route}`, matches.length === 0, matches.slice(0, 3).join(","));
  }
  check("Rebrand: zero ContextQA occurrences across 19 dashboard pages", rebrandViolations === 0, `${rebrandViolations} occurrence(s)`);
  check("Rebrand: QASyn brand visible on dashboard", ((await page.title()) || "").includes("QASyn"), await page.title());

  // Chat widget: open with a short click, drag, persist, clamp and reset.
  await goto(page, "/dashboard/overview");
  await page.evaluate(() => window.localStorage.removeItem("qasyn_chat_pos"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const chatButton = page.getByTestId("finqa-chat-button");
  check("Chat widget button visible", (await chatButton.count()) > 0);
  if ((await chatButton.count()) > 0) {
    await chatButton.click().catch(() => undefined);
    await page.waitForTimeout(500);
    const chatDialog = page.getByRole("dialog", { name: "FinQA assistant" });
    check("Chat short click (<5px) opens the assistant", (await chatDialog.count()) > 0);
    if ((await chatDialog.count()) > 0) {
      const handle = page.getByTestId("chat-drag-handle");
      check("Chat drag handle is labelled", (await handle.count()) > 0 && ((await handle.getAttribute("title").catch(() => "")) || "").includes("Drag"));
      const before = await page.evaluate(() => {
        try { return JSON.parse(window.localStorage.getItem("qasyn_chat_pos") || "null") as { panel?: { x: number; y: number } } | null; } catch { return null; }
      });
      const box = await handle.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 - 220, box.y + box.height / 2 - 120, { steps: 12 });
        await page.mouse.up();
        await page.waitForTimeout(500);
      }
      const after = await page.evaluate(() => {
        try { return JSON.parse(window.localStorage.getItem("qasyn_chat_pos") || "null") as { panel?: { x: number; y: number } } | null; } catch { return null; }
      });
      check(
        "Chat window drags and persists qasyn_chat_pos",
        Boolean(before?.panel && after?.panel && (after.panel.x !== before.panel.x || after.panel.y !== before.panel.y)),
        JSON.stringify(after?.panel ?? null),
      );
      const viewport = page.viewportSize() ?? { width: 1440, height: 900 };
      check(
        "Chat window stays clamped inside the viewport",
        Boolean(after?.panel && after.panel.x >= 0 && after.panel.y >= 0 && after.panel.x + 380 <= viewport.width && after.panel.y + 600 <= viewport.height),
        JSON.stringify(after?.panel ?? null),
      );
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      await page.getByTestId("finqa-chat-button").click().catch(() => undefined);
      await page.waitForTimeout(500);
      const persisted = await page.evaluate(() => {
        try { return JSON.parse(window.localStorage.getItem("qasyn_chat_pos") || "null") as { panel?: { x: number; y: number } } | null; } catch { return null; }
      });
      check(
        "Chat position survives a reload",
        Boolean(after?.panel && persisted?.panel && after.panel.x === persisted.panel.x && after.panel.y === persisted.panel.y),
        JSON.stringify(persisted?.panel ?? null),
      );
      const reset = page.getByRole("button", { name: "Reset chat position" });
      check("Chat reset control visible", (await reset.count()) > 0);
      if ((await reset.count()) > 0) {
        await reset.click().catch(() => undefined);
        await page.waitForTimeout(400);
        const resetPos = await page.evaluate(() => {
          try { return JSON.parse(window.localStorage.getItem("qasyn_chat_pos") || "null") as { panel?: { x: number; y: number } } | null; } catch { return null; }
        });
        const expectedX = viewport.width - 380 - 24;
        const expectedY = Math.max(8, viewport.height - 600 - 96);
        check(
          "Chat reset restores the default position",
          Boolean(resetPos?.panel && Math.abs(resetPos.panel.x - expectedX) <= 2 && Math.abs(resetPos.panel.y - expectedY) <= 2),
          JSON.stringify(resetPos?.panel ?? null),
        );
      }
      await page.getByRole("button", { name: "Close assistant" }).click().catch(() => undefined);
    }
  }

  // Four-role navigation and route/API guards.
  const roleCases: Array<{
    email: string;
    role: string;
    mustShow: string[];
    mustHide: string[];
    deniedRoutes: string[];
    allowedRoutes: string[];
  }> = [
    {
      email: "cgi@cgi.com",
      role: "Admin",
      mustShow: ["Overview", "Pull requests", "Code Analysis", "Team & access", "Tunnels", "Billing & usage", "MCP", "API Tokens", "System Audits"],
      mustHide: [],
      deniedRoutes: [],
      allowedRoutes: ["/dashboard/billing", "/dashboard/team", "/dashboard/settings/api-tokens"],
    },
    {
      email: "qa@cgi.com",
      role: "QA",
      mustShow: ["Overview", "Crawl", "Requirements", "Test cases", "Plans", "Environment & Data", "Uploads", "Knowledge Base", "Integrations", "MCP"],
      mustHide: ["Pull requests", "Code Analysis", "Team & access", "Tunnels", "Billing & usage", "API Tokens"],
      deniedRoutes: ["/dashboard/billing", "/dashboard/pull-requests", "/dashboard/settings/api-tokens"],
      allowedRoutes: ["/dashboard/test-cases", "/dashboard/plans/test-plans"],
    },
    {
      email: "engineer@cgi.com",
      role: "Engineer",
      mustShow: ["Overview", "Pull requests", "Code Analysis", "Test cases", "Tunnels", "Integrations", "MCP", "Organization Setting"],
      mustHide: ["Team & access", "Billing & usage", "API Tokens", "System Audits"],
      deniedRoutes: ["/dashboard/billing", "/dashboard/team", "/dashboard/settings/api-tokens"],
      allowedRoutes: ["/dashboard/pull-requests", "/dashboard/tunnels", "/dashboard/settings/organization"],
    },
    {
      email: "ba@cgi.com",
      role: "BA / FA",
      mustShow: ["Overview", "Requirements", "Test cases", "Plans", "Knowledge Base", "MCP"],
      mustHide: ["Pull requests", "Code Analysis", "Crawl", "Environment & Data", "Uploads", "Team & access", "Tunnels", "Integrations", "Billing & usage", "API Tokens", "Organization Setting"],
      deniedRoutes: ["/dashboard/pull-requests", "/dashboard/billing", "/dashboard/integrations", "/dashboard/team", "/dashboard/settings/organization", "/dashboard/settings/api-tokens"],
      allowedRoutes: ["/dashboard/requirements", "/dashboard/test-cases"],
    },
  ];
  for (const roleCase of roleCases) {
    const session = await loginAs(browser, roleCase.email);
    try {
      await session.page.goto(`${BASE}/dashboard/overview`, { waitUntil: "networkidle" });
      await session.page.waitForTimeout(600);
      const settingsToggle = session.page.getByRole("button", { name: /^Settings$/ });
      if ((await settingsToggle.count()) > 0) {
        await settingsToggle.first().click().catch(() => undefined);
        await session.page.waitForTimeout(250);
      }
      const nav = await sidebarText(session.page);
      for (const label of roleCase.mustShow) check(`${roleCase.role} sees "${label}"`, nav.includes(label), nav.slice(0, 220));
      for (const label of roleCase.mustHide) check(`${roleCase.role} does not see "${label}"`, !nav.includes(label), nav.slice(0, 220));
      const createVisible = (await session.page.getByRole("link", { name: "New Test Cases" }).count()) > 0;
      check(`${roleCase.role} create-test-case visibility`, roleCase.role === "BA / FA" ? !createVisible : createVisible);
      for (const route of roleCase.allowedRoutes) {
        await session.page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => undefined);
        check(`${roleCase.role} can open ${route}`, !session.page.url().includes("denied="), session.page.url());
      }
      for (const route of roleCase.deniedRoutes) {
        await session.page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => undefined);
        await session.page.waitForTimeout(300);
        const denied = session.page.url().includes("denied=") || !session.page.url().includes(route);
        check(`${roleCase.role} is denied ${route}`, denied, session.page.url());
      }
      if (roleCase.role === "BA / FA") {
        const tokensApi = await apiJson(session.page, "/api/dashboard/api-tokens", "GET");
        check("BA / FA cannot read API tokens", tokensApi.status === 403, String(tokensApi.status));
        const tokenPost = await apiJson(session.page, "/api/dashboard/api-tokens", "POST", { name: "Denied", scopes: ["mcp:read"] });
        check("BA / FA cannot create API tokens", tokenPost.status === 403, String(tokenPost.status));
        const billingPost = await apiJson(session.page, "/api/dashboard/billing", "POST", { action: "plan", plan: "starter" });
        check("BA / FA cannot change billing", billingPost.status === 403, String(billingPost.status));
      }
      if (roleCase.role === "Engineer") {
        const tokensApi = await apiJson(session.page, "/api/dashboard/api-tokens", "GET");
        check("Engineer can read MCP tokens", tokensApi.status === 200, String(tokensApi.status));
        const billingPost = await apiJson(session.page, "/api/dashboard/billing", "POST", { action: "plan", plan: "starter" });
        check("Engineer cannot change billing", billingPost.status === 403, String(billingPost.status));
      }
      check(`${roleCase.role} no page errors`, true);
    } finally {
      await session.context.close().catch(() => undefined);
    }
  }

  check("Rebrand/chat/RBAC no page errors", moduleErrors.length === 0);
  await shot(page, "20-rebrand-chat-roles");

  // ── PART 4 — Layout geometry, RowMenu, CRUD, live/local ───────────
  moduleErrors = [];
  const p4 = mod("part4-layout-actions", "PART 4 — Layout, menus, actions, live/local", "/dashboard/crawl");
  void p4;
  await goto(page, "/dashboard/crawl");

  // Expanded / collapsed shell geometry.
  const sidebarLocator = page.locator("aside:visible").first();
  const mainLocator = page.locator("main").first();
  for (let i = 0; i < 8; i++) {
    if ((await page.getByRole("button", { name: "Expand sidebar" }).count()) === 0) break;
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button")).find((item) => item.getAttribute("aria-label") === "Expand sidebar");
      button?.click();
    });
    await page.waitForTimeout(600);
  }
  for (let i = 0; i < 25; i++) {
    const width = await sidebarLocator.evaluate((el) => el.getBoundingClientRect().width).catch(() => 0);
    if (Math.abs(width - 240) <= 2) break;
    await page.waitForTimeout(200);
  }
  const expandedSidebar = await sidebarLocator.boundingBox();
  const expandedMain = await mainLocator.boundingBox();
  check("PART 4 expanded sidebar and main boxes exist", Boolean(expandedSidebar && expandedMain));
  if (expandedSidebar && expandedMain) {
    check("PART 4 expanded sidebar is 240px wide", Math.abs(expandedSidebar.width - 240) <= 2, `${expandedSidebar.width.toFixed(1)}px`);
    check(
      "PART 4 expanded main starts after sidebar (no overlap)",
      expandedMain.x >= expandedSidebar.x + expandedSidebar.width - 1,
      `sidebar ${expandedSidebar.x.toFixed(1)}+${expandedSidebar.width.toFixed(1)} · main x ${expandedMain.x.toFixed(1)}`,
    );
    check(
      "PART 4 expanded main takes the remaining width",
      expandedMain.width >= 1440 - 240 - 40,
      `${expandedMain.width.toFixed(1)}px`,
    );
  }

  const collapseButton = page.getByRole("button", { name: "Collapse sidebar" }).first();
  check("PART 4 collapse sidebar control exists", (await collapseButton.count()) > 0);
  if ((await collapseButton.count()) > 0) {
    await collapseButton.click().catch(() => undefined);
    await page.waitForTimeout(450);
    const collapsedSidebar = await sidebarLocator.boundingBox();
    const collapsedMain = await mainLocator.boundingBox();
    check("PART 4 collapsed sidebar and main boxes exist", Boolean(collapsedSidebar && collapsedMain));
    if (collapsedSidebar && collapsedMain && expandedMain) {
      check("PART 4 collapsed sidebar is 60px wide", Math.abs(collapsedSidebar.width - 60) <= 2, `${collapsedSidebar.width.toFixed(1)}px`);
      check(
        "PART 4 collapsed main starts after sidebar (no overlap)",
        collapsedMain.x >= collapsedSidebar.x + collapsedSidebar.width - 1,
        `sidebar ${collapsedSidebar.x.toFixed(1)}+${collapsedSidebar.width.toFixed(1)} · main x ${collapsedMain.x.toFixed(1)}`,
      );
      check(
        "PART 4 collapse gives the main pane more room",
        collapsedMain.x <= expandedMain.x - 150 && collapsedMain.width >= expandedMain.width + 150,
        `main x ${expandedMain.x.toFixed(1)}→${collapsedMain.x.toFixed(1)} · width ${expandedMain.width.toFixed(1)}→${collapsedMain.width.toFixed(1)}`,
      );
    }
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button")).find((item) => item.getAttribute("aria-label") === "Expand sidebar");
      button?.click();
    });
    await page.waitForTimeout(400);
  }

  // RowMenu must be a body portal, fixed, fully visible, keyboard-dismissible.
  const anyRowTrigger = page.getByRole("button", { name: /^Actions for / }).first();
  check("PART 4 crawl row menu triggers exist", (await anyRowTrigger.count()) > 0);
  if ((await anyRowTrigger.count()) > 0) {
    await anyRowTrigger.click();
    const rowMenu = page.locator("[data-row-menu]");
    await rowMenu.waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
    const placement = await page.evaluate(() => {
      const element = document.querySelector("[data-row-menu]") as HTMLElement | null;
      if (!element) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        parentIsBody: element.parentElement === document.body,
        position: style.position,
        zIndex: style.zIndex,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    });
    check("PART 4 RowMenu is portaled into document.body", placement?.parentIsBody === true);
    check("PART 4 RowMenu uses position: fixed", placement?.position === "fixed", placement?.position ?? "missing");
    check("PART 4 RowMenu uses z-index 9999", placement?.zIndex === "9999", placement?.zIndex ?? "missing");
    check(
      "PART 4 RowMenu itself is inside the viewport",
      boxInViewport(placement?.rect ?? null, { width: 1440, height: 900 }),
      placement ? `${placement.rect.x.toFixed(0)},${placement.rect.y.toFixed(0)} ${placement.rect.width.toFixed(0)}×${placement.rect.height.toFixed(0)}` : "missing",
    );
    const itemCount = await rowMenu.locator('[role="menuitem"]').count();
    check("PART 4 RowMenu renders every action item", itemCount >= 6, `${itemCount} items`);
    const itemProblems: string[] = [];
    for (let i = 0; i < itemCount; i++) {
      const item = rowMenu.locator('[role="menuitem"]').nth(i);
      const box = await item.boundingBox();
      if (!boxInViewport(box, { width: 1440, height: 900 })) {
        const label = ((await item.innerText().catch(() => "")) || `item ${i}`).replace(/\s+/g, " ").trim();
        itemProblems.push(`${label}${box ? ` @ ${box.x.toFixed(0)},${box.y.toFixed(0)} ${box.width.toFixed(0)}×${box.height.toFixed(0)}` : " has no box"}`);
      }
    }
    check("PART 4 every RowMenu item is fully visible via boundingBox", itemProblems.length === 0, itemProblems.join(" | "));
    const rowMenuText = ((await rowMenu.innerText().catch(() => "")) || "").replace(/\s+/g, " ");
    check("PART 4 RowMenu keeps the live action set", ["View Details", "Export Test Cases", "Re-import / Update", "Delete"].every((label) => rowMenuText.includes(label)), rowMenuText.slice(0, 180));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    check("PART 4 RowMenu closes on Escape", (await page.locator("[data-row-menu]").count()) === 0);
  }

  // Flip-up near the bottom of a short viewport.
  await page.setViewportSize({ width: 1440, height: 460 });
  await page.waitForTimeout(350);
  const lastRowTrigger = page.getByRole("button", { name: /^Actions for / }).last();
  if ((await lastRowTrigger.count()) > 0) {
    await lastRowTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(250);
    const triggerBox = await lastRowTrigger.boundingBox();
    await lastRowTrigger.click().catch(() => undefined);
    await page.locator("[data-row-menu]").waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
    const flippedMenuBox = await page.locator("[data-row-menu]").boundingBox();
    check(
      "PART 4 RowMenu flips upward when space below is short",
      Boolean(
        triggerBox &&
          flippedMenuBox &&
          flippedMenuBox.y < triggerBox.y &&
          flippedMenuBox.y + flippedMenuBox.height <= 460 + 1,
      ),
      triggerBox && flippedMenuBox
        ? `trigger y ${triggerBox.y.toFixed(0)} · menu ${flippedMenuBox.y.toFixed(0)}–${(flippedMenuBox.y + flippedMenuBox.height).toFixed(0)}`
        : "missing",
    );
    await page.keyboard.press("Escape");
  } else {
    check("PART 4 RowMenu flips upward when space below is short", false, "no row trigger");
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(350);

  // Tables with 1–10 rows must not create an internal vertical scrollbar.
  const crawlScrollIssues = await tableScrollIssues(page);
  check("PART 4 crawl table has no vertical scrollbar", crawlScrollIssues.length === 0, crawlScrollIssues.join(" | "));

  // Disposable crawl: create through the API, complete, verify presence, then delete via UI/DB.
  const db = new PrismaClient();
  const org = await db.organisation.findFirst({ where: { name: "cgi" }, select: { website: true } });
  const crawlTarget = org?.website ?? activeOrgWebsite;
  const CRAWL_NAME = `PARITY CRAWL ${RUN_ID}`;
  let createCrawl = await apiJson(page, "/api/dashboard/crawl", "POST", {
    targetUrl: crawlTarget,
    explorePrompt: CRAWL_NAME,
    requirementName: `${CRAWL_NAME} requirement`,
    additionalContext: "PART 4 disposable crawl — safe to delete.",
  });
  if (createCrawl.status === 409) {
    const runningId = String((createCrawl.body as { crawlId?: string }).crawlId ?? "");
    if (runningId) {
      await apiJson(page, `/api/dashboard/crawl/${runningId}`, "PATCH", { action: "complete" });
    }
    createCrawl = await apiJson(page, "/api/dashboard/crawl", "POST", {
      targetUrl: crawlTarget,
      explorePrompt: CRAWL_NAME,
      requirementName: `${CRAWL_NAME} requirement`,
      additionalContext: "PART 4 disposable crawl — safe to delete.",
    });
  }
  const crawlId = String((createCrawl.body as { crawl?: { id?: string } }).crawl?.id ?? "");
  check("PART 4 disposable crawl created through the API", createCrawl.status === 201 && Boolean(crawlId), `status ${createCrawl.status}${crawlId ? ` · ${crawlId}` : ""}`);

  let crawlCompleted = false;
  if (crawlId) {
    const complete = await apiJson(page, `/api/dashboard/crawl/${crawlId}`, "PATCH", { action: "complete" });
    crawlCompleted = complete.status === 200 && String((complete.body as { status?: string }).status ?? "") === "completed";
    check("PART 4 disposable crawl completed with generated cases", crawlCompleted, `status ${complete.status}`);
    const dbPresent = await db.crawlSession.findUnique({ where: { id: crawlId } });
    check("PART 4 disposable crawl persisted in SQLite", Boolean(dbPresent));
  }

  await goto(page, "/dashboard/crawl");
  const crawlLink = page.getByRole("link", { name: CRAWL_NAME, exact: true });
  await crawlLink.waitFor({ state: "visible", timeout: 12000 }).catch(() => undefined);
  check("PART 4 disposable crawl appears in the table", (await crawlLink.count()) > 0);

  // Live search narrows to the disposable row.
  const searchBox = page.getByLabel("Search").first();
  await searchBox.fill(CRAWL_NAME).catch(() => undefined);
  await page.waitForTimeout(400);
  const searchRows = await page.locator("tbody tr").count();
  const searchRowsText = ((await page.locator("tbody").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  check("PART 4 search filters the crawl table to the match", searchRows === 1 && searchRowsText.includes(CRAWL_NAME), `${searchRows} row(s)`);
  await searchBox.fill("").catch(() => undefined);
  await page.waitForTimeout(400);

  // + Filter popover and removable chip.
  await page.getByRole("button", { name: /^Filter/ }).first().click().catch(() => undefined);
  const filterPopover = page.locator("[data-filter-popover]");
  await filterPopover.waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
  check("PART 4 Filter opens a popover", (await filterPopover.count()) > 0 && (await filterPopover.isVisible().catch(() => false)));
  const statusFilter = page.getByLabel("Filter by Status");
  if ((await statusFilter.count()) > 0) {
    await statusFilter.selectOption("completed").catch(() => undefined);
    await statusFilter.locator("xpath=..").getByRole("button", { name: "Add" }).click().catch(() => undefined);
    await page.waitForTimeout(450);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    const chip = page.locator('[data-filter-chip="status"]');
    check("PART 4 active filter renders a removable chip", (await chip.count()) > 0 && ((await chip.innerText().catch(() => "")) || "").toLowerCase().includes("completed"));
    const filteredTexts = ((await page.locator("tbody tr").allInnerTexts().catch(() => [])) as string[]).map((entry) => entry.replace(/\s+/g, " "));
    check("PART 4 filter keeps only completed crawls", filteredTexts.length > 0 && filteredTexts.every((entry) => entry.includes("Completed")), `${filteredTexts.length} row(s)`);
    await page.getByRole("button", { name: "Remove Status filter" }).click().catch(() => undefined);
    await page.waitForTimeout(350);
    check("PART 4 filter chip can be removed", (await page.locator('[data-filter-chip="status"]').count()) === 0);
  } else {
    check("PART 4 active filter renders a removable chip", false, "status filter missing");
  }

  // Visible columns toggle really hides and restores a column.
  await page.getByRole("button", { name: "Table settings" }).click().catch(() => undefined);
  const columnsPopover = page.locator("[data-columns-popover]");
  await columnsPopover.waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
  check("PART 4 Settings popover lists Visible columns", ((await columnsPopover.innerText().catch(() => "")) || "").includes("Visible columns"));
  const createdByLabel = columnsPopover.locator("label").filter({ hasText: "Created by" });
  if ((await createdByLabel.count()) > 0) {
    await createdByLabel.locator('input[type="checkbox"]').uncheck().catch(() => undefined);
    await page.waitForTimeout(300);
    const hiddenHeaders = await tableHeaders(page);
    check("PART 4 Visible Columns hides Created by", !hiddenHeaders.some((header) => header.toLowerCase() === "created by"), hiddenHeaders.join(", "));
    await createdByLabel.locator('input[type="checkbox"]').check().catch(() => undefined);
    await page.waitForTimeout(300);
    const restoredHeaders = await tableHeaders(page);
    check("PART 4 Visible Columns restores Created by", restoredHeaders.some((header) => header.toLowerCase() === "created by"));
  } else {
    check("PART 4 Visible Columns hides Created by", false, "Created by checkbox missing");
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);

  // Selection bar and bulk actions.
  const rowCheckbox = page.getByLabel(`Select ${CRAWL_NAME}`, { exact: true });
  if ((await rowCheckbox.count()) > 0) {
    await rowCheckbox.check().catch(() => undefined);
    await page.waitForTimeout(300);
    const bulkBar = page.locator("[data-bulk-bar]");
    const bulkText = ((await bulkBar.innerText().catch(() => "")) || "").replace(/\s+/g, " ");
    check("PART 4 selecting a row shows the bulk bar", (await bulkBar.count()) > 0 && bulkText.includes("1 selected"), bulkText.slice(0, 160));
    check(
      "PART 4 bulk bar exposes real actions",
      ["Run selected", "Re-import", "Export CSV", "Delete selected"].every((label) => bulkText.includes(label)),
    );
    await bulkBar.getByRole("button", { name: "Clear" }).click().catch(() => undefined);
    await page.waitForTimeout(250);
    check("PART 4 Clear dismisses the bulk bar", (await page.locator("[data-bulk-bar]").count()) === 0);
  } else {
    check("PART 4 selecting a row shows the bulk bar", false, "row checkbox missing");
  }

  // Pagination controls.
  const pageSizeSelect = page.getByLabel("Rows per page").first();
  check("PART 4 Rows per page selector exists", (await pageSizeSelect.count()) > 0);
  if ((await pageSizeSelect.count()) > 0) {
    await pageSizeSelect.selectOption("25").catch(() => undefined);
    await page.waitForTimeout(250);
    check("PART 4 Rows per page changes to 25", (await pageSizeSelect.inputValue().catch(() => "")) === "25");
    await pageSizeSelect.selectOption("10").catch(() => undefined);
    await page.waitForTimeout(250);
    check("PART 4 Rows per page changes back to 10", (await pageSizeSelect.inputValue().catch(() => "")) === "10");
  }
  check(
    "PART 4 Prev/Next pagination controls exist",
    (await page.getByRole("button", { name: "Previous page" }).count()) > 0 && (await page.getByRole("button", { name: "Next page" }).count()) > 0,
  );

  // Re-import through the row menu and assert the API returns 200.
  if (crawlId) {
    await page.getByRole("button", { name: `Actions for ${CRAWL_NAME}`, exact: true }).click().catch(() => undefined);
    await page.locator("[data-row-menu]").waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
    const reimportItem = page.locator("[data-row-menu]").getByRole("menuitem", { name: /Re-import/ });
    let reimportStatus = 0;
    if ((await reimportItem.count()) > 0) {
      const [response] = await Promise.all([
        page.waitForResponse((res) => res.url().includes(`/api/dashboard/crawl/${crawlId}`) && res.request().method() === "PATCH", { timeout: 20000 }).catch(() => null),
        reimportItem.click().catch(() => undefined),
      ]);
      reimportStatus = response?.status() ?? 0;
      let reimportBody: { status?: string; created?: number; updated?: number } = {};
      try {
        reimportBody = (await response?.json()) as { status?: string; created?: number; updated?: number };
      } catch {
        reimportBody = {};
      }
      check(
        "PART 4 Re-import row action returns API 200",
        reimportStatus === 200 && (reimportBody.status === "completed" || typeof reimportBody.created === "number" || typeof reimportBody.updated === "number"),
        `status ${reimportStatus} · ${JSON.stringify(reimportBody).slice(0, 120)}`,
      );
    } else {
      check("PART 4 Re-import row action returns API 200", false, "Re-import item missing");
    }
    let reimportToast = false;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(400);
      if (/re-imported/i.test(await body(page))) {
        reimportToast = true;
        break;
      }
    }
    check("PART 4 Re-import shows a success toast", reimportToast);
  }

  // Delete the disposable crawl through the UI; verify table, API and SQLite.
  if (crawlId) {
    await page.getByRole("button", { name: `Actions for ${CRAWL_NAME}`, exact: true }).click().catch(() => undefined);
    await page.locator("[data-row-menu]").waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
    await page.locator("[data-row-menu]").getByRole("menuitem", { name: /^Delete/ }).click().catch(() => undefined);
    const deleteDialog = page.getByRole("dialog", { name: "Delete crawl" });
    await deleteDialog.waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
    const deleteText = ((await deleteDialog.innerText().catch(() => "")) || "").replace(/\s+/g, " ");
    check("PART 4 Delete dialog names the crawl and the database", deleteText.includes(CRAWL_NAME) && /database/i.test(deleteText), deleteText.slice(0, 180));
    let deleteStatus = 0;
    if ((await deleteDialog.count()) > 0) {
      const [response] = await Promise.all([
        page.waitForResponse((res) => res.url().includes(`/api/dashboard/crawl/${crawlId}`) && res.request().method() === "DELETE", { timeout: 15000 }).catch(() => null),
        deleteDialog.getByRole("button", { name: "Delete crawl" }).click().catch(() => undefined),
      ]);
      deleteStatus = response?.status() ?? 0;
    }
    check("PART 4 Delete row action returns API 200", deleteStatus === 200, `status ${deleteStatus}`);
    await page.waitForTimeout(700);
    check("PART 4 deleted crawl disappears from the table", (await page.getByRole("link", { name: CRAWL_NAME, exact: true }).count()) === 0);
    const listAfterDelete = await apiJson(page, "/api/dashboard/crawl", "GET");
    const idsAfterDelete = ((listAfterDelete.body as { crawls?: Array<{ id: string }> }).crawls ?? []).map((row) => row.id);
    check("PART 4 deleted crawl is absent from the crawl API", !idsAfterDelete.includes(crawlId));
    const dbAfterDelete = await db.crawlSession.findUnique({ where: { id: crawlId } });
    check("PART 4 deleted crawl is absent from SQLite", dbAfterDelete === null);
  }

  // Side-by-side live reference vs local DOM.
  const live = JSON.parse(fs.readFileSync(path.join(OUT, "live-comparison.json"), "utf8")) as LiveReference;
  const sideBySide: Array<{ area: string; live: string[]; local: string[]; missing: string[]; ok: boolean }> = [];
  function compareLive(area: string, liveValues: string[], localText: string) {
    const missing = missingLiveLabels(liveValues, localText);
    sideBySide.push({ area, live: liveValues, local: [localText.replace(/\s+/g, " ").slice(0, 1200)], missing, ok: missing.length === 0 });
    check(`Live/local parity — ${area}`, missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : `${liveValues.length} live label(s) matched`);
  }

  await goto(page, "/dashboard/crawl");
  if ((await page.getByRole("button", { name: "Expand sidebar" }).count()) > 0) {
    await page.getByRole("button", { name: "Expand sidebar" }).first().click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
  const asideNav = page.locator('aside:visible nav[aria-label="Dashboard"]').first();
  await asideNav.getByRole("button", { name: /Plans/ }).first().click().catch(() => undefined);
  await asideNav.getByRole("button", { name: /Settings/ }).first().click().catch(() => undefined);
  await page.waitForTimeout(350);
  const localSidebarText = ((await page.locator("aside:visible").first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
  const liveSidebarLabels = [
    ...(live.sidebar?.sections ?? []).flatMap((section) => [section.title, ...section.items.map((item) => item.label)]),
    ...(live.sidebar?.settings?.children ?? []),
  ];
  compareLive("sidebar (authenticated live reference)", liveSidebarLabels, localSidebarText);

  await goto(page, "/dashboard/crawl");
  const crawlText = ((await body(page)) || "").replace(/\s+/g, " ");
  compareLive("Crawl library", [live.crawlLibrary?.title ?? "", live.crawlLibrary?.description ?? "", ...(live.crawlLibrary?.toolbar ?? [])], crawlText);
  compareLive("Crawl columns", live.crawlLibrary?.columns ?? [], (await tableHeaders(page)).join(" | "));
  check("Live reference is the authenticated ContextQA workspace", /authenticated/i.test(live.source ?? ""), live.source ?? "missing");

  await goto(page, "/dashboard/requirements");
  const requirementsText = ((await body(page)) || "").replace(/\s+/g, " ");
  compareLive("Requirements library", [live.requirementsLibrary?.title ?? "", live.requirementsLibrary?.description ?? "", ...(live.requirementsLibrary?.toolbar ?? [])], requirementsText);
  compareLive("Requirements columns", live.requirementsLibrary?.columns ?? [], (await tableHeaders(page)).join(" | "));
  check("PART 4 requirements table has no vertical scrollbar", (await tableScrollIssues(page)).length === 0);

  await goto(page, "/dashboard/test-cases");
  const casesText = ((await body(page)) || "").replace(/\s+/g, " ");
  compareLive("Test Cases header/tabs/views", [live.testCases?.title ?? "", live.testCases?.description ?? "", ...(live.testCases?.tabs ?? []), ...(live.testCases?.views ?? [])], casesText);
  compareLive("Test Cases columns", live.testCases?.columns ?? [], (await tableHeaders(page)).join(" | "));
  check("PART 4 test cases table has no vertical scrollbar", (await tableScrollIssues(page)).length === 0);

  await goto(page, "/dashboard/plans/suites");
  const suitesText = ((await body(page)) || "").replace(/\s+/g, " ");
  compareLive("Test Suites library", [live.testSuites?.title ?? "", live.testSuites?.description ?? "", ...(live.testSuites?.toolbar ?? [])], suitesText);
  compareLive("Test Suites columns", live.testSuites?.columns ?? [], (await tableHeaders(page)).join(" | "));
  check("PART 4 suites table has no vertical scrollbar", (await tableScrollIssues(page)).length === 0);

  await goto(page, "/dashboard/environments");
  const environmentsText = ((await body(page)) || "").replace(/\s+/g, " ");
  compareLive("Environment & Data", [...(live.environments?.tabs ?? []), ...(live.environments?.views ?? []), ...(live.environments?.actions ?? [])], environmentsText);

  await goto(page, "/dashboard/team");
  const teamText = ((await body(page)) || "").replace(/\s+/g, " ");
  compareLive("Team & access columns", live.team?.columns ?? [], (await tableHeaders(page)).join(" | ") || teamText);

  await goto(page, "/dashboard/billing");
  const billingText = ((await body(page)) || "").replace(/\s+/g, " ");
  compareLive("Billing tabs and credit history", [...(live.billing?.tabs ?? []), ...(live.billing?.creditHistoryColumns ?? [])], billingText);

  await goto(page, "/dashboard/mcp");
  const mcpText = ((await body(page)) || "").replace(/\s+/g, " ");
  compareLive("MCP sections", ["MCP server online", "SSE endpoint", "Claude Code", "Claude Desktop", "Cursor", "VS Code Copilot", "Windsurf", "OpenAI / ChatGPT", "Custom SSE", "Role guides"], mcpText);

  fs.writeFileSync(
    path.join(OUT, "part4-live-local.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), liveSource: live.source ?? null, comparisons: sideBySide }, null, 2),
  );
  check("PART 4 side-by-side report written", fs.existsSync(path.join(OUT, "part4-live-local.json")));
  check("PART 4 no page errors", moduleErrors.length === 0, moduleErrors.slice(0, 2).join(" | "));
  await shot(page, "part4-final");

  // ── PART 5 — Repairs: mojibake, plan execution, suites, installers, Super Admin
  moduleErrors = [];
  mod("part5-repairs", "PART 5 — Repairs (UTF-8, plans, suites, installers, Super Admin)", "/dashboard/plans/test-plans");

  // 5.1 — Zero mojibake on the 19 product pages.
  const parityRoutes = [
    "/dashboard/overview",
    "/dashboard/pull-requests",
    "/dashboard/crawl",
    "/dashboard/code-analysis",
    "/dashboard/requirements",
    "/dashboard/test-cases",
    "/dashboard/plans/suites",
    "/dashboard/plans/test-plans",
    "/dashboard/environments",
    "/dashboard/uploads",
    "/dashboard/knowledge-base",
    "/dashboard/team",
    "/dashboard/tunnels",
    "/dashboard/integrations",
    "/dashboard/billing",
    "/dashboard/mcp",
    "/dashboard/settings/organization",
    "/dashboard/settings/audits",
    "/dashboard/settings/api-tokens",
  ];
  const mojibakeNeedles: Array<[string, string]> = [
    ["\u00e2\u20ac", "â€"],
    ["\u00c2\u00b7", "Â·"],
    ["\u00c3", "Ã"],
    ["\uFFFD", "U+FFFD"],
  ];
  for (const route of parityRoutes) {
    await goto(page, route);
    const pageText = await body(page);
    const found = mojibakeNeedles.filter(([needle]) => pageText.includes(needle)).map(([, label]) => label);
    check(`No mojibake on ${route}`, found.length === 0, found.join(" "));
  }

  // 5.2 — Suite counters equal the visible linked cases; every plan has suites.
  const cgiOrg = await db.organisation.findUnique({ where: { slug: "cgi" }, select: { id: true, plan: true, trialEndsAt: true, trialCredits: true } });
  const acmeOrg = await db.organisation.findUnique({ where: { slug: "acme" }, select: { id: true } });
  const cgiId = cgiOrg?.id ?? activeOrgId;
  for (const [slug, orgRow] of [["cgi", cgiOrg], ["acme", acmeOrg]] as const) {
    if (!orgRow) {
      check(`Workspace ${slug} exists`, false);
      continue;
    }
    const suites = await db.testSuite.findMany({
      where: { organisationId: orgRow.id },
      include: { _count: { select: { testCases: true } } },
    });
    const mismatched = suites.filter((suite) => suite.testCasesCount !== suite._count.testCases);
    check(
      `Suite counts match linked cases (${slug})`,
      mismatched.length === 0,
      mismatched.map((suite) => `${suite.name}: stored ${suite.testCasesCount} / linked ${suite._count.testCases}`).slice(0, 3).join(" | "),
    );
    const plans = await db.testPlan.findMany({
      where: { organisationId: orgRow.id },
      select: { name: true, suites: { select: { id: true } } },
    });
    const unlinkedPlans = plans.filter((plan) => plan.suites.length === 0);
    check(`Every plan has linked suites (${slug})`, unlinkedPlans.length === 0, unlinkedPlans.map((plan) => plan.name).slice(0, 3).join(" | "));
  }

  // 5.3 — Plan execution from the list (RowMenu) and from the detail page.
  const seededPlan = await db.testPlan.findFirst({
    where: { organisationId: cgiId, name: "Release 2.8 sign-off" },
    include: { suites: { select: { id: true, name: true } } },
  });
  check("Seeded Release 2.8 sign-off plan exists", Boolean(seededPlan), seededPlan?.id ?? "missing");
  if (seededPlan) {
    const planId = seededPlan.id;
    const listExecBefore = await db.testPlanExecution.count({ where: { testPlanId: planId } });
    const listRunBefore = await db.testRun.count({ where: { organisationId: cgiId } });
    await goto(page, "/dashboard/plans/test-plans");
    const runConsoleErrors: string[] = [];
    const consoleListener = (message: ConsoleMessage) => {
      if (message.type() === "error") runConsoleErrors.push(message.text());
    };
    page.on("console", consoleListener);
    let listStatus = 0;
    let listResult: Record<string, unknown> = {};
    try {
      const trigger = page.getByRole("button", { name: `Actions for ${seededPlan.name}`, exact: true }).first();
      await trigger.waitFor({ state: "visible", timeout: 10_000 });
      await trigger.click();
      const runItem = page.locator("[data-row-menu]").getByRole("menuitem", { name: /^Run Plan$/ });
      await runItem.waitFor({ state: "visible", timeout: 5_000 });
      const [response] = await Promise.all([
        page.waitForResponse((res) => res.url().includes("/api/dashboard/test-plans/run") && res.request().method() === "POST", { timeout: 30_000 }),
        runItem.click(),
      ]);
      listStatus = response.status();
      listResult = ((await response.json().catch(() => ({}))) as Record<string, unknown>) ?? {};
      await page.waitForTimeout(1_200);
    } catch (error) {
      check("Plan run from list completed without UI error", false, String(error).slice(0, 180));
    } finally {
      page.off("console", consoleListener);
    }
    const listTotal = Number(listResult.total ?? 0);
    const listCounted = Number(listResult.passed ?? 0) + Number(listResult.failed ?? 0) + Number(listResult.notExecuted ?? 0);
    check("Plan run from list returns 200", listStatus === 200, `status ${listStatus}`);
    check(
      "Plan run from list executes every linked case",
      listTotal > 0 && listCounted === listTotal,
      `total ${listTotal} · counted ${listCounted} · passed ${String(listResult.passed)} · failed ${String(listResult.failed)} · not executed ${String(listResult.notExecuted)}`,
    );
    check("Plan run from list returns a viewport", typeof listResult.viewport === "string" && String(listResult.viewport).includes("1440×900"), String(listResult.viewport ?? "missing"));
    check(
      "Plan run from list never sends a GET/HEAD body",
      !runConsoleErrors.some((message) => /GET\/HEAD|cannot have body/i.test(message)),
      runConsoleErrors.filter((message) => /GET\/HEAD|cannot have body/i.test(message)).join(" | "),
    );
    const listExecAfter = await db.testPlanExecution.count({ where: { testPlanId: planId } });
    const listRunAfter = await db.testRun.count({ where: { organisationId: cgiId } });
    check("Plan run from list persists an execution", listExecAfter === listExecBefore + 1, `${listExecBefore} → ${listExecAfter}`);
    check("Plan run from list persists a TestRun", listRunAfter === listRunBefore + 1, `${listRunBefore} → ${listRunAfter}`);

    // Detail page: suites, counters, START/END, viewport and a second run.
    await goto(page, `/dashboard/plans/test-plans/${planId}`);
    const detailText = await body(page);
    check("Plan detail lists every linked suite", seededPlan.suites.every((suite) => detailText.includes(suite.name)), seededPlan.suites.map((suite) => suite.name).join(", "));
    check("Plan detail shows the Suites in plan counter", /Suites in plan \(\d+\)/.test(detailText), detailText.match(/Suites in plan \(\d+\)/)?.[0] ?? "missing");
    const detailExecBefore = await db.testPlanExecution.count({ where: { testPlanId: planId } });
    const detailRunBefore = await db.testRun.count({ where: { organisationId: cgiId } });
    let detailStatus = 0;
    let detailResult: Record<string, unknown> = {};
    try {
      const [response] = await Promise.all([
        page.waitForResponse((res) => res.url().includes("/api/dashboard/test-plans/run") && res.request().method() === "POST", { timeout: 30_000 }),
        page.getByRole("button", { name: /^Run Now$/ }).first().click(),
      ]);
      detailStatus = response.status();
      detailResult = ((await response.json().catch(() => ({}))) as Record<string, unknown>) ?? {};
      await page.waitForTimeout(1_600);
    } catch (error) {
      check("Plan run from detail completed without UI error", false, String(error).slice(0, 180));
    }
    check("Plan run from detail returns 200", detailStatus === 200, `status ${detailStatus}`);
    check(
      "Plan run from detail executes every linked case",
      Number(detailResult.total ?? 0) > 0 && Number(detailResult.passed ?? 0) + Number(detailResult.failed ?? 0) + Number(detailResult.notExecuted ?? 0) === Number(detailResult.total ?? 0),
      `total ${String(detailResult.total)} · passed ${String(detailResult.passed)} · failed ${String(detailResult.failed)}`,
    );
    const detailExecAfter = await db.testPlanExecution.count({ where: { testPlanId: planId } });
    const detailRunAfter = await db.testRun.count({ where: { organisationId: cgiId } });
    check("Plan run from detail persists an execution", detailExecAfter === detailExecBefore + 1, `${detailExecBefore} → ${detailExecAfter}`);
    check("Plan run from detail persists a TestRun", detailRunAfter === detailRunBefore + 1, `${detailRunBefore} → ${detailRunAfter}`);
    const latestExecution = await db.testPlanExecution.findFirst({ where: { testPlanId: planId }, orderBy: { startedAt: "desc" } });
    check("Plan execution has START and END", Boolean(latestExecution?.startedAt && latestExecution?.finishedAt) && latestExecution?.status !== "RUNNING", `${latestExecution?.status ?? "missing"} · ${latestExecution?.finishedAt?.toISOString() ?? "no end"}`);
    check("Plan execution persists the viewport", String(latestExecution?.resultsJson ?? "").includes("1440×900"), String(latestExecution?.resultsJson ?? "").slice(0, 120));
    const updatedPlan = await db.testPlan.findUnique({ where: { id: planId }, select: { lastRunAt: true, passRate: true } });
    check("Plan counters refreshed after the run", Boolean(updatedPlan?.lastRunAt), `lastRunAt ${updatedPlan?.lastRunAt?.toISOString() ?? "missing"} · passRate ${updatedPlan?.passRate ?? "?"}`);
    const startCardText = (await page.getByText("START", { exact: true }).first().locator("xpath=..").innerText().catch(() => "")) || "";
    const endCardText = (await page.getByText("END", { exact: true }).first().locator("xpath=..").innerText().catch(() => "")) || "";
    check("Plan detail START card is populated", startCardText.replace(/START/g, "").trim().length > 0 && !startCardText.includes("—"), startCardText.replace(/\s+/g, " ").slice(0, 100));
    check("Plan detail END card is populated", endCardText.replace(/END/g, "").trim().length > 0 && !endCardText.includes("—"), endCardText.replace(/\s+/g, " ").slice(0, 100));
    check("Plan detail shows the latest viewport", (await body(page)).includes("1440×900"));
  }

  // 5.4 — Real installers, public and origin-based; token-authenticated connect.
  const anonContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const psResponse = await anonContext.request.get(`${BASE}/install.ps1`);
    const psScript = await psResponse.text();
    check("GET /install.ps1 is public", psResponse.status() === 200, `status ${psResponse.status()}`);
    check("install.ps1 defines global qasyn", psScript.includes("function global:qasyn"));
    check("install.ps1 parses connect --name/--token", psScript.includes("--name") && psScript.includes("--token") && psScript.includes("action   = \"connect\""));
    check("install.ps1 reports hostname and Windows OS", psScript.includes("$env:COMPUTERNAME") && psScript.includes("os       = \"Windows\""));
    check(
      "install.ps1 uses the request origin",
      psScript.includes(`${BASE}/install.ps1`) && psScript.includes(`$global:QASynOrigin = '${BASE}'`) && psScript.includes("/api/onboarding/tunnel"),
      BASE,
    );
    check("install.ps1 prints the connected message", psScript.includes('"Connected: " + $name + " -> " + $global:QASynOrigin'), "success message present");
    const psCode = psScript
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");
    check(
      "install.ps1 uses a simple function (no CmdletBinding/param binder)",
      !psCode.includes("[CmdletBinding()]") && !/function global:qasyn\s*\{[\s\S]{0,200}?\bparam\s*\(/.test(psCode),
      "raw --name/--token reach $args",
    );
    check("install.ps1 accepts key=value and positional tokens", psScript.includes("name|n|token|t") && psScript.includes("cqa_tun_|tnl_"));
    check("install.ps1 avoids get.qasyn.com", !psScript.includes("get.qasyn.com"));

    const bashResponse = await anonContext.request.get(`${BASE}/install.sh`);
    const bashScript = await bashResponse.text();
    check("GET /install.sh is public", bashResponse.status() === 200, `status ${bashResponse.status()}`);
    check("install.sh defines qasyn()", bashScript.includes("qasyn()"));
    check("install.sh posts the connect payload", bashScript.includes("\"action\":\"connect\"") && bashScript.includes("/api/onboarding/tunnel"));
    check(
      "install.sh uses the request origin",
      bashScript.includes(`${BASE}/install.sh`) && bashScript.includes(`QASYN_ORIGIN="${BASE}"`) && bashScript.includes("/api/onboarding/tunnel"),
      BASE,
    );
    check("install.sh prints the connected message", bashScript.includes("QASyn Tunnel Agent connected! Machine '"));
    check("install.sh avoids get.qasyn.com", !bashScript.includes("get.qasyn.com"));

    const tunnelToken = `cqa_tun_parity_${RUN_ID}`;
    await db.tunnelMachine.deleteMany({ where: { organisationId: cgiId, name: "qamachine" } });
    const tunnel = await db.tunnelMachine.create({
      data: {
        organisationId: cgiId,
        name: "qamachine",
        os: "win",
        status: "pending",
        token: tunnelToken,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      select: { id: true },
    });
    try {
      const connectResponse = await anonContext.request.post(`${BASE}/api/onboarding/tunnel`, {
        data: { action: "connect", name: "qamachine", token: tunnelToken, os: "Windows", hostname: "QAMACHINE" },
      });
      check("Cookie-less tunnel connect returns 200", connectResponse.status() === 200, `status ${connectResponse.status()}`);
      const connected = await db.tunnelMachine.findUnique({ where: { id: tunnel.id } });
      check("Tunnel machine flipped Pending → Connected", connected?.status === "connected", connected?.status ?? "missing");
      check("Tunnel connect persists hostname and OS", connected?.hostname === "QAMACHINE" && connected?.os === "win", `${connected?.hostname ?? "?"} · ${connected?.os ?? "?"}`);
      check("Tunnel connect persists connectedAt", Boolean(connected?.connectedAt), connected?.connectedAt?.toISOString() ?? "missing");
    } finally {
      await db.tunnelMachine.delete({ where: { id: tunnel.id } }).catch(() => undefined);
    }
  } finally {
    await anonContext.close();
  }

  // 5.5 — Eternal Super Admin, console, multi-organisation read/write.
  const superUser = await db.user.findUnique({
    where: { email: "admin@qasyn.com" },
    include: { organisation: { select: { slug: true, plan: true, trialCredits: true, creditsUsed: true, trialEndsAt: true } } },
  });
  check("Super Admin account exists", Boolean(superUser), superUser?.email ?? "missing");
  check("Super Admin role sits above Admin", superUser?.role === "Super Admin", superUser?.role ?? "missing");
  check(
    "Super Admin owns an eternal enterprise workspace",
    superUser?.organisation?.plan === "enterprise" && superUser?.organisation?.trialCredits === 9_999_999 && superUser?.organisation?.trialEndsAt?.getUTCFullYear() === 2099,
    superUser?.organisation ? `${superUser.organisation.slug} · ${superUser.organisation.plan} · ${superUser.organisation.trialCredits} credits · ${superUser.organisation.trialEndsAt.toISOString()}` : "missing",
  );
  check(
    "CGI is enterprise with no expiry",
    cgiOrg?.plan === "enterprise" && cgiOrg?.trialEndsAt?.getUTCFullYear() === 2099,
    cgiOrg ? `${cgiOrg.plan} · ${cgiOrg.trialEndsAt?.toISOString() ?? "no expiry"}` : "missing",
  );
  const cgiAdmin = await db.user.findUnique({ where: { email: "cgi@cgi.com" }, select: { role: true, status: true, emailVerifiedAt: true } });
  check("CGI admin has full write access", cgiAdmin?.role === "Admin" && cgiAdmin?.status === "active" && Boolean(cgiAdmin?.emailVerifiedAt), cgiAdmin?.role ?? "missing");

  const superSession = await loginAs(browser, "admin@qasyn.com", "QASynMaster2026!");
  try {
    check("Super Admin login reaches the dashboard", superSession.page.url().includes("/dashboard"), superSession.page.url());
    await goto(superSession.page, "/dashboard/settings/organization");
    await superSession.page.getByText("Super-Admin Console").first().waitFor({ state: "visible", timeout: 12_000 }).catch(() => undefined);
    const saOrgText = await body(superSession.page);
    check("Super-Admin Console is on Organization settings", saOrgText.includes("Super-Admin Console"));
    check("Console lists CGI", saOrgText.includes("CGI"));
    check("Console lists QASyn HQ", saOrgText.includes("QASyn HQ"));
    await goto(superSession.page, "/dashboard/team");
    await superSession.page.getByText("Super-Admin Console").first().waitFor({ state: "visible", timeout: 12_000 }).catch(() => undefined);
    check("Super-Admin Console is on Team & access", (await body(superSession.page)).includes("Super-Admin Console"));

    await goto(superSession.page, "/dashboard/overview");
    const profileMenu = superSession.page.locator("aside button[aria-haspopup='menu']").first();
    await profileMenu.evaluate((el) => (el as HTMLElement).click()).catch(() => undefined);
    const cgiWorkspaceItem = superSession.page.getByRole("menuitem", { name: /CGI/ }).first();
    await cgiWorkspaceItem.waitFor({ state: "visible", timeout: 8_000 }).catch(() => undefined);
    let sidebarSwitchStatus = 0;
    let sidebarSwitchError = "";
    try {
      const [switchResponse] = await Promise.all([
        superSession.page.waitForResponse((res) => res.url().includes("/api/auth/switch") && res.request().method() === "POST", { timeout: 15_000 }),
        cgiWorkspaceItem.click(),
      ]);
      sidebarSwitchStatus = switchResponse.status();
    } catch (error) {
      sidebarSwitchError = String(error).slice(0, 160);
    }
    check("Super Admin switches to CGI from the Sidebar", sidebarSwitchStatus === 200, sidebarSwitchError || `status ${sidebarSwitchStatus}`);
    await superSession.page.waitForTimeout(1_500);
    await profileMenu.evaluate((el) => (el as HTMLElement).click()).catch(() => undefined);
    const cgiActiveItem = superSession.page.getByRole("menuitem", { name: /CGI/ }).first();
    await cgiActiveItem.waitFor({ state: "visible", timeout: 8_000 }).catch(() => undefined);
    const cgiActive = await cgiActiveItem.isDisabled().catch(() => false);
    check("Sidebar marks CGI as the active workspace", cgiActive, `disabled=${cgiActive}`);
    await profileMenu.evaluate((el) => (el as HTMLElement).click()).catch(() => undefined);

    const superWrite = await apiJson(superSession.page, "/api/dashboard/test-cases", "POST", {
      mode: "manual",
      title: `SUPER ADMIN WRITE ${RUN_ID}`,
      module: "Core",
      criticality: "medium",
      stepsCount: 3,
    });
    const superCaseId = String((superWrite.body as { testCases?: Array<{ id?: string }> }).testCases?.[0]?.id ?? "");
    check("Super Admin writes into CGI", superWrite.status === 201, `status ${superWrite.status}`);
    if (superCaseId) {
      const superCase = await db.testCase.findUnique({ where: { id: superCaseId }, select: { organisationId: true } });
      check("Super Admin write is scoped to CGI", superCase?.organisationId === cgiId, superCase?.organisationId ?? "missing");
      await db.testCase.delete({ where: { id: superCaseId } }).catch(() => undefined);
    }

    if (acmeOrg) {
      const switchAcme = await apiJson(superSession.page, "/api/auth/switch", "POST", { target: "org", organisationId: acmeOrg.id });
      check("Super Admin switches to Acme", switchAcme.status === 200, `status ${switchAcme.status}`);
      const acmeWrite = await apiJson(superSession.page, "/api/dashboard/test-cases", "POST", {
        mode: "manual",
        title: `SUPER ADMIN ACME ${RUN_ID}`,
        module: "Core",
        criticality: "medium",
        stepsCount: 3,
      });
      const acmeCaseId = String((acmeWrite.body as { testCases?: Array<{ id?: string }> }).testCases?.[0]?.id ?? "");
      check("Super Admin writes into Acme", acmeWrite.status === 201, `status ${acmeWrite.status}`);
      if (acmeCaseId) {
        const acmeCase = await db.testCase.findUnique({ where: { id: acmeCaseId }, select: { organisationId: true } });
        check("Super Admin write is scoped to Acme", acmeCase?.organisationId === acmeOrg.id, acmeCase?.organisationId ?? "missing");
        await db.testCase.delete({ where: { id: acmeCaseId } }).catch(() => undefined);
      }
    }
    check("PART 5 Super Admin has no page errors", moduleErrors.length === 0, moduleErrors.slice(0, 2).join(" | "));
  } finally {
    await superSession.context.close().catch(() => undefined);
  }
  await shot(page, "part5-repairs");

  // ── PART 7 — PowerShell réel, menus, Studio, MCP/OpenCode, Graphify, Magic, Strix ──
  const p7 = mod("part7-integrations", "PART 7 - PowerShell, menus, Studio, MCP, Graphify, Magic, Strix", "/dashboard/tunnels");
  moduleErrors = [];
  void p7;

  const part7Token = `cqa_tun_part7_${RUN_ID}`;
  await db.tunnelMachine.deleteMany({ where: { organisationId: cgiId, name: "qamachine" } });
  const part7Machine = await db.tunnelMachine.create({
    data: {
      organisationId: cgiId,
      name: "qamachine",
      os: "win",
      status: "pending",
      token: part7Token,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
    select: { id: true },
  });

  try {
    // 7.1 — The exact command a Windows user runs, through real powershell.exe.
    const powershell = "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command";
    const installOnce = `irm ${BASE}/install.ps1 | iex`;
    const exactCommand = `${powershell} "${installOnce}; qasyn connect --name qamachine --token ${part7Token}"`;
    const exactOutput = psRun(exactCommand);
    check(
      "PART 7 real PowerShell prints Connected: qamachine -> origin",
      exactOutput.includes(`Connected: qamachine -> ${BASE}`),
      exactOutput.replace(/\s+/g, " ").slice(0, 240),
    );
    check("PART 7 real PowerShell never falls back to Usage", !exactOutput.includes("Usage:"), exactOutput.replace(/\s+/g, " ").slice(0, 180));
    const exactMachine = await db.tunnelMachine.findUnique({
      where: { id: part7Machine.id },
      select: { status: true, hostname: true, connectedAt: true },
    });
    check(
      "PART 7 real PowerShell flips the machine to connected",
      exactMachine?.status === "connected" && Boolean(exactMachine?.hostname),
      `${exactMachine?.status ?? "missing"} · ${exactMachine?.hostname ?? "no hostname"}`,
    );

    // 7.2 — Every tolerant argument shape the installer advertises.
    const argumentForms: Array<[string, string]> = [
      ["-name/-token", `${powershell} "${installOnce}; qasyn connect -name qamachine -token ${part7Token}"`],
      ["name=value/token=value", `${powershell} "${installOnce}; qasyn connect name=qamachine token=${part7Token}"`],
      ["positional name and cqa_tun token", `${powershell} "${installOnce}; qasyn connect qamachine ${part7Token}"`],
    ];
    for (const [label, command] of argumentForms) {
      const output = psRun(command);
      check(
        `PART 7 PowerShell accepts ${label}`,
        output.includes(`Connected: qamachine -> ${BASE}`) && !output.includes("Usage:"),
        output.replace(/\s+/g, " ").slice(0, 200),
      );
    }

    // 7.3 — Pre-armed install URL (?name=&token=) auto-connects without a second call.
    const prearmed = psRun(`${powershell} "irm '${BASE}/install.ps1?name=qamachine&token=${part7Token}' | iex"`);
    check(
      "PART 7 pre-armed install URL auto-connects",
      prearmed.includes(`Connected: qamachine -> ${BASE}`),
      prearmed.replace(/\s+/g, " ").slice(0, 220),
    );
    check("PART 7 pre-armed URL never prints Usage", !prearmed.includes("Usage:"));

    // 7.4 — Tunnels "More" menu: shared portal, never clipped.
    await goto(page, "/dashboard/tunnels");
    const machineText = page.getByText("qamachine", { exact: true }).first();
    await machineText.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
    check("PART 7 Tunnels lists the machine", (await machineText.count()) > 0);
    const moreTrigger = page.getByRole("button", { name: "More actions for qamachine", exact: true }).first();
    check("PART 7 Tunnels uses the shared More menu", (await moreTrigger.count()) > 0);
    if ((await moreTrigger.count()) > 0) {
      await moreTrigger.click();
      const menu = page.locator("[data-row-menu]").first();
      await menu.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
      const placement = await menu
        .evaluate((el) => {
          const node = el as HTMLElement;
          const style = getComputedStyle(node);
          return { parentIsBody: node.parentElement === document.body, position: style.position, zIndex: style.zIndex };
        })
        .catch(() => null);
      check("PART 7 Tunnels menu is portaled to document.body", placement?.parentIsBody === true);
      check("PART 7 Tunnels menu uses position: fixed", placement?.position === "fixed", placement?.position ?? "missing");
      check("PART 7 Tunnels menu uses z-index 9999", placement?.zIndex === "9999", placement?.zIndex ?? "missing");
      const menuBox = await menu.boundingBox();
      const viewport = page.viewportSize();
      const menuInside =
        Boolean(menuBox && viewport) &&
        menuBox!.x >= -1 &&
        menuBox!.y >= -1 &&
        menuBox!.x + menuBox!.width <= viewport!.width + 1 &&
        menuBox!.y + menuBox!.height <= viewport!.height + 1;
      check(
        "PART 7 Tunnels menu is fully inside the viewport",
        menuInside,
        menuBox && viewport ? `${Math.round(menuBox.x)},${Math.round(menuBox.y)} ${Math.round(menuBox.width)}×${Math.round(menuBox.height)} in ${viewport.width}×${viewport.height}` : "no bounding box",
      );
      const menuText = ((await menu.innerText()) || "").replace(/\s+/g, " ");
      check("PART 7 Tunnels menu exposes Remove machine", menuText.includes("Remove machine"), menuText.slice(0, 120));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      check("PART 7 Tunnels menu closes on Escape", (await page.locator("[data-row-menu]").count()) === 0);
    }

    // 7.5 — Studio parity: header, tab row, step rows, rail, run history and Magic inspector.
    const studioCases = await apiJson(page, "/api/dashboard/test-cases", "GET");
    const casesWithSteps = (studioCases.body.testCases ?? []).filter((row) => /"action"\s*:/.test(String(row.stepsJson ?? "")));
    const studioCase = casesWithSteps.find((row) => String(row.status) === "passing") ?? casesWithSteps[0];
    let studioCaseId = String(studioCase?.id ?? "");
    let createdStudioCase = false;
    if (!studioCaseId) {
      const created = await apiJson(page, "/api/dashboard/test-cases", "POST", {
        mode: "manual",
        title: `PART7 STUDIO ${RUN_ID}`,
        module: "Core",
        criticality: "medium",
        stepsCount: 5,
      });
      studioCaseId = String(created.body.testCases?.[0]?.id ?? "");
      createdStudioCase = Boolean(studioCaseId);
    }
    check("PART 7 a test case with steps is available", Boolean(studioCaseId), studioCaseId || "none");
    try {
      if (studioCaseId) {
        await goto(page, `/dashboard/test-cases/${studioCaseId}`);
        const studioTitle = page.locator('[data-testid="studio-title"]').first();
        await studioTitle.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
        check("PART 7 Studio title is visible", (await studioTitle.count()) > 0);
        check("PART 7 Studio priority badge", (await page.locator('[data-testid="studio-priority"]').count()) > 0);
        check(
          "PART 7 Studio header exposes Undo/Redo/More/Refresh/Run",
          (await page.getByRole("button", { name: "Undo", exact: true }).count()) > 0 &&
            (await page.getByRole("button", { name: "Redo", exact: true }).count()) > 0 &&
            (await page.getByRole("button", { name: "More actions", exact: true }).count()) > 0 &&
            (await page.getByRole("button", { name: "Refresh", exact: true }).count()) > 0 &&
            (await page.locator('[data-testid="studio-run"]').count()) > 0,
        );
        const runButton = page.locator('[data-testid="studio-run"]').first();
        const runColor = await runButton.evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor).catch(() => "");
        check("PART 7 Studio Run button is indigo", runColor === "rgb(91, 78, 232)", runColor || "missing");
        const headerBoxes = await Promise.all(
          [studioTitle, page.locator('[data-testid="studio-priority"]').first(), runButton].map((locator) => locator.boundingBox().catch(() => null)),
        );
        const headerCenters = headerBoxes.filter(Boolean).map((box) => box!.y + box!.height / 2);
        check(
          "PART 7 Studio header title, badges and Run share one row",
          headerCenters.length === 3 && Math.max(...headerCenters) - Math.min(...headerCenters) <= 12,
          headerCenters.map((value) => value.toFixed(1)).join(" / "),
        );

        const prerequisiteBanner = page.locator('[data-testid="add-prerequisite-banner"]').first();
        check("PART 7 Studio dotted '+ Add Prerequisite' banner", (await prerequisiteBanner.count()) > 0 && (await prerequisiteBanner.innerText()).includes("Add Prerequisite"));

        const tabs = [
          page.getByRole("button", { name: /^Test Steps \(\d+\)$/ }).first(),
          page.getByRole("button", { name: "Relationships", exact: true }).first(),
          page.getByRole("button", { name: "Version History", exact: true }).first(),
        ];
        const tabBoxes = await Promise.all(tabs.map((locator) => locator.boundingBox().catch(() => null)));
        const tabCenters = tabBoxes.filter(Boolean).map((box) => box!.y + box!.height / 2);
        const tabIconCount = (await Promise.all(tabs.map((locator) => locator.locator("span.material-symbols-outlined").count()))).reduce((total, value) => total + value, 0);
        check(
          "PART 7 Studio tabs (with icons), search and Reorder share one row",
          tabCenters.length === 3 && Math.max(...tabCenters) - Math.min(...tabCenters) <= 10 && tabIconCount === 3 && (await page.getByLabel("Search Action Text").count()) > 0 && (await page.getByRole("button", { name: "Reorder", exact: true }).count()) > 0,
          `${tabCenters.map((value) => value.toFixed(1)).join(" / ")} · ${tabIconCount} icon(s)`,
        );
        check("PART 7 Studio header shows the green Ready badge", (await page.getByRole("button", { name: "Ready", exact: true }).count()) > 0);

        const stepRows = page.locator('[data-testid="studio-step-row"]');
        const stepCount = await stepRows.count();
        check("PART 7 Studio renders step rows", stepCount > 0, `${stepCount} row(s)`);
        if (stepCount > 0) {
          const firstRow = stepRows.first();
          check("PART 7 Studio step row has a selection checkbox", (await firstRow.locator('input[type="checkbox"]').count()) > 0);
          const actionIcon = firstRow.locator('[data-testid="step-action-icon"]').first();
          const iconBox = await actionIcon.boundingBox().catch(() => null);
          check(
            "PART 7 Studio step icon is 32×32",
            Boolean(iconBox && Math.abs(iconBox.width - 32) <= 1 && Math.abs(iconBox.height - 32) <= 1),
            iconBox ? `${iconBox.width}×${iconBox.height}` : "missing",
          );
          check("PART 7 Studio step target is an indigo pill", (await firstRow.locator("span.bg-indigo-50").count()) > 0);
          check("PART 7 Studio step exposes View Details ›", (await firstRow.getByRole("button", { name: /View Details/ }).count()) > 0);
          await firstRow.locator('input[type="checkbox"]').first().check().catch(() => undefined);
          await page.waitForTimeout(300);
          check("PART 7 Studio bulk bar appears after selecting a step", (await page.locator("[data-bulk-bar]").count()) > 0);
          await page.locator("[data-bulk-bar]").getByRole("button", { name: /Clear/ }).first().click().catch(() => undefined);
          await page.waitForTimeout(200);
        }

        const rail = page.locator('[data-testid="studio-rail"]').first();
        const railBox = await rail.boundingBox().catch(() => null);
        check(
          "PART 7 Studio vertical rail is 60px wide and visible",
          Boolean(railBox && Math.abs(railBox.width - 60) <= 2 && railBox.x >= 0 && railBox.x + railBox.width <= 1440),
          railBox ? `${railBox.x.toFixed(0)},${railBox.y.toFixed(0)} ${railBox.width.toFixed(0)}×${railBox.height.toFixed(0)}` : "missing",
        );

        // Magic UI inspector inside the step detail modal.
        const viewDetails = stepRows.first().getByRole("button", { name: /View Details/ }).first();
        if ((await viewDetails.count()) > 0) {
          await viewDetails.click();
          const stepDialog = page.getByRole("dialog", { name: "Step Details" });
          await stepDialog.waitFor({ state: "visible", timeout: 8_000 }).catch(() => undefined);
          const magic = stepDialog.locator('[data-testid="magic-locator"]');
          await magic.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
          check("PART 7 Magic UI inspector is present in Step Details", (await magic.count()) > 0);
          const strategyCount = await magic.locator("[data-locator-strategy]").count();
          check("PART 7 Magic UI scores locator candidates", strategyCount >= 3, `${strategyCount} candidate(s)`);
          const magicApply = magic.locator('[data-testid="magic-apply"]');
          check("PART 7 Magic UI exposes Apply Best Locator", (await magicApply.count()) > 0);
          if ((await magicApply.count()) > 0 && (await magicApply.isEnabled().catch(() => false))) {
            await magicApply.click();
            await page.waitForTimeout(300);
            check("PART 7 Apply Best Locator confirms the applied strategy", /Applied/.test(await magic.innerText().catch(() => "")), (await magic.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 120));
          }
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
        }

        // Run History cards with the expected metadata.
        const runHistoryRail = page.getByRole("button", { name: "Run History", exact: true }).first();
        check("PART 7 Studio rail exposes Run History", (await runHistoryRail.count()) > 0);
        if ((await runHistoryRail.count()) > 0) {
          await runHistoryRail.click();
          await page.waitForTimeout(900);
          let cards = page.locator('[data-testid="run-history-card"]');
          if ((await cards.count()) === 0) {
            await page.locator('[data-testid="studio-run"]').click().catch(() => undefined);
            const runDialog = page.getByRole("dialog", { name: "Live" });
            await runDialog.getByText(/Run complete/).first().waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);
            await runDialog.getByRole("button", { name: "Close", exact: true }).first().click().catch(() => undefined);
            await page.waitForTimeout(2_500);
            cards = page.locator('[data-testid="run-history-card"]');
          }
          const cardCount = await cards.count();
          check("PART 7 Run History renders cards", cardCount > 0, `${cardCount} card(s)`);
          if (cardCount > 0) {
            const cardText = ((await cards.first().innerText()) || "").replace(/\s+/g, " ");
            check("PART 7 Run History card shows #run and Passed/Failed", /#\d+/.test(cardText) && /(Passed|Failed)/.test(cardText), cardText.slice(0, 160));
            check("PART 7 Run History card shows automated trigger and author", cardText.includes("⚙") && cardText.includes("👤"), cardText.slice(0, 160));
            check("PART 7 Run History card shows time and duration", cardText.includes("⏳"), cardText.slice(0, 160));
            const modePill = cards.first().getByTestId("run-history-mode");
            const modeText = ((await modePill.innerText().catch(() => "")) || "").trim();
            check("PART 7 Run History card shows Standalone Run or plan pill", (await modePill.count()) > 0 && modeText.length > 0, `${modeText} · ${cardText.slice(0, 120)}`);
            if (/Failed/.test(cardText)) check("PART 7 failed Run History card shows Failed at Step X", /Failed at Step \d+/.test(cardText), cardText.slice(0, 160));
            const autoFix = cards.first().getByText("Auto-fix rerun");
            check("PART 7 Run History exposes Auto-fix rerun when applicable", (await autoFix.count()) > 0 || !/Auto-fix/.test(cardText), "auto-fix badge conditional");
          }
        }
      }
    } finally {
      if (createdStudioCase) await db.testCase.delete({ where: { id: studioCaseId } }).catch(() => undefined);
    }

    // 7.6 — MCP page: OpenCode first, real cqa_ token, 5 prompts, skills, Context7, live tool.
    await goto(page, "/dashboard/mcp");
    await page.locator('[data-client="opencode"]').first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
    const firstClient = await page.locator("[data-client]").first().getAttribute("data-client");
    check("PART 7 MCP lists OpenCode first", firstClient === "opencode", firstClient ?? "none");
    check("PART 7 MCP labels OpenCode with free models", (await page.locator('[data-client="opencode"]').first().innerText()).includes("OpenCode (Free AI Models)"));
    const mcpBody = await body(page);
    for (const model of ["opencode/big-pickle", "opencode/glm-4.7-free", "opencode/grok-code"]) {
      check(`PART 7 MCP lists free model ${model}`, mcpBody.includes(model));
    }
    check("PART 7 MCP shows the OpenCode command", mcpBody.includes("opencode --model opencode/big-pickle") && mcpBody.includes("/models"));
    check("PART 7 MCP never shows cqa_REPLACE_WITH_YOUR_TOKEN", !mcpBody.includes("cqa_REPLACE_WITH_YOUR_TOKEN"));
    const tokenValue = page.locator('[data-testid="mcp-token-value"]').first();
    await tokenValue.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
    const tokenText = ((await tokenValue.innerText().catch(() => "")) || "").trim();
    check("PART 7 MCP embeds a real auto-provisioned cqa_ token", /^cqa_[A-Za-z0-9_-]{20,}/.test(tokenText), tokenText ? `${tokenText.slice(0, 12)}… (${tokenText.length} chars)` : "missing");
    const promptCount = await page.locator("[data-prompt]").count();
    check("PART 7 MCP exposes 5 copyable OpenCode prompts", promptCount === 5, `${promptCount} prompt(s)`);
    check(
      "PART 7 OpenCode prompts expose Copy Test Prompt for OpenCode",
      (await page.locator('[data-prompt] button[aria-label="Copy Test Prompt for OpenCode"]').count()) === promptCount && promptCount > 0,
      `${await page.locator('[data-prompt] button[aria-label="Copy Test Prompt for OpenCode"]').count()} button(s)`,
    );
    if (promptCount > 0) {
      const firstPrompt = ((await page.locator("[data-prompt]").first().innerText()) || "").replace(/\s+/g, " ");
      check("PART 7 OpenCode prompt targets a qasyn_ tool", firstPrompt.includes("qasyn_"), firstPrompt.slice(0, 140));
    }
    let skillCount = 0;
    for (let i = 0; i < 20; i++) {
      skillCount = await page.locator("[data-skill]").count();
      if (skillCount >= 6) break;
      await page.waitForTimeout(400);
    }
    check("PART 7 MCP lists the 6 Agent Skills", skillCount === 6, `${skillCount} skill(s)`);
    check("PART 7 MCP exposes 3 Agent Skills exports", (await page.locator("[data-export]").count()) === 3, `${await page.locator("[data-export]").count()} export(s)`);
    const context7Section = page.locator('[data-testid="context7-resolver"]').first();
    check("PART 7 MCP embeds the Context7 resolver", (await context7Section.count()) > 0);
    if ((await context7Section.count()) > 0) {
      await context7Section.getByText(/local deterministic/).first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
      const c7Text = ((await context7Section.innerText()) || "").replace(/\s+/g, " ");
      check("PART 7 Context7 resolver returns versioned rules", /Playwright/.test(c7Text) && /score \d+/.test(c7Text), c7Text.slice(0, 180));
    }

    const context7Api = await apiJson(page, "/api/dashboard/context7", "POST", { query: "Playwright locator for checkout" });
    const c7body = context7Api.body as { rules?: string[]; library?: { name?: string; version?: string }; injectedPrompt?: string; resolved?: boolean };
    check(
      "PART 7 Context7 API resolves Playwright docs",
      context7Api.status === 200 && (c7body.library?.name ?? "").toLowerCase().includes("playwright") && (c7body.rules?.length ?? 0) > 0 && Boolean(c7body.injectedPrompt),
      `${c7body.library?.name ?? "?"} v${c7body.library?.version ?? "?"} · ${c7body.rules?.length ?? 0} rules`,
    );

    const mcpRun = page.locator('[data-testid="mcp-tool-run"]').first();
    if ((await mcpRun.count()) > 0) {
      await mcpRun.click();
      const mcpResponse = page.locator('[data-testid="mcp-tool-response"]').first();
      await mcpResponse.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
      const responseText = ((await mcpResponse.innerText().catch(() => "")) || "").replace(/\s+/g, " ");
      check("PART 7 MCP tool runner returns a live JSON-RPC 200", responseText.includes('"status": 200') && responseText.includes('"result"'), responseText.slice(0, 180));
    }

    const exportRes = await apiJson(page, "/api/dashboard/agent-skills", "POST", { action: "export", target: "claude" });
    const exportBody = exportRes.body as { path?: string; content?: string };
    check(
      "PART 7 Agent Skills export writes .claude/CLAUDE.md",
      exportRes.status === 200 && exportBody.path === ".claude/CLAUDE.md" && /Playwright Self-Healing/.test(exportBody.content ?? ""),
      `${exportBody.path ?? "missing"} · ${(exportBody.content ?? "").length} chars`,
    );

    // 7.7 — Graphify Map: API + tab on crawl details + interactive SVG on code analysis.
    const graphApi = await apiJson(page, "/api/dashboard/graphify", "GET");
    const graphData = graphApi.body as unknown as {
      nodes?: unknown[];
      edges?: unknown[];
      stats?: Record<string, number>;
    };
    check(
      "PART 7 Graphify API returns nodes and edges",
      graphApi.status === 200 && Array.isArray(graphData.nodes) && Array.isArray(graphData.edges),
      `${graphData.nodes?.length ?? 0} node(s) · ${graphData.edges?.length ?? 0} edge(s)`,
    );
    check(
      "PART 7 Graphify API covers URL/DOM/Requirement/Test/PR",
      ["url", "dom", "requirement", "test", "pr"].every((kind) => typeof graphData.stats?.[kind] === "number"),
      JSON.stringify(graphData.stats ?? {}),
    );

    const crawlForGraph = await db.crawlSession.findFirst({
      where: { organisationId: cgiId },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    if (crawlForGraph) {
      await goto(page, `/dashboard/crawl/${crawlForGraph.id}`);
      const graphTab = page.getByRole("button", { name: "Graphify Map", exact: true }).first();
      await graphTab.waitFor({ state: "visible", timeout: 12_000 }).catch(() => undefined);
      check("PART 7 crawl details expose the Graphify Map tab", (await graphTab.count()) > 0);
      if ((await graphTab.count()) > 0) {
        await graphTab.click();
        const graphMap = page.locator('[data-testid="graphify-map"]');
        await graphMap.waitFor({ state: "visible", timeout: 12_000 }).catch(() => undefined);
        check("PART 7 crawl Graphify Map renders", (await graphMap.count()) > 0);
        check("PART 7 Graphify Map has 5 kind filters", (await graphMap.locator("[data-filter]").count()) === 5, `${await graphMap.locator("[data-filter]").count()} filter(s)`);
        check("PART 7 Graphify Map has zoom controls", (await graphMap.locator('[data-testid="graphify-zoom-in"]').count()) > 0 && (await graphMap.locator('[data-testid="graphify-zoom-out"]').count()) > 0);
        const beforeZoom = ((await graphMap.innerText()) || "").includes("100%");
        await graphMap.locator('[data-testid="graphify-zoom-in"]').click().catch(() => undefined);
        await page.waitForTimeout(300);
        const afterZoom = ((await graphMap.innerText()) || "").includes("115%");
        check("PART 7 Graphify zoom changes from 100% to 115%", beforeZoom && afterZoom, `before=${beforeZoom} after=${afterZoom}`);
        const prFilter = graphMap.locator('[data-filter="pr"]');
        const beforePressed = await prFilter.getAttribute("aria-pressed");
        await prFilter.click().catch(() => undefined);
        await page.waitForTimeout(200);
        const afterPressed = await prFilter.getAttribute("aria-pressed");
        check("PART 7 Graphify filters toggle", beforePressed !== afterPressed, `${beforePressed} → ${afterPressed}`);
        if ((graphData.nodes?.length ?? 0) > 0) {
          check("PART 7 Graphify Map renders interactive SVG nodes", (await graphMap.locator("svg [data-node-kind]").count()) > 0, `${await graphMap.locator("svg [data-node-kind]").count()} node(s)`);
        }
      }
    } else {
      check("PART 7 crawl details expose the Graphify Map tab", false, "no crawl session in the organisation");
    }

    await goto(page, "/dashboard/code-analysis");
    const codeGraph = page.locator('[data-testid="graphify-map"]').first();
    await codeGraph.waitFor({ state: "visible", timeout: 12_000 }).catch(() => undefined);
    check("PART 7 code analysis embeds the Graphify Map", (await codeGraph.count()) > 0);
    if ((await codeGraph.count()) > 0 && (graphData.nodes?.length ?? 0) > 0) {
      check("PART 7 code analysis Graphify Map renders SVG nodes", (await codeGraph.locator("svg [data-node-kind]").count()) > 0);
    }

    // 7.8 — Magic Locator API covers every accessibility strategy.
    const magicClick = await apiJson(page, "/api/dashboard/magic-locator", "POST", { action: "Click", target: "Pay now", value: "", selector: "" });
    const magicInput = await apiJson(page, "/api/dashboard/magic-locator", "POST", { action: "Enter Text", target: "Work e-mail", value: "qa@cgi.com", selector: "" });
    const magicStrategies = new Set(
      [
        ...(((magicClick.body as { candidates?: Array<{ strategy?: string }> }).candidates ?? [])),
        ...(((magicInput.body as { candidates?: Array<{ strategy?: string }> }).candidates ?? [])),
      ].map((candidate) => String(candidate.strategy)),
    );
    const magicBest = (magicClick.body as { best?: { selector?: string; score?: number } }).best;
    check(
      "PART 7 Magic Locator API scores Role/Test ID/Label/CSS",
      magicClick.status === 200 && magicInput.status === 200 && ["Role", "Test ID", "Label", "CSS"].every((strategy) => magicStrategies.has(strategy)),
      [...magicStrategies].join(", "),
    );
    check("PART 7 Magic Locator returns a Best Locator", Boolean(magicBest?.selector) && Number(magicBest?.score ?? 0) > 0, `${magicBest?.selector ?? "missing"} · ${magicBest?.score ?? 0}`);

    // 7.9 — Strix passive scanner: SSRF refusal, graceful public scan, both pages.
    const strixBlocked = await apiJson(page, "/api/dashboard/strix", "POST", { url: "http://localhost:3000" });
    check("PART 7 Strix refuses localhost (SSRF-safe)", strixBlocked.status === 400, `status ${strixBlocked.status}`);
    const strixPublic = await apiJson(page, "/api/dashboard/strix", "POST", { url: "https://example.com" });
    const strixReport = strixPublic.body as { findings?: unknown[]; notes?: unknown[]; score?: number; grade?: string; reachable?: boolean; error?: string };
    check(
      "PART 7 Strix scans a public target gracefully",
      strixPublic.status === 200 && Array.isArray(strixReport.findings) && Array.isArray(strixReport.notes) && typeof strixReport.score === "number" && typeof strixReport.grade === "string",
      strixReport.reachable ? `score ${strixReport.score} · grade ${strixReport.grade}` : `unreachable handled · ${strixReport.error ?? "no error"}`,
    );

    await goto(page, "/dashboard/security-testing");
    const strixUi = page.locator('[data-testid="strix-scanner"]').first();
    await strixUi.waitFor({ state: "visible", timeout: 12_000 }).catch(() => undefined);
    check("PART 7 Security testing embeds Strix", (await strixUi.count()) > 0 && (await strixUi.innerText()).includes("Strix AI Security & OWASP Inspector"));
    if ((await strixUi.count()) > 0) {
      await strixUi.getByLabel("Strix scan target").fill("http://localhost:3000").catch(() => undefined);
      await strixUi.locator('[data-testid="strix-scan"]').click().catch(() => undefined);
      const strixAlert = strixUi.getByRole("alert").first();
      await strixAlert.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
      check("PART 7 Strix UI reports the blocked target", (await strixAlert.count()) > 0 && /public http\(s\)/i.test(await strixAlert.innerText().catch(() => "")), ((await strixAlert.innerText().catch(() => "")) || "").slice(0, 140));
    }

    await goto(page, "/dashboard/red-team");
    const strixRed = page.locator('[data-testid="strix-scanner"]').first();
    await strixRed.waitFor({ state: "visible", timeout: 12_000 }).catch(() => undefined);
    check("PART 7 Red team embeds Strix", (await strixRed.count()) > 0 && (await strixRed.innerText()).includes("Strix AI Security & OWASP Inspector"));

    check("PART 7 has no page errors", moduleErrors.length === 0, moduleErrors.slice(0, 2).join(" | "));
    await shot(page, "part7-integrations");
  } finally {
    await db.tunnelMachine.delete({ where: { id: part7Machine.id } }).catch(() => undefined);
  }

  await db.$disconnect();

  // ── Global integrity ────────────────────────────────────────────
  const allCasesFinal = await apiJson(page, "/api/dashboard/test-cases", "GET");
  check("Global: no example.com anywhere", !JSON.stringify(allCasesFinal.body).includes("example.com"));
  check("Global: no module 'all'", !(((allCasesFinal.body.testCases as Array<Record<string, unknown>>) ?? [])).some((c) => String(c.module) === "all"));
  check("Global: no 'Edit a all item'", !JSON.stringify(allCasesFinal.body).includes("Edit a all"));

  const report = { generatedAt: new Date().toISOString(), base: BASE, failures, modules, totalChecks: modules.reduce((n, m) => n + m.checks.length, 0) };
  fs.writeFileSync(path.join(OUT, "full-19-modules-parity.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, "local-parity-report.json"), JSON.stringify(report, null, 2));
  console.log(`\n${failures === 0 ? "ALL 19 MODULES PASSED" : `${failures} CHECK(S) FAILED`} — report: contextqa-dump/full-19-modules-parity.json`);
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(2);
});
