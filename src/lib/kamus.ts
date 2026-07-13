import { DEFAULT_KAMUS } from "../constants.js";

/**
 * Pure kamus (job-grade dictionary) lookup.
 * Lives in its own module so it can be imported from client code without
 * pulling in Prisma (which is server-only).
 *
 * Map is memoized by CSV content so list/print (N lookups) stay O(N) total,
 * not O(N × rows_in_kamus).
 */

type KamusEntry = { kelas: string; beban: string };

let mapCache: { key: string; map: Map<string, KamusEntry> } | null = null;

function buildKamusMap(csv: string): Map<string, KamusEntry> {
  const map = new Map<string, KamusEntry>();
  for (const row of csv.split("\n")) {
    if (!row || row.trim() === "") continue;
    const cols = row.split(/;|\t/);
    if (cols.length >= 4) {
      map.set(cols[1]!.trim().toLowerCase(), {
        kelas: cols[2]!.trim(),
        beban: cols[3]!.trim(),
      });
    }
  }
  return map;
}

function getKamusMap(kamusCsv?: string): Map<string, KamusEntry> {
  const csv = kamusCsv || DEFAULT_KAMUS;
  if (mapCache && mapCache.key === csv) return mapCache.map;
  const map = buildKamusMap(csv);
  mapCache = { key: csv, map };
  return map;
}

/** Drop lookup map when settings kamus changes (server + HMR safety). */
export function invalidateKamusLookupCache(): void {
  mapCache = null;
}

export function lookupKamus(
  jabatan: string,
  kamusCsv?: string,
): { kelas: string; beban: string } {
  const map = getKamusMap(kamusCsv);
  const hit = map.get((jabatan || "").trim().toLowerCase());
  return hit ? { ...hit } : { kelas: "", beban: "" };
}
