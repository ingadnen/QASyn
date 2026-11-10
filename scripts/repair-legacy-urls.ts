/**
 * Repairs test cases created before the Target URL fix.
 *
 * Any `acme.example` / `example.com` URL or host found in a test case
 * (stepsJson, variablesJson, description) is replaced by the organisation's
 * real website. Acme's own demo workspace is skipped because those URLs are
 * legitimate there.
 *
 * Run: npx tsx scripts/repair-legacy-urls.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEGACY_URL_PATTERN =
  /https?:\/\/(?:[a-z0-9-]+\.)*acme\.example(?::\d+)?(?:\/[^\s"',)\]]*)?|https?:\/\/(?:[a-z0-9-]+\.)*example\.com(?::\d+)?(?:\/[^\s"',)\]]*)?/gi;
const LEGACY_HOST_PATTERN = /(?:[a-z0-9-]+\.)*acme\.example|(?:[a-z0-9-]+\.)*example\.com/gi;

function normalizeWebsite(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return null;
  }
}

function replaceLegacy(value: string, base: string, host: string): string {
  return value.replace(LEGACY_URL_PATTERN, base).replace(LEGACY_HOST_PATTERN, host);
}

async function main() {
  const orgs = await prisma.organisation.findMany({
    select: { id: true, slug: true, name: true, website: true, isMockDemo: true },
  });
  let total = 0;

  for (const org of orgs) {
    if (org.isMockDemo) {
      console.log(`- ${org.slug}: skipped (mock demo)`);
      continue;
    }
    const base = normalizeWebsite(org.website);
    if (!base) {
      console.log(`- ${org.slug}: skipped (no valid website)`);
      continue;
    }
    const host = base.replace(/^https?:\/\//, "");
    if (/acme\.example|example\.com/i.test(host)) {
      console.log(`- ${org.slug}: skipped (website is a legacy demo host)`);
      continue;
    }

    const candidates = await prisma.testCase.findMany({
      where: {
        organisationId: org.id,
        OR: [
          { stepsJson: { contains: "acme.example" } },
          { stepsJson: { contains: "example.com" } },
          { variablesJson: { contains: "acme.example" } },
          { variablesJson: { contains: "example.com" } },
          { description: { contains: "acme.example" } },
          { description: { contains: "example.com" } },
        ],
      },
      select: { id: true, title: true, stepsJson: true, variablesJson: true, description: true },
    });

    for (const testCase of candidates) {
      let stepsJson = testCase.stepsJson;
      try {
        const steps = JSON.parse(testCase.stepsJson || "[]") as Array<Record<string, unknown>>;
        stepsJson = Array.isArray(steps)
          ? JSON.stringify(
              steps.map((step) => ({
                ...step,
                target: typeof step.target === "string" ? replaceLegacy(step.target, base, host) : step.target,
                value: typeof step.value === "string" ? replaceLegacy(step.value, base, host) : step.value,
              })),
            )
          : stepsJson;
      } catch {
        stepsJson = replaceLegacy(testCase.stepsJson, base, host);
      }

      let variablesJson: string;
      try {
        const variables = JSON.parse(testCase.variablesJson || "{}") as Record<string, unknown>;
        if (!variables || typeof variables !== "object" || Array.isArray(variables)) throw new Error("invalid");
        variables.url = base;
        variablesJson = JSON.stringify(variables);
      } catch {
        variablesJson = JSON.stringify({ url: base });
      }

      await prisma.testCase.update({
        where: { id: testCase.id },
        data: {
          stepsJson,
          variablesJson,
          ...(testCase.description ? { description: replaceLegacy(testCase.description, base, host) } : {}),
        },
      });
    }

    total += candidates.length;
    console.log(`✔ ${org.slug}: repaired ${candidates.length} test case(s) → ${base}`);
  }

  console.log(`\nDone. ${total} test case(s) repaired.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
