import { prisma } from "../lib/db";

(async () => {
  const organisations = await prisma.organisation.count();
  await prisma.$disconnect();
  // Exit 0 when data already exists (skip seed); exit 1 when the database is empty.
  process.exit(organisations > 0 ? 0 : 1);
})();
