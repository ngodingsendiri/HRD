import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pathParamId, requireApiKey } from "../../../_lib/apiKey.js";
import { getEmployee } from "../../../../src/lib/queries.js";
import {
  clientIp,
  ensureRequestId,
  rateLimit,
  sendError,
  withErrorBoundary,
  applyPublicApiCors,
} from "../../../_lib/http.js";

/**
 * GET /api/v1/employees/:id
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  ensureRequestId(req, res);

  return withErrorBoundary(res, "v1/employees/[id]", async () => {
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

    const id = pathParamId(req.query.id as string | string[] | undefined);
    if (!id) return sendError(res, 400, "id required");

    const emp = await getEmployee(id);
    if (!emp) return sendError(res, 404, "Not found");

    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json(emp);
  });
}
