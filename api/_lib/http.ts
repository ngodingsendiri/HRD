import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Shared HTTP helpers for Vercel serverless handlers:
 * - consistent error responses (no internal details leaked)
 * - in-memory rate limiting (best-effort on serverless)
 */

/** True on Vercel production / NODE_ENV production — hide diagnostic detail in responses. */
export function isProductionRuntime(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

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
 * CORS for public /api/v1/* data endpoints (API-key auth).
 *
 * @param allowedOrigins When set (from API key), only those origins get
 *   Access-Control-Allow-Origin. Empty/undefined → `*` (server-to-server keys).
 * Returns true if this was an OPTIONS preflight (caller should return).
 */
export function applyPublicApiCors(
  req: VercelRequest,
  res: VercelResponse,
  allowedOrigins?: string[] | null,
): boolean {
  const originHeader =
    typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
  let requestOrigin: string | null = null;
  if (originHeader) {
    try {
      requestOrigin = new URL(originHeader).origin;
    } catch {
      requestOrigin = null;
    }
  }

  if (allowedOrigins?.length) {
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Vary", "Origin");
    }
    // Mismatched browser origin: omit ACAO so browser blocks the response
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, X-API-Key, Content-Type, Accept",
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    // Preflight without key — allow listed origins or *
    if (allowedOrigins?.length && requestOrigin && !allowedOrigins.includes(requestOrigin)) {
      res.status(403).end();
      return true;
    }
    res.status(204).end();
    return true;
  }
  return false;
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
  const t0 = Date.now();
  try {
    await fn();
  } catch (err) {
    if (res.headersSent) return;
    console.error(`[${label}]`, err);
    const msg = err instanceof Error ? err.message : "";
    if (/AUTH_SECRET/i.test(msg)) {
      sendError(
        res,
        503,
        "Konfigurasi server belum lengkap (AUTH_SECRET). Hubungi administrator.",
      );
      return;
    }
    if (/DATABASE_URL|Can't reach database|P1001|P1017/i.test(msg)) {
      sendError(res, 503, "Database tidak tersedia. Coba lagi sebentar.");
      return;
    }
    sendError(res, 500, "Terjadi kesalahan internal");
  } finally {
    try {
      res.setHeader("x-response-time", `${Date.now() - t0}ms`);
    } catch {
      /* headers may be sent */
    }
    if (Date.now() - t0 > 1500) {
      console.warn(`[perf] ${label} took ${Date.now() - t0}ms`);
    }
  }
}

/** Max rows for bulk upsert / bulk delete — prevents timeouts & abuse. */
export const MAX_BULK_EMPLOYEES = 500;
export const MAX_BULK_DELETE_IDS = 500;
/** Default list page size (clients can raise up to MAX). */
export const DEFAULT_EMPLOYEES_PAGE = 50;
export const MAX_EMPLOYEES_PAGE = 500;
/** ~1.4MB base64 for ~1MB binary logo */
export const MAX_LOGO_BASE64_CHARS = 1_500_000;

/** Attach a request id for log correlation (optional header passthrough). */
export function ensureRequestId(req: VercelRequest, res: VercelResponse): string {
  const incoming = req.headers["x-request-id"];
  const id =
    (typeof incoming === "string" && incoming.slice(0, 64)) ||
    `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  res.setHeader("x-request-id", id);
  return id;
}
