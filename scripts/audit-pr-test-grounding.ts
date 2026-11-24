/**
 * PR-analysis quality audit: measures whether AI-drafted PR test cases are
 * grounded in the real PR diff and anchored on the website under test.
 *
 * Run: DATABASE_URL="file:./prisma/dev.db" GITHUB_TOKEN=... npx tsx scripts/audit-pr-test-grounding.ts
 * Outputs: contextqa-dump/pr-test-grounding-report.json
 */
import { writeFileSync } from "node:fs";
import { prisma } from "../lib/db";
import { fetchPrDiffs } from "../lib/pr-diff";

const GENERIC_MARKERS = [
  "primary navigation link",
  "main heading is visible",
  "end-to-end state integrity",
  "Smoke check on deployed environment",
  "Regression flow",
];

const REPO = "ingadnen/thenegociatorApp-main";
const PR_NUMBER = 2;

async function main() {
  const org = await prisma.organisation.findUnique({ where: { slug: "acme" } });
  if (!org) throw new Error("demo org acme not found");

  const prCases = await prisma.testCase.findMany({
    where: { organisationId: org.id, source: "ai-drafted" },
    select: { id: true, title: true, stepsJson: true, createdAt: true },
  });

  const diffs = await fetchPrDiffs({
    organisationId: org.id,
    provider: "GITHUB",
    repository: REPO,
    prNumber: PR_NUMBER,
  });

  const rows = prCases.map((testCase) => {
    const steps = JSON.parse(testCase.stepsJson) as Array<{ action: string; target: string }>;
    const targets = steps.map((step) => step.target.toLowerCase());
    const genericHits = GENERIC_MARKERS.filter((marker) => targets.some((target) => target.includes(marker)));
    const navigatesToPr = targets.some((target) => target.includes("github.com") || target.includes("gitlab.com"));
    const mentionsDiff = diffs.some((diff) =>
      targets.some((target) => target.includes(diff.file.split("/").pop()!.toLowerCase().replace(/\.[a-z]+$/, ""))),
    );
    return {
      caseId: testCase.id,
      title: testCase.title,
      steps: steps.length,
      groundedInDiff: mentionsDiff,
      anchoredOnSite: steps[0]?.action === "Navigate" && !navigatesToPr,
      genericMarkers: genericHits,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    sample: { repository: REPO, prNumber: PR_NUMBER, diffFiles: diffs.map((diff) => diff.file) },
    totalPrDraftedCases: rows.length,
    genericCases: rows.filter((row) => row.genericMarkers.length > 0).length,
    casesNavigatingToPrUrl: rows.filter((row) => !row.anchoredOnSite).length,
    casesGroundedInDiff: rows.filter((row) => row.groundedInDiff).length,
    cases: rows,
    interpretation:
      "genericCases and casesNavigatingToPrUrl must be 0 after the fix (lib/pr-test-gen.ts now drafts steps from the unified diff and every Navigate targets the site under test).",
  };

  writeFileSync("contextqa-dump/pr-test-grounding-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
