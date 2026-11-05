import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Avec prisma.config.ts, la CLI Prisma ne charge plus .env automatiquement.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
