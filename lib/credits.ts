import { prisma } from "@/lib/db";

/**
 * Credit ledger actions captured from the live QASyn usage page. The order
 * is the order shown in the "By action" filter.
 */
export const CREDIT_ACTIONS = [
  "Web test execution",
  "Mobile test execution",
  "API test execution",
  "Accessibility test execution",
  "Performance test execution",
  "Test re-run",
  "Web test run",
  "Mobile test run",
  "API test run",
  "Debug session",
  "Debug browser time",
  "Pull-request analysis",
  "Bug reproduction",
  "Root cause analysis",
  "Self-healing",
  "Requirement upload",
  "PDF page processing",
  "Video processing",
  "Figma import",
  "Code analysis",
  "Autonomous crawl",
  "AI-Insight session",
  "Knowledge base sync",
  "Agent session",
  "AI input tokens",
  "AI output tokens",
  "AI reasoning tokens",
  "AI cached tokens",
  "Browser time",
  "Device farm time",
  "Storage",
] as const;

interface SeedRow {
  /** Days before today. */
  day: number;
  time: string;
  action: string;
  credits: number;
  kind: "charge" | "refund" | "grant";
  note?: string;
}

function at(daysAgo: number, time: string) {
  const [hours, minutes, seconds] = time.split(":").map(Number);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, seconds ?? 0, 0);
  return date;
}

/**
 * Splits a total into `count` negative entries and returns the amounts. The
 * first entries receive the larger share so the rounded total always matches.
 */
function splitNegative(total: number, count: number) {
  const whole = Math.floor(total / count);
  let remainder = total - whole * count;
  return Array.from({ length: count }, () => {
    let amount = whole;
    if (remainder > 0) {
      amount += 1;
      remainder -= 1;
    }
    return -amount;
  });
}

function seedRows(used: number): SeedRow[] {
  const safeUsed = Math.max(0, Math.round(used));
  const crawlTotal = Math.round(safeUsed * 0.91);
  const webTotal = safeUsed - crawlTotal;
  const refundTotal = safeUsed > 0 ? Math.max(1, Math.round(safeUsed * 0.0045)) : 0;

  const crawls = splitNegative(crawlTotal, 2);
  const web = splitNegative(webTotal, 33);
  const refunds = splitNegative(refundTotal, 4).map((amount) => -amount);

  const rows: SeedRow[] = [
    // Newest ledger page, matching the live layout row-for-row.
    { day: 1, time: "16:08:00", action: "Root cause analysis", credits: 0, kind: "charge" },
    { day: 1, time: "16:07:40", action: "Web test run", credits: web[0], kind: "charge" },
    { day: 1, time: "16:07:16", action: "Autonomous crawl", credits: crawls[0], kind: "charge" },
    { day: 3, time: "23:11:00", action: "Web test run", credits: web[1], kind: "charge" },
    { day: 4, time: "20:55:56", action: "Root cause analysis", credits: 0, kind: "charge" },
    { day: 4, time: "20:55:43", action: "Web test run", credits: web[2], kind: "charge" },
    { day: 4, time: "20:54:58", action: "Root cause analysis", credits: 0, kind: "charge" },
    { day: 4, time: "20:54:41", action: "Root cause analysis", credits: 0, kind: "charge" },
    { day: 4, time: "20:54:24", action: "Root cause analysis", credits: 0, kind: "charge" },
    { day: 4, time: "20:53:30", action: "Root cause analysis", credits: 0, kind: "charge" },
    { day: 4, time: "20:52:27", action: "Web test run", credits: refunds[0], kind: "refund", note: "Web test run" },
    { day: 4, time: "20:51:48", action: "Root cause analysis", credits: 0, kind: "charge" },
    { day: 4, time: "20:51:41", action: "Root cause analysis", credits: 0, kind: "charge" },
    { day: 4, time: "20:51:35", action: "Web test run", credits: web[3], kind: "charge" },
    { day: 4, time: "20:51:22", action: "Web test run", credits: web[4], kind: "charge" },
    { day: 4, time: "20:51:10", action: "Root cause analysis", credits: 0, kind: "charge" },
    { day: 4, time: "20:50:39", action: "Root cause analysis", credits: 0, kind: "charge" },
    { day: 4, time: "20:49:54", action: "Root cause analysis", credits: 0, kind: "charge" },
    { day: 4, time: "20:49:40", action: "Root cause analysis", credits: 0, kind: "charge" },
    { day: 4, time: "20:49:12", action: "Web test run", credits: web[5], kind: "charge" },
    { day: 4, time: "20:47:35", action: "Root cause analysis", credits: 0, kind: "charge" },
    { day: 4, time: "20:47:11", action: "Root cause analysis", credits: 0, kind: "charge" },
    { day: 4, time: "20:45:44", action: "Web test run", credits: refunds[1], kind: "refund", note: "Web test run" },
    { day: 4, time: "20:45:31", action: "Web test run", credits: web[6], kind: "charge" },
    { day: 4, time: "20:45:09", action: "Web test run", credits: refunds[2], kind: "refund", note: "Web test run" },
  ];

  // Remaining web charges, one crawl and the extra RCA rows.
  for (let index = 7; index < web.length; index += 1) {
    rows.push({
      day: 3,
      time: `19:${String(10 + (index % 45)).padStart(2, "0")}:${String((index * 7) % 60).padStart(2, "0")}`,
      action: "Web test run",
      credits: web[index],
      kind: "charge",
    });
  }
  rows.push({ day: 3, time: "18:05:12", action: "Autonomous crawl", credits: crawls[1], kind: "charge" });
  rows.push({ day: 3, time: "18:04:40", action: "Root cause analysis", credits: 0, kind: "charge" });
  rows.push({ day: 2, time: "11:40:02", action: "Web test run", credits: refunds[3], kind: "refund", note: "Web test run" });

  return rows;
}

const inFlight = new Map<string, Promise<void>>();

/**
 * Seeds the demo ledger once per workspace, so the billing and usage screens
 * always have SQLite-backed rows whose totals agree with the organisation's
 * consumed credits.
 */
export async function ensureCreditLedger(org: { id: string; creditsUsed: number }): Promise<void> {
  if (inFlight.has(org.id)) return inFlight.get(org.id);
  const task = (async () => {
    const count = await prisma.creditEntry.count({ where: { organisationId: org.id } });
    if (count > 0) return;
    const rows = seedRows(org.creditsUsed);
    await prisma.creditEntry.createMany({
      data: rows.map((row) => ({
        organisationId: org.id,
        occurredAt: at(row.day, row.time),
        action: row.action,
        credits: row.credits,
        kind: row.kind,
        note: row.note ?? null,
      })),
    });
  })();
  inFlight.set(org.id, task);
  try {
    await task;
  } finally {
    inFlight.delete(org.id);
  }
}
