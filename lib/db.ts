import { PrismaClient } from "@prisma/client";

/**
 * Client Prisma global (singleton).
 * En dev, le hot-reload de Next.js ré-évalue les modules : on réutilise
 * l'instance stockée sur globalThis pour éviter d'ouvrir N connexions SQLite.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
