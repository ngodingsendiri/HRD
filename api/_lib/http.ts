import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Shared HTTP helpers for Vercel serverless handlers:
 * - consistent error responses (no internal details leaked)
 * - in-memory rate limiting (best-effort on serverless)
 */

export function clientIp(req: VercelRequest): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) {
    return xf.split(",")[0]!.trim();
  }
  if (Array.isArray(xf) && xf[0]) return xf[0].split(",")[0]!.trim();
  return req.socket?.remoteAddress || "unknown";
}

/** Best-effort sliding window rate limiter (per-instance memory). */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  // Opportunistic cleanup to avoid unbounded growth
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }

  if (existing.count >= opts.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { ok: true };
}

export function sendError(
  res: VercelResponse,
  status: number,
  message: string,
  extra?: Record<string, unknown>,
): void {
  res.status(status).json({ error: message, ...extra });
}

/**
 * Wrap async handler body. Logs full error server-side; returns generic 500.
 * Skip wrapping when response already sent (e.g. requireAdmin wrote 401).
 */
export async function withErrorBoundary(
  res: VercelResponse,
  label: string,
  fn: () => Promise<unknown>,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    if (res.headersSent) return;
    console.error(`[${label}]`, err);
    sendError(res, 500, "Terjadi kesalahan internal");
  }
}

/** Max rows for bulk upsert / bulk delete — prevents timeouts & abuse. */
export const MAX_BULK_EMPLOYEES = 500;
export const MAX_BULK_DELETE_IDS = 500;
export const MAX_EMPLOYEES_PAGE = 2000;
/** ~1.4MB base64 for ~1MB binary logo */
export const MAX_LOGO_BASE64_CHARS = 1_500_000;
