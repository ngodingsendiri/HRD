/**
 * Shared dashboard / v1 stats payload builder.
 * Keeps session + external stats handlers DRY (single aggregation path).
 *
 * Short in-process cache (warm isolates) avoids repeat full scans on refresh spam.
 * Invalidated on employee write paths.
 */
import { prisma } from "./db.js";
import { DEFAULT_KAMUS } from "../constants.js";
import {
  buildDataHealth,
  buildKgbList,
  buildKpList,
  buildPensiunList,
  EMPTY_DATA_HEALTH,
  normalizeBidangLabel,
  type DashboardStats,
} from "./dashboardStats.js";
import { fetchAllTimelineRows } from "./statsTimeline.js";
import { lookupKamus } from "./kamus.js";

export type EmployeeStatsPayload = DashboardStats & { truncated?: boolean };

const STATS_TTL_MS = 30_000;
let statsCache: { at: number; data: EmployeeStatsPayload } | null = null;

/** Drop cache after create/update/delete/import so dashboards stay coherent. */
export function invalidateEmployeeStatsCache(): void {
  statsCache = null;
}

/**
 * SQL groupBy for counts + cursor scan for KP/KGB/pensiun timelines.
 * Callers apply auth / rate-limit / Cache-Control headers.
 * @param force skip in-process TTL (e.g. Dashboard “Muat ulang”)
 */
export async function buildEmployeeStatsPayload(opts?: {
  force?: boolean;
}): Promise<EmployeeStatsPayload> {
  const now = Date.now();
  if (
    !opts?.force &&
    statsCache &&
    now - statsCache.at < STATS_TTL_MS
  ) {
    return statsCache.data;
  }

  const data = await computeEmployeeStats();
  statsCache = { at: now, data };
  return data;
}

async function computeEmployeeStats(): Promise<EmployeeStatsPayload> {
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

  const totals = {
    total: timeline.totalKnown,
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

  const bidangMap = new Map<string, number>();
  for (const r of byBidangRaw) {
    const name = normalizeBidangLabel(r.bidang || "Lainnya");
    bidangMap.set(name, (bidangMap.get(name) || 0) + r._count._all);
  }
  const byBidang = [...bidangMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const rows = timeline.rows;
  let health = EMPTY_DATA_HEALTH;
  try {
    // Avoid importing queries.ts (circular: queries → invalidate stats)
    const settingsRow = await prisma.settings.findUnique({
      where: { id: "app" },
    });
    const data = (settingsRow?.data ?? {}) as { jabatanKamusCsv?: string };
    const kamusCsv = data.jabatanKamusCsv || DEFAULT_KAMUS;
    health = buildDataHealth(rows, (jabatan) => {
      const { kelas, beban } = lookupKamus(jabatan, kamusCsv);
      return Boolean(kelas || beban);
    });
  } catch {
    /* kamus optional for stats — keep zeros */
  }

  return {
    totals,
    byBidang,
    kgb: buildKgbList(rows as never),
    kp: buildKpList(rows as never),
    pensiun: buildPensiunList(rows as never),
    health,
    generatedAt: new Date().toISOString(),
    truncated: timeline.truncated,
  };
}
