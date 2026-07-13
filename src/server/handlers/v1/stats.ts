import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireApiKey } from "../../../../api/_lib/apiKey.js";
import { buildEmployeeStatsPayload } from "../../../lib/buildEmployeeStats.js";
import {
  clientIp,
  ensureRequestId,
  rateLimit,
  sendError,
  withErrorBoundary,
  applyPublicApiCors,
} from "../../../../api/_lib/http.js";

/**
 * GET /api/v1/stats — same payload as session /api/stats (API key + stats:read).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  ensureRequestId(req, res);

  return withErrorBoundary(res, "v1/stats", async () => {
    if (req.method === "OPTIONS") {
      applyPublicApiCors(req, res);
      return;
    }

    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, OPTIONS");
      return sendError(res, 405, "Method Not Allowed");
    }

    const limited = rateLimit(`v1:${clientIp(req)}`, {
      limit: 60,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      res.setHeader("Retry-After", String(limited.retryAfterSec));
      return sendError(res, 429, "Rate limit exceeded");
    }

    let principal;
    try {
      principal = await requireApiKey(req, res, "stats:read");
    } catch {
      return;
    }

    applyPublicApiCors(req, res, principal.allowedOrigins);

    const keyLimited = rateLimit(`v1key:${principal.id}`, {
      limit: 120,
      windowMs: 60_000,
    });
    if (!keyLimited.ok) {
      res.setHeader("Retry-After", String(keyLimited.retryAfterSec));
      return sendError(res, 429, "Rate limit exceeded for this API key");
    }

    const stats = await buildEmployeeStatsPayload();
    res.setHeader("Cache-Control", "private, max-age=45");
    return res.status(200).json(stats);
  });
}
