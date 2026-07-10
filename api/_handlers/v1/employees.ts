import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireApiKey } from "../../_lib/apiKey.js";
import { getEmployeesPage } from "../../../src/lib/queries.js";
import {
  DEFAULT_EMPLOYEES_PAGE,
  MAX_EMPLOYEES_PAGE,
  ensureRequestId,
  rateLimit,
  clientIp,
  sendError,
  withErrorBoundary,
  applyPublicApiCors,
} from "../../_lib/http.js";

/**
 * GET /api/v1/employees
 *
 * External read API (API key required, scope employees:read).
 * Query: q, status, alert, limit, offset, lean
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  ensureRequestId(req, res);

  return withErrorBoundary(res, "v1/employees", async () => {
    if (req.method === "OPTIONS") {
      applyPublicApiCors(req, res);
      return;
    }

    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, OPTIONS");
      return sendError(res, 405, "Method Not Allowed");
    }

    const limited = rateLimit(`v1:${clientIp(req)}`, {
      limit: 120,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      res.setHeader("Retry-After", String(limited.retryAfterSec));
      return sendError(res, 429, "Rate limit exceeded");
    }

    let principal;
    try {
      principal = await requireApiKey(req, res, "employees:read");
    } catch {
      return;
    }

    applyPublicApiCors(req, res, principal.allowedOrigins);

    const keyLimited = rateLimit(`v1key:${principal.id}`, {
      limit: 300,
      windowMs: 60_000,
    });
    if (!keyLimited.ok) {
      res.setHeader("Retry-After", String(keyLimited.retryAfterSec));
      return sendError(res, 429, "Rate limit exceeded for this API key");
    }

    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const alertRaw = typeof req.query.alert === "string" ? req.query.alert : undefined;
    const alert =
      alertRaw === "kp" || alertRaw === "kgb" || alertRaw === "any" ? alertRaw : undefined;
    const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : NaN;
    const offsetRaw = typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : NaN;
    const lean = !(req.query.lean === "0" || req.query.lean === "false");

    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), MAX_EMPLOYEES_PAGE)
      : DEFAULT_EMPLOYEES_PAGE;
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    const page = await getEmployeesPage({ q, status, alert, limit, offset, lean });

    res.setHeader("x-total-count", String(page.total));
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({
      data: page.data,
      total: page.total,
      limit: page.limit,
      offset: page.offset,
    });
  });
}
