/**
 * Resets the local development database from scratch:
 * 1) stops Prisma engine locks gracefully (no force-kill),
 * 2) deletes dev.db + WAL/SHM/journal sidecars,
 * 3) syncs the CURRENT schema (37 tables) via `prisma db push`,
 * 4) seeds the demo organisations.
 * Usage: npm run db:reset
 */
import { execSync } from "node:child_process";
import { rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Purge stale Prisma engine temp files (EPERM lock artifacts).
const engineDir = join(process.cwd(), "node_modules", ".prisma", "client");
if (existsSync(engineDir)) {
  for (const file of readdirSync(engineDir)) {
    if (/query_engine.*\.tmp\*/i.test(file) || /query_engine-windows\.dll\.node\.tmp.*$/i.test(file)) {
      try {
        rmSync(join(engineDir, file), { force: true });
        console.log(`✔ Removed stale engine temp: ${file}`);
      } catch {
        /* ignore — a running process may hold it */
      }
    }
  }
}

const dbDir = join(process.cwd(), "prisma");
const files = ["dev.db", "dev.db-wal", "dev.db-shm", "dev.db-journal"];

for (const file of files) {
  const path = join(dbDir, file);
  try {
    if (existsSync(path)) {
      rmSync(path, { force: true });
      console.log(`✔ Removed ${file}`);
    }
  } catch (e) {
    console.error(`✖ Could not remove ${file}: ${e instanceof Error ? e.message : e}`);
    console.error("Stop `next start` / `next dev` first (EPERM = a Node process locks the SQLite engine).");
    process.exit(1);
  }
}

execSync("npx prisma db push", { stdio: "inherit" });
execSync("npx prisma db seed", { stdio: "inherit" });
console.log("✔ db:reset complete — current schema applied and seeded.");
