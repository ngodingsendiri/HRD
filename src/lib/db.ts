import { PrismaClient } from "@prisma/client";

/**
 * Prisma singleton for serverless + local (Neon / Vercel).
 *
 * Neon tips for Vercel:
 * - DATABASE_URL = pooled (-pooler) + pgbouncer=true
 * - DIRECT_URL = non-pooler (migrations only)
 * - Strip channel_binding=require (can break serverless Prisma)
 */
export function getDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL?.trim();
  if (!url) return undefined;

  // channel_binding=require often breaks Node serverless drivers
  url = url
    .replace(/([?&])channel_binding=require&?/gi, "$1")
    .replace(/[?&]$/, "")
    .replace(/\?&/, "?");

  const hasQuery = url.includes("?");
  const join = hasQuery ? "&" : "?";

  if (!/[?&]sslmode=/.test(url)) {
    url += `${join}sslmode=require`;
  }

  // Prisma + Neon pooler
  if (url.includes("-pooler.") && !/[?&]pgbouncer=true/.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "pgbouncer=true";
  }

  if (!/[?&]connect_timeout=/.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "connect_timeout=15";
  }

  return url;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrisma(): PrismaClient {
  const url = getDatabaseUrl();
  return new PrismaClient({
    datasources: url
      ? {
          db: { url },
        }
      : undefined,
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();
globalForPrisma.prisma = prisma;

/** Lightweight connectivity probe for health checks. */
export async function pingDatabase(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      ok: false,
      latencyMs: 0,
      error: "DATABASE_URL_missing",
    };
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message.slice(0, 200) : "db_unreachable",
    };
  }
}
