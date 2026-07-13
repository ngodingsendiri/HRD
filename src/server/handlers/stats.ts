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

    const force =
      req.query.force === "1" ||
      req.query.force === "true" ||
      typeof req.query._ === "string";
    const stats = await buildEmployeeStatsPayload({ force });
    // Short cache for normal loads; no-store when force-refresh from UI
    res.setHeader(
      "Cache-Control",
      force ? "private, no-store" : "private, max-age=45",
    );
    return res.status(200).json(stats);
  });
}
