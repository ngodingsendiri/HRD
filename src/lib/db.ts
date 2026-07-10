import { PrismaClient } from "@prisma/client";

/**
 * Prisma singleton for serverless + local.
 * Always reuse on globalThis to avoid exhausting Neon connections on warm
 * Vercel isolates (not only in development).
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

globalForPrisma.prisma = prisma;

/** Lightweight connectivity probe for health checks. */
export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "db_unreachable",
    };
  }
}
