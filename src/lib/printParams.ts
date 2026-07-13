/**
 * Pure helpers for Cetak deep-links and cuti detection (unit-tested).
 */

export type PrintDocKind =
  | "absen_global"
  | "absen_bidang"
  | "tanda_terima"
  | "surat_cuti"
  | "model_dk"
  | "duk";

/** Map ?doc= from URL / deep-links to catalog type. */
export function parseDocParam(raw: string | null): PrintDocKind | null {
  if (!raw) return null;
  const k = raw.trim().toLowerCase().replace(/-/g, "_");
  if (k === "absen" || k === "absensi" || k === "absen_global") return "absen_global";
  if (k === "absen_bidang") return "absen_bidang";
  if (k === "tanda_terima" || k === "tandaterima") return "tanda_terima";
  if (k === "duk") return "duk";
  if (k === "surat_cuti" || k === "cuti") return "surat_cuti";
  if (k === "model_dk" || k === "modeldk" || k === "dk") return "model_dk";
  return null;
}

/**
 * True only for cuti tahunan (label "1. …").
 * Uses digit-boundary so "10. …" is not treated as tahunan.
 */
export function isCutiTahunanJenis(jenis: string): boolean {
  return /^\s*1[.\s]/.test(jenis) && !/^\s*1\d/.test(jenis);
}

/** Match unit label case-insensitively; returns canonical list value if found. */
export function resolveBidangLabel(
  raw: string | null | undefined,
  options: string[],
): string | null {
  const q = (raw || "").trim();
  if (!q || q === "Semua") return null;
  const lower = q.toLowerCase();
  const hit = options.find((b) => b.toLowerCase() === lower);
  return hit ?? null;
}
