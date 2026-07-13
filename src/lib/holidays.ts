/**
 * Indonesian public holidays (YYYY-MM-DD).
 *
 * Centralized here so it's easy to update each year. Update from
 * https://www.tanggalmerah.com/ or official sources annually.
 *
 * NOTE: these are national (common) holidays. Local/religious observances
 * may differ; add as needed.
 */
export const PUBLIC_HOLIDAYS: string[] = [
  // 2024
  "2024-01-01", "2024-02-08", "2024-02-09", "2024-02-10",
  "2024-03-11", "2024-03-12", "2024-03-29", "2024-03-31",
  "2024-04-10", "2024-04-11", "2024-05-01", "2024-05-09",
  "2024-05-23", "2024-06-01", "2024-06-17", "2024-07-07",
  "2024-08-17", "2024-09-16", "2024-12-25",
  // 2025
  "2025-01-01", "2025-01-27", "2025-03-29", "2025-03-31",
  "2025-04-18", "2025-05-01", "2025-05-12", "2025-05-29",
  "2025-06-01", "2025-06-27", "2025-08-17", "2025-09-05",
  "2025-12-25",
  // 2026
  "2026-01-01", "2026-02-17", "2026-03-19", "2026-03-20",
  "2026-04-03", "2026-05-01", "2026-05-14", "2026-06-01",
  "2026-06-16", "2026-08-17", "2026-12-25",
];

/** Parse YYYY-MM-DD as local calendar date (avoids UTC day-shift). */
function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** Count working days between two dates (inclusive), excluding weekends + holidays. */
export function countWorkingDays(start: string, end: string): number {
  const startD = parseLocalDate(start);
  const endD = parseLocalDate(end);
  if (!startD || !endD || startD > endD) return 0;

  const holidaySet = new Set(PUBLIC_HOLIDAYS);
  let count = 0;
  const cur = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate());
  const endTime = endD.getTime();
  while (cur.getTime() <= endTime) {
    const day = cur.getDay();
    const ds = toLocalYmd(cur);
    if (day !== 0 && day !== 6 && !holidaySet.has(ds)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
