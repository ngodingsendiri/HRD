import { DEFAULT_KAMUS } from "../constants.js";

/**
 * Pure kamus (job-grade dictionary) lookup.
 * Lives in its own module so it can be imported from client code without
 * pulling in Prisma (which is server-only).
 */
export function lookupKamus(jabatan: string, kamusCsv?: string): { kelas: string; beban: string } {
  const csv = kamusCsv || DEFAULT_KAMUS;
  const rows = csv.split("\n");
  for (const row of rows) {
    if (!row || row.trim() === "") continue;
    const cols = row.split(/;|\t/);
    if (cols.length >= 4 && cols[1].trim().toLowerCase() === (jabatan || "").trim().toLowerCase()) {
      return { kelas: cols[2].trim(), beban: cols[3].trim() };
    }
  }
  return { kelas: "", beban: "" };
}

/** Parse a kamus CSV into a Map keyed by lowercased jabatan. */
export function parseKamus(kamusCsv?: string): Map<string, { kelas: string; beban: string }> {
  const csv = kamusCsv || DEFAULT_KAMUS;
  const map = new Map<string, { kelas: string; beban: string }>();
  const rows = csv.split("\n");
  for (const row of rows) {
    if (!row || row.trim() === "") continue;
    const cols = row.split(/;|\t/);
    if (cols.length >= 4) {
      map.set(cols[1].trim().toLowerCase(), { kelas: cols[2].trim(), beban: cols[3].trim() });
    }
  }
  return map;
}
