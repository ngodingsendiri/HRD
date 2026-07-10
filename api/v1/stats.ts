import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireApiKey } from "../_lib/apiKey.js";
import { prisma } from "../../src/lib/db.js";
import {
  buildKgbList,
  buildKpList,
  buildPensiunList,
  normalizeBidangLabel,
} from "../../src/lib/dashboardStats.js";
import { fetchAllTimelineRows } from "../../src/lib/statsTimeline.js";
import {
  clientIp,
  ensureRequestId,
  rateLimit,
  sendError,
  withErrorBoundary,
  applyPublicApiCors,
} from "../_lib/http.js";

/**
 * GET /api/v1/stats — same payload as session /api/stats (API key + stats:read).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  ensureRequestId(req, res);

  return withErrorBoundary(res, "v1/stats", async () => {
    // Preflight before auth (browser may not send key on OPTIONS)
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

    const [byStatus, byBidangRaw, timeline] = await Promise.all([
      prisma.employee.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.employee.groupBy({
        by: ["bidang"],
        _count: { _all: true },
        orderBy: { _count: { bidang: "desc" } },
        take: 30,
      }),
      fetchAllTimelineRows(),
    ]);

    const total = timeline.totalKnown;
    const timelineRows = timeline.rows;

    const totals = {
      total,
      pns: 0,
      cpns: 0,
      pppk: 0,
      pppkpw: 0,
      honorer: 0,
      lainnya: 0,
    };
    for (const row of byStatus) {
      const n = row._count._all;
      switch (row.status) {
        case "PNS":
          totals.pns = n;
          break;
        case "CPNS":
          totals.cpns = n;
          break;
        case "PPPK":
          totals.pppk = n;
          break;
        case "PPPKPW":
          totals.pppkpw = n;
          break;
        case "Honorer":
          totals.honorer = n;
          break;
        default:
          totals.lainnya += n;
      }
    }

    const byBidang = byBidangRaw
      .map((r) => ({
        name: normalizeBidangLabel(r.bidang || "Lainnya"),
        value: r._count._all,
      }))
      .reduce<{ name: string; value: number }[]>((acc, cur) => {
        const hit = acc.find((x) => x.name === cur.name);
        if (hit) hit.value += cur.value;
        else acc.push({ ...cur });
        return acc;
      }, [])
      .sort((a, b) => b.value - a.value);

    res.setHeader("Cache-Control", "private, max-age=45");
    return res.status(200).json({
      totals,
      byBidang,
      kgb: buildKgbList(timelineRows as never),
      kp: buildKpList(timelineRows as never),
      pensiun: buildPensiunList(timelineRows as never),
      generatedAt: new Date().toISOString(),
      truncated: timeline.truncated,
    });
  });
}
