import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import {
  Overview,
  type OverviewCoverageRow,
  type OverviewEvent,
  type OverviewRecent,
} from "@/components/dashboard/pages/Overview";
import { getOverview, parseCrawlLogs } from "@/lib/dashboard";
import { getBiviaObservatory } from "@/lib/bivia-telemetry";
import { prisma } from "@/lib/db";
import { readSettings, requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const PROVIDER_LABELS: Record<string, string> = {
  JIRA: "Jira",
  SLACK: "Slack",
  GITHUB: "GitHub",
  GITLAB: "GitLab",
  LINEAR: "Linear",
  AZURE_DEVOPS: "Azure DevOps",
  AZURE_VAULT: "Azure Vault",
  FIGMA: "Figma",
  FRESHRELEASE: "Freshrelease",
  YOUTRACK: "YouTrack",
  MANTIS: "Mantis",
  BACKLOG: "Backlog",
  ZEPEL: "Zepel",
  BUGZILLA: "BugZilla",
  TRELLO: "Trello",
  CLICKUP: "ClickUp",
  JENKINS: "Jenkins",
  CODESHIP: "CodeShip",
  CONTEXTQA_LAB: "QASyn Lab",
  PRIVATE_GRID: "Private Grid",
};

function timeOf(date: Date) {
  return date.toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function ageOf(date: Date) {
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}mo`;
}

function tagFor(action: string) {
  if (action.startsWith("crawl")) return "CRAWL";
  if (action.startsWith("test_case")) return "TEST";
  if (action.startsWith("bug")) return "BUG";
  if (action.startsWith("pr.")) return "PR";
  if (action.startsWith("suite")) return "SUITE";
  if (action.startsWith("member")) return "TEAM";
  if (action.startsWith("integration")) return "INTEGRATION";
  if (action.startsWith("api_token")) return "TOKEN";
  if (action.startsWith("requirement")) return "REQ";
  if (action.startsWith("plan")) return "PLAN";
  return action.split(".")[0].replace(/_/g, " ").toUpperCase().slice(0, 12);
}

/** Splits 100% across rows with the largest-remainder method. */
function sharePercentages(counts: number[]) {
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (!total) return counts.map(() => 0);
  const raw = counts.map((value) => (value / total) * 100);
  const floors = raw.map((value) => Math.floor(value));
  let remainder = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let cursor = 0; cursor < order.length && remainder > 0; cursor += 1) {
    floors[order[cursor].index] += 1;
    remainder -= 1;
  }
  return floors;
}

export default async function OverviewPage() {
  const ctx = await requirePermission("overview");
  const orgId = ctx.org.id;
  const [data, members, recentTests, biviaSummary] = await Promise.all([
    getOverview(orgId),
    prisma.user.count({ where: { organisationId: orgId } }),
    prisma.testCase.findMany({
      where: { organisationId: orgId },
      orderBy: [{ lastRunAt: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: { id: true, title: true, stepsCount: true, status: true, lastRunAt: true, createdAt: true },
    }),
    getBiviaObservatory(orgId),
  ]);

  const settings = readSettings(ctx.org);
  const dismissed = new Set(settings.dismissed ?? []);
  const crawl = data.crawl;
  const crawlLogs = crawl ? parseCrawlLogs(crawl.logs) : [];

  let events: OverviewEvent[] = [];
  if (crawl && crawlLogs.length > 0) {
    events = crawlLogs.slice(0, 4).map((line) => ({
      time: timeOf(new Date(crawl.startedAt.getTime() + line.offsetMs)),
      tag: line.tag.toUpperCase(),
      message: line.message,
    }));
  } else if (data.recents.length > 0) {
    events = data.recents.slice(0, 4).map((entry) => ({
      time: timeOf(new Date(entry.createdAt)),
      tag: tagFor(entry.action),
      message: entry.target,
    }));
  } else if (crawl) {
    const completed = crawl.completedAt ?? new Date(crawl.startedAt.getTime() + 20 * 60_000);
    events = [
      { time: timeOf(crawl.startedAt), tag: "CRAWL", message: `Crawling ${crawl.targetUrl}` },
      { time: timeOf(completed), tag: "CRAWL", message: "Crawl completed." },
      { time: timeOf(new Date(completed.getTime() + 1_000)), tag: "CRAWL", message: "Crawl now starting to generate test cases…" },
      {
        time: timeOf(new Date(completed.getTime() + 88_000)),
        tag: "CRAWL",
        message: `Crawl generated ${crawl.flowsMapped} test case${crawl.flowsMapped === 1 ? "" : "s"}.`,
      },
    ];
    if (crawl.status === "running") events = events.slice(0, 1);
  }

  const failureCount = (row: { total: number; passing: number }) => Math.max(0, row.total - row.passing);
  const badgeFor = (row: { total: number; passing: number }) => {
    const failing = failureCount(row);
    if (failing > 0) return `${failing} of ${row.total} tests failing`;
    return `${row.total} test${row.total === 1 ? "" : "s"} passing`;
  };
  const detailFor = (row: { total: number; passing: number }) => {
    const failing = failureCount(row);
    return `${row.total} by AI${failing > 0 ? ` ${failing} tests failed their last run.` : ""}`;
  };
  const coverageScore = (row: { total: number; passing: number }) => {
    if (!row.total) return 0;
    const ratio = failureCount(row) / row.total;
    return Math.max(60, Math.min(96, Math.round(data.coverageBaseline - ratio * 20)));
  };

  const modules: OverviewCoverageRow[] = data.modules.map((row) => ({
    key: `module-${row.name}`,
    name: row.name,
    badge: badgeFor(row),
    percent: coverageScore(row),
    detail: detailFor(row),
  }));

  const TIERS = [
    { key: "critical", name: "Critical risk" },
    { key: "high", name: "High risk" },
    { key: "medium", name: "Medium risk" },
    { key: "low", name: "Low risk" },
  ];
  const tierData = TIERS.flatMap((tier) => {
    const row = data.criticality.find((item) => item.name === tier.key);
    return row ? [{ ...tier, ...row }] : [];
  });
  const tierShares = sharePercentages(tierData.map((row) => row.total));
  const criticality: OverviewCoverageRow[] = tierData.map((row, index) => ({
    key: `tier-${row.key}`,
    name: row.name,
    badge: `${row.total} test${row.total === 1 ? "" : "s"}`,
    percent: tierShares[index] ?? 0,
    detail: detailFor(row),
  }));

  const total = data.tests.total;
  const passing = data.tests.passing;
  const failing = Math.max(0, total - passing);

  const connected = data.integrations.filter((integration) => ["CONNECTED", "INDEXING"].includes(integration.status));
  const connectedProviders = new Set(connected.map((integration) => integration.provider));
  const integrations = connected.map((integration) => PROVIDER_LABELS[integration.provider] ?? integration.provider);

  const recents: OverviewRecent[] = recentTests.map((test) => ({
    id: test.id,
    title: test.title,
    steps: test.stepsCount,
    status: test.status,
    age: ageOf(test.lastRunAt ?? test.createdAt),
    href: `/dashboard/test-studio/${test.id}`,
  }));

  const showSlack = !settings.slackChannelCreated && !dismissed.has("slack");
  const showBugTracker = !dismissed.has("bugTracker") && !connectedProviders.has("JIRA") && !connectedProviders.has("LINEAR");
  const showInvite = !dismissed.has("invite") && members <= 1;

  return (
    <Overview
      readOnly={ctx.readOnly}
      ownerEmail={ctx.user.email}
      terminal={{ events, running: crawl?.status === "running" }}
      stats={{
        total: data.tests.total,
        passing,
        failing,
        bugs: data.bugs.total,
        reproduced: data.bugs.reproduced,
        saved: data.saved,
        regressions: data.regressions,
      }}
      strip={{ prsChecked: data.prsChecked, integrations }}
      modules={modules}
      criticality={criticality}
      recents={recents}
      showSlack={showSlack}
      showBugTracker={showBugTracker}
      showInvite={showInvite}
      biviaSummary={biviaSummary}
      autopilotTarget={ctx.org.website ?? "https://www.cgi.com"}
    />
  );
}
