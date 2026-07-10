/**
 * Prisma + Neon for Vercel serverless.
 *
 * Why adapter-neon?
 * Classic Prisma TCP to Neon pooler often fails from Vercel with:
 *   "Can't reach database server at ep-...-pooler...:5432"
 * Neon serverless driver uses WebSockets (works on Vercel).
 *
 * Env:
 * - DATABASE_URL = Neon **pooled** connection string (runtime)
 * - DIRECT_URL   = Neon **unpooled** (migrations only, schema.prisma)
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Required for Node.js (Vercel functions) — browser has WebSocket built-in
neonConfig.webSocketConstructor = ws;

/** Normalize Neon URL for runtime (pooler + ssl, no channel_binding). */
export function getDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL?.trim();
  if (!url) return undefined;

  url = url
    .replace(/([?&])channel_binding=require&?/gi, "$1")
    .replace(/[?&]$/, "")
    .replace(/\?&/, "?");

  if (!/[?&]sslmode=/.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "sslmode=require";
  }

  // Longer timeout — Neon may cold-start (wake from idle)
  if (!/[?&]connect_timeout=/.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "connect_timeout=30";
  }

  return url;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrisma(): PrismaClient {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    // Still construct client so imports don't crash; queries will fail clearly
    return new PrismaClient({
      log: ["error"],
    });
  }

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({
    adapter,
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
    return { ok: false, latencyMs: 0, error: "DATABASE_URL_missing" };
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message.slice(0, 220) : "db_unreachable",
    };
  }
}
