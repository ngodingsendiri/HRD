import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildEmployeeStatsPayload } from "../../lib/buildEmployeeStats.js";
import { requireStaff } from "../../../api/_lib/session.js";
import { ensureRequestId, sendError, withErrorBoundary } from "../../../api/_lib/http.js";

/**
 * GET /api/stats — aggregates via SQL groupBy + full timeline scan.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  ensureRequestId(req, res);

  return withErrorBoundary(res, "stats", async () => {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendError(res, 405, "Method Not Allowed");
    }

    try {
      await requireStaff(req, res);
    } catch {
      return;
    }

    const stats = await buildEmployeeStatsPayload();
    res.setHeader("Cache-Control", "private, max-age=45");
    return res.status(200).json(stats);
  });
}
