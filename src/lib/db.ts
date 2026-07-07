import { PrismaClient } from "@prisma/client";

/**
 * Prisma singleton.
 * In development, Vite's HMR + serverless can create many PrismaClient
 * instances which exhaust DB connections. We stash one on globalThis.
 */
/**
 * Ensures the connection string has pgbouncer=true if it's a pooled connection.
 * This bypasses the need to edit locked Vercel environment variables.
 */
function getDatabaseUrl() {
  let url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (url.includes("-pooler.") && !url.includes("pgbouncer=true")) {
    url += url.includes("?") ? "&pgbouncer=true" : "?pgbouncer=true";
  }
  return url;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
