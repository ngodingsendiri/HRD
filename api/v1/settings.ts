import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireApiKey } from "../_lib/apiKey.js";
import { getSettings, type SettingsInclude } from "../../src/lib/queries.js";
import {
  applyPublicApiCors,
  clientIp,
  ensureRequestId,
  rateLimit,
  sendError,
  withErrorBoundary,
} from "../_lib/http.js";

/**
 * GET /api/v1/settings?include=core,logo,kamus,peta
 *
 * External read of app settings (scope settings:read).
 * Default include=core only (no huge logo/kamus/peta unless requested).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  ensureRequestId(req, res);

  return withErrorBoundary(res, "v1/settings", async () => {
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
      principal = await requireApiKey(req, res, "settings:read");
    } catch {
      return;
    }

    applyPublicApiCors(req, res, principal.allowedOrigins);

    const keyLimited = rateLimit(`v1key:${principal.id}`, {
      limit: 60,
      windowMs: 60_000,
    });
    if (!keyLimited.ok) {
      res.setHeader("Retry-After", String(keyLimited.retryAfterSec));
      return sendError(res, 429, "Rate limit exceeded for this API key");
    }

    const raw = typeof req.query.include === "string" ? req.query.include : "core";
    const allowed = new Set(["core", "logo", "kamus", "peta", "all"]);
    const include = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((x) => allowed.has(x)) as SettingsInclude[];

    const settings = await getSettings({
      include: include.length ? include : ["core"],
    });

    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json(settings);
  });
}
