import type { Prisma, PrismaClient } from "@prisma/client";
import { buildDemoRuns } from "./mockData";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Insère l'historique de releases simulé (TestRun + LogLine) pour une organisation.
 * Utilisé par le seed et par la fin de l'onboarding (étape 7).
 */
export async function createDemoRuns(
  db: Db,
  organisationId: string,
  project: string,
  firstRelease = 1,
  now: Date = new Date(),
): Promise<number> {
  const runs = buildDemoRuns(project, firstRelease, now);
  for (const { logs, ...run } of runs) {
    await db.testRun.create({
      data: { ...run, organisationId, logs: { create: logs } },
    });
  }
  return runs.length;
}
