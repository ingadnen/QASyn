/**
 * Graphify Map — a single connected view of the quality graph.
 *
 * Crawled URLs, DOM components discovered in test steps, Requirements,
 * Test Cases and Pull Requests are projected into a deterministic layered
 * graph so the UI can render (and filter/zoom) an interactive SVG.
 */
import { prisma } from "./db";

export type GraphifyKind = "url" | "dom" | "requirement" | "test" | "pr";

export interface GraphifyNode {
  id: string;
  label: string;
  kind: GraphifyKind;
  detail: string;
  meta: Record<string, string | number>;
}

export interface GraphifyEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
}

export interface GraphifyMap {
  nodes: GraphifyNode[];
  edges: GraphifyEdge[];
  stats: Record<GraphifyKind, number>;
  generatedAt: string;
  focusCrawlId?: string;
}

export interface GraphifyOptions {
  crawlId?: string;
  limit?: number;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    const parsed = JSON.parse(value ?? "");
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function short(value: string, max = 54): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function domKey(action: string, step: { target?: string; selector?: string }): string {
  const raw = (step.selector || step.target || action).toLowerCase();
  return `${action}:${raw}`.replace(/[^a-z0-9:_-]+/g, "-").slice(0, 90);
}

function domComponent(action: string, target: string): string {
  const lower = `${action} ${target}`.toLowerCase();
  if (/link|nav/.test(lower)) return "Link";
  if (/button|submit|click/.test(lower)) return "Button";
  if (/enter|input|field|search|password|email/.test(lower)) return "TextField";
  if (/check|radio|toggle/.test(lower)) return "Checkbox";
  if (/select|dropdown/.test(lower)) return "Select";
  if (/heading|title/.test(lower)) return "Heading";
  if (/image|logo|icon/.test(lower)) return "Image";
  if (/url|navigate|page/.test(lower)) return "Page";
  return "Element";
}

/** Builds the organisation graph. Every query is scoped to one organisation. */
export async function loadGraphifyMap(organisationId: string, options: GraphifyOptions = {}): Promise<GraphifyMap> {
  const take = Math.max(4, Math.min(options.limit ?? 24, 60));
  const [crawls, requirements, testCases, pullRequests] = await Promise.all([
    prisma.crawlSession.findMany({
      where: { organisationId, ...(options.crawlId ? { id: options.crawlId } : {}) },
      orderBy: { startedAt: "desc" },
      take: 8,
      select: { id: true, targetUrl: true, status: true, flowsMapped: true, pagesVisited: true, requirementId: true },
    }),
    prisma.requirement.findMany({
      where: { organisationId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { testCases: { select: { id: true }, take: 20 } },
    }),
    prisma.testCase.findMany({
      where: { organisationId },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, title: true, module: true, status: true, stepsJson: true },
    }),
    prisma.pullRequestCheck.findMany({
      where: { organisationId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, prNumber: true, title: true, status: true, riskLevel: true, impactJson: true },
    }),
  ]);

  const nodes: GraphifyNode[] = [];
  const edges: GraphifyEdge[] = [];
  const stats: Record<GraphifyKind, number> = { url: 0, dom: 0, requirement: 0, test: 0, pr: 0 };

  const addNode = (node: GraphifyNode) => {
    if (nodes.some((existing) => existing.id === node.id)) return;
    nodes.push(node);
    stats[node.kind] += 1;
  };
  const addEdge = (source: string, target: string, relation: string) => {
    if (!nodes.some((node) => node.id === source) || !nodes.some((node) => node.id === target)) return;
    if (edges.some((edge) => edge.source === source && edge.target === target)) return;
    edges.push({ id: `e-${edges.length + 1}`, source, target, relation });
  };

  const testIds = new Set(testCases.map((test) => `test:${test.id}`));
  const requirementIds = new Set(requirements.map((requirement) => `req:${requirement.id}`));

  for (const crawl of crawls) {
    const id = `url:${crawl.id}`;
    addNode({
      id,
      kind: "url",
      label: short(crawl.targetUrl, 46),
      detail: `${crawl.status} · ${crawl.pagesVisited} pages · ${crawl.flowsMapped} flows`,
      meta: { crawlId: crawl.id, flows: crawl.flowsMapped },
    });
    if (crawl.requirementId && requirementIds.has(`req:${crawl.requirementId}`)) {
      addEdge(id, `req:${crawl.requirementId}`, "crawled into");
    }
  }

  for (const requirement of requirements) {
    const id = `req:${requirement.id}`;
    addNode({
      id,
      kind: "requirement",
      label: `${requirement.code} · ${short(requirement.title, 38)}`,
      detail: `${requirement.coverageStatus} · ${requirement.linkedTestsCount} linked tests`,
      meta: { code: requirement.code, coverage: requirement.coverageStatus },
    });
    for (const test of requirement.testCases) {
      if (testIds.has(`test:${test.id}`)) addEdge(id, `test:${test.id}`, "covered by");
    }
  }

  const domByKey = new Map<string, { label: string; component: string; testIds: string[] }>();
  for (const test of testCases) {
    addNode({
      id: `test:${test.id}`,
      kind: "test",
      label: short(test.title, 42),
      detail: `${test.module} · ${test.status}`,
      meta: { module: test.module, status: test.status },
    });
    const steps = parseJson<Array<{ action?: string; target?: string; selector?: string }>>(test.stepsJson, []);
    for (const step of steps.slice(0, 6)) {
      const action = step.action ?? "Element";
      if (action === "Navigate") continue;
      const key = domKey(action, step);
      const component = domComponent(action, step.target ?? "");
      const existing = domByKey.get(key);
      if (existing) {
        if (!existing.testIds.includes(test.id)) existing.testIds.push(test.id);
      } else {
        domByKey.set(key, {
          label: short(step.target || step.selector || action, 40),
          component,
          testIds: [test.id],
        });
      }
    }
  }

  let domIndex = 0;
  for (const [key, value] of domByKey) {
    if (domIndex >= 16) break;
    domIndex += 1;
    const id = `dom:${key.slice(0, 60)}:${domIndex}`;
    addNode({
      id,
      kind: "dom",
      label: value.label,
      detail: `${value.component} · used by ${value.testIds.length} test(s)`,
      meta: { component: value.component, tests: value.testIds.length },
    });
    for (const testId of value.testIds.slice(0, 3)) addEdge(`test:${testId}`, id, "asserts");
  }

  for (const pr of pullRequests) {
    const id = `pr:${pr.id}`;
    addNode({
      id,
      kind: "pr",
      label: `#${pr.prNumber} ${short(pr.title, 38)}`,
      detail: `${pr.status} · risk ${pr.riskLevel}`,
      meta: { prNumber: pr.prNumber, risk: pr.riskLevel },
    });
    const impact = parseJson<{ scopeTestCaseIds?: string[] }>(pr.impactJson, {});
    for (const testId of (impact.scopeTestCaseIds ?? []).slice(0, 6)) {
      if (testIds.has(`test:${testId}`)) addEdge(id, `test:${testId}`, "impacts");
    }
  }

  // A crawl with no requirement still anchors its DOM nodes to the URL so the
  // graph is always connected when tests exist.
  const firstUrl = nodes.find((node) => node.kind === "url");
  if (firstUrl) {
    for (const dom of nodes.filter((node) => node.kind === "dom").slice(0, 6)) {
      addEdge(firstUrl.id, dom.id, "discovers");
    }
  }

  const order: Record<GraphifyKind, number> = { url: 0, requirement: 1, test: 2, dom: 3, pr: 4 };
  nodes.sort((a, b) => order[a.kind] - order[b.kind] || a.label.localeCompare(b.label));

  return {
    nodes,
    edges,
    stats,
    generatedAt: new Date().toISOString(),
    focusCrawlId: options.crawlId,
  };
}
