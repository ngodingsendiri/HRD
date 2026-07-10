import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../src/lib/db.js";
import {
  buildKgbList,
  buildKpList,
  buildPensiunList,
  normalizeBidangLabel,
  type DashboardStats,
} from "../src/lib/dashboardStats.js";
import { fetchAllTimelineRows } from "../src/lib/statsTimeline.js";
import { requireStaff } from "./_lib/session.js";
import { ensureRequestId, sendError, withErrorBoundary } from "./_lib/http.js";

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

    const stats: DashboardStats & { truncated?: boolean } = {
      totals,
      byBidang,
      kgb: buildKgbList(timelineRows as never),
      kp: buildKpList(timelineRows as never),
      pensiun: buildPensiunList(timelineRows as never),
      generatedAt: new Date().toISOString(),
      truncated: timeline.truncated,
    };

    res.setHeader("Cache-Control", "private, max-age=45");
    return res.status(200).json(stats);
  });
}
