/**
 * Seed de la base locale : `npm run db:seed` (exécuté aussi par `prisma migrate dev`/`reset`).
 *
 * Crée l'organisation de démonstration "Acme" (slug `acme`) avec :
 *  - un onboarding terminé,
 *  - les intégrations GitHub / Jira / Slack connectées,
 *  - 8 releases (277 → 284) dont le "Release Quality Report" 284
 *    (score 92/100, couverture 94 %, 18,4 k$ évités) et les logs du terminal AQE.
 *
 * Idempotent : l'organisation de démo est supprimée puis recréée (cascade).
 */
import { PrismaClient } from "@prisma/client";
import { createDemoRuns } from "../lib/runs";

const prisma = new PrismaClient();

const DEMO_SLUG = "acme";

async function main() {
  await prisma.organisation.deleteMany({ where: { slug: DEMO_SLUG } });

  const org = await prisma.organisation.create({
    data: {
      name: "Acme",
      slug: DEMO_SLUG,
      ownerName: "Alex Morgan",
      website: "https://acme.example",
      addWebsiteToKb: true,
      onboarding: {
        create: {
          currentStep: 7,
          appDescription:
            "Acme Storefront is a B2C e-commerce web app. Customers browse the catalog, search products, " +
            "save carts, check out with card or wallet payments and manage invoices from their account. " +
            "Critical flows: login (email + SSO), checkout, payments, billing.",
          reachType: "TEAM_ENV",
          environmentUrl: "https://staging.acme.example",
          focus: "PR_IMPACT",
          teamInvites: "sam@acme.example\npriya@acme.example",
          completedAt: new Date(),
        },
      },
      integrations: {
        create: [
          { provider: "GITHUB", status: "CONNECTED", detail: "acme/storefront" },
          { provider: "JIRA", status: "CONNECTED", detail: "ACME" },
          { provider: "SLACK", status: "CONNECTED", detail: "#qa-alerts" },
        ],
      },
    },
  });

  const runs = await createDemoRuns(prisma, org.id, "acme / storefront", 277);
  const logs = await prisma.logLine.count({ where: { testRun: { organisationId: org.id } } });

  console.log(`✔ Seed OK — organisation "${org.name}" (${org.slug}) · ${runs} test runs · ${logs} log lines`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
