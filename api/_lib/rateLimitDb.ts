/**
 * Distributed rate limit backed by Neon (Prisma).
 * Use for sensitive paths (login, API key create) where in-memory
 * per-isolate limits are bypassed under multi-instance serverless.
 *
 * Falls back to in-memory rateLimit() if DB is unavailable so auth
 * still degrades gracefully rather than failing open completely.
 */
import { prisma } from "../../src/lib/db.js";
import { rateLimit } from "./http.js";

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/**
 * Sliding fixed-window counter stored in `rate_limit_buckets`.
 * Not perfectly atomic under extreme concurrency, but good enough
 * across isolates (far better than memory-only).
 */
export async function rateLimitDb(
  key: string,
  opts: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  const id = key.slice(0, 180);
  const now = Date.now();

  try {
    const row = await prisma.rateLimitBucket.findUnique({ where: { id } });

    if (!row || row.resetAt.getTime() <= now) {
      const resetAt = new Date(now + opts.windowMs);
      await prisma.rateLimitBucket.upsert({
        where: { id },
        create: { id, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
      return { ok: true };
    }

    if (row.count >= opts.limit) {
      return {
        ok: false,
        retryAfterSec: Math.max(
          1,
          Math.ceil((row.resetAt.getTime() - now) / 1000),
        ),
      };
    }

    await prisma.rateLimitBucket.update({
      where: { id },
      data: { count: { increment: 1 } },
    });
    return { ok: true };
  } catch (err) {
    console.warn("[rateLimitDb] fallback to memory", err);
    return rateLimit(`mem:${id}`, opts);
  }
}

/** Best-effort prune of expired buckets (call rarely, e.g. health). */
export async function pruneRateLimitBuckets(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - olderThanMs);
    const res = await prisma.rateLimitBucket.deleteMany({
      where: { resetAt: { lt: cutoff } },
    });
    return res.count;
  } catch {
    return 0;
  }
}
