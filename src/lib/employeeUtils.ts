import {
  differenceInMonths,
  differenceInYears,
  addMonths,
  addYears,
  startOfMonth,
} from "date-fns";

export interface NIPExtractionResult {
  tanggalLahir: string | null;
  tmtKerja: string | null;
  jk: "L" | "P" | null;
}

export function validateAndExtractNIP(
  nip: string,
  status: string,
): NIPExtractionResult {
  const result: NIPExtractionResult = {
    tanggalLahir: null,
    tmtKerja: null,
    jk: null,
  };

  const cleanNip = nip.replace(/\D/g, "");
  if (cleanNip.length !== 18) {
    return result;
  }

  // 1. Ekstrak Tanggal Lahir (Digit 1-8)
  const lahirYear = parseInt(cleanNip.substring(0, 4), 10);
  const lahirMonth = parseInt(cleanNip.substring(4, 6), 10);
  const lahirDay = parseInt(cleanNip.substring(6, 8), 10);

  if (
    lahirYear > 1940 &&
    lahirYear <= new Date().getFullYear() &&
    lahirMonth >= 1 &&
    lahirMonth <= 12 &&
    lahirDay >= 1 &&
    lahirDay <= 31
  ) {
    result.tanggalLahir = `${cleanNip.substring(0, 4)}-${cleanNip.substring(4, 6)}-${cleanNip.substring(6, 8)}`;
  }

  // 2. Ekstrak TMT CPNS (Digit 9-14)
  if (status === "PNS" || status === "CPNS") {
    const tmtYear = parseInt(cleanNip.substring(8, 12), 10);
    const tmtMonth = parseInt(cleanNip.substring(12, 14), 10);

    if (
      tmtYear > 1950 &&
      tmtYear <= new Date().getFullYear() &&
      tmtMonth >= 1 &&
      tmtMonth <= 12
    ) {
      result.tmtKerja = `${cleanNip.substring(8, 12)}-${cleanNip.substring(12, 14)}-01`;
    }
  }

  // 3. Ekstrak JK (Digit 15)
  const jkCode = cleanNip.charAt(14);
  if (jkCode === "1") {
    result.jk = "L";
  } else if (jkCode === "2") {
    result.jk = "P";
  }

  return result;
}

/** BUP years from jabatan keywords (domain rule — change only with Umpeg + tests). */
export function getBupYears(jabatan: string): number {
  const jabatanLower = (jabatan || "").toLowerCase();
  if (jabatanLower.includes("utama")) return 65;
  if (
    jabatanLower.includes("madya") ||
    jabatanLower.includes("eselon ii") ||
    jabatanLower.includes("kepala dinas") ||
    jabatanLower.includes("kepala badan")
  ) {
    return 60;
  }
  return 58;
}

/**
 * TMT pensiun: awal bulan setelah ulang tahun BUP (YYYY-MM-DD).
 * Shared by form, export, and dashboard timeline.
 * @param bupTanggalManual if set (YYYY-MM-DD), used as authoritative override.
 */
export function calculateBUP(
  tanggalLahir: string,
  jabatan: string,
  bupTanggalManual?: string | null,
): string | null {
  const manual = (bupTanggalManual || "").trim().slice(0, 10);
  if (manual && /^\d{4}-\d{2}-\d{2}$/.test(manual)) {
    const d = new Date(manual);
    if (!isNaN(d.getTime())) return manual;
  }

  if (!tanggalLahir) return null;

  const birthDate = new Date(tanggalLahir);
  if (isNaN(birthDate.getTime())) return null;

  const bupYears = getBupYears(jabatan);
  const pensiunDate = addYears(birthDate, bupYears);
  const tmtPensiun = addMonths(startOfMonth(pensiunDate), 1);

  const pad = (num: number) => num.toString().padStart(2, "0");

  return `${tmtPensiun.getFullYear()}-${pad(tmtPensiun.getMonth() + 1)}-${pad(tmtPensiun.getDate())}`;
}

/** Display form for golongan (III.A / III-A → III/a). */
export function formatGolonganDisplay(raw: string): string {
  const n = normalizeGolongan(raw || "");
  const m = n.match(/^([IVX]+)\/([A-E])$/);
  if (m) return `${m[1]}/${m[2]!.toLowerCase()}`;
  return (raw || "").trim();
}

export function calculateMasaKerja(startDate: string): string | null {
  if (!startDate) return null;

  const start = new Date(startDate);
  if (isNaN(start.getTime())) return null;

  const now = new Date();

  if (start > now) return "0 Tahun 0 Bulan";

  const years = differenceInYears(now, start);
  const dateAfterYears = addYears(start, years);
  const months = differenceInMonths(now, dateAfterYears);

  return `${years} Tahun ${months} Bulan`;
}

export interface KPStatus {
  /** true bila target sudah lewat (overdue). */
  overdue: boolean;
  /** true bila target jatuh tempo dalam <= warningDays (H-90). */
  due: boolean;
  /** Sisa hari hingga jatuh tempo (negatif bila sudah lewat). */
  daysLeft: number | null;
  /** Tanggal target (KP+4 thn / KGB+2 thn) dalam format YYYY-MM-DD. */
  targetDate: string | null;
}

export interface KPStatusResult {
  warningKP: boolean;
  warningKGB: boolean;
  status: string;
  kp: KPStatus;
  kgb: KPStatus;
  /** true bila tidak ada peringatan apa pun. */
  clear: boolean;
}

export type KgbKpContext = {
  tmtKerja?: string | null;
  status?: string | null;
  gol?: string | null;
  pangkatGolongan?: string | null;
  /** Optional manual base for KP cycle (else tmtGolonganRuang). */
  tmtKp?: string | null;
};

const WARNING_DAYS = 90; // H-90 dianggap "mendekati"

const EMPTY_STATUS: KPStatus = {
  overdue: false,
  due: false,
  daysLeft: null,
  targetDate: null,
};

function toIsoDate(d: Date): string {
  const pad = (num: number) => num.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildStatusFromTarget(target: Date, today: Date = new Date()): KPStatus {
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const targetDay = new Date(target);
  targetDay.setHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (targetDay.getTime() - startOfToday.getTime()) / (1000 * 3600 * 24),
  );

  return {
    overdue: diffDays < 0,
    due: diffDays >= 0 && diffDays <= WARNING_DAYS,
    daysLeft: diffDays,
    targetDate: toIsoDate(targetDay),
  };
}

function buildStatus(
  baseDate: string | null | undefined,
  cycleYears: number,
): KPStatus {
  if (!baseDate) return { ...EMPTY_STATUS };

  const start = new Date(baseDate);
  if (isNaN(start.getTime())) return { ...EMPTY_STATUS };

  const target = addYears(start, cycleYears);
  return buildStatusFromTarget(target);
}

/**
 * Resolve KGB baseline + cycle years.
 * Same rules as dashboard: berkala last → +2y; else first cycle from TMT
 * (PNS II/A or PPPK V first cycle +1y, else +2y).
 */
export function resolveKgbCycle(input: {
  tanggalBerkalaTerakhir?: string | null;
  tmtKerja?: string | null;
  tmtGolonganRuang?: string | null;
  status?: string | null;
  gol?: string | null;
  pangkatGolongan?: string | null;
}): { baseDate: string | null; cycleYears: number; isFirst: boolean } {
  if (input.tanggalBerkalaTerakhir) {
    const d = new Date(input.tanggalBerkalaTerakhir);
    if (!isNaN(d.getTime())) {
      return {
        baseDate: input.tanggalBerkalaTerakhir,
        cycleYears: 2,
        isFirst: false,
      };
    }
  }

  const raw = input.tmtKerja || input.tmtGolonganRuang || null;
  if (!raw) return { baseDate: null, cycleYears: 2, isFirst: true };

  const d = new Date(raw);
  if (isNaN(d.getTime())) return { baseDate: null, cycleYears: 2, isFirst: true };

  const status = input.status || "";
  const golToken = normalizeGolToken(input.gol || input.pangkatGolongan || "");

  // Exact grade only — never use includes("II/A") (matches "III/A" wrongly)
  const isPnsIIa =
    status === "PNS" && (golToken === "II/A" || golToken === "IIA");
  const isPppk5 =
    status === "PPPK" &&
    (golToken === "V" || golToken === "5");

  return {
    baseDate: raw,
    cycleYears: isPnsIIa || isPppk5 ? 1 : 2,
    isFirst: true,
  };
}

/** Normalize golongan for exact compare (II.A / II-A / II/A → II/A). */
export function normalizeGolongan(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\s/g, "")
    .replace(/[.\-]/g, "/");
}

/** @deprecated use normalizeGolongan */
function normalizeGolToken(raw: string): string {
  return normalizeGolongan(raw);
}

/**
 * KP/KGB warnings for list badges, filters, and export.
 * Optional context aligns KGB with dashboard (fallback TMT + first-cycle rules).
 */
export function checkKGBandKP(
  tmtGolonganRuang: string | null | undefined,
  tanggalBerkalaTerakhir: string | null | undefined,
  ctx?: KgbKpContext,
): KPStatusResult {
  // KP base: manual tmtKp wins over tmt golongan (indikatif +4 th)
  const kpBase = (ctx?.tmtKp || "").trim() || tmtGolonganRuang;
  const kp = buildStatus(kpBase, 4);

  const { baseDate, cycleYears } = resolveKgbCycle({
    tanggalBerkalaTerakhir,
    tmtKerja: ctx?.tmtKerja,
    tmtGolonganRuang,
    status: ctx?.status,
    gol: ctx?.gol,
    pangkatGolongan: ctx?.pangkatGolongan,
  });
  const kgb = buildStatus(baseDate, cycleYears);

  const warningKP = kp.due || kp.overdue;
  const warningKGB = kgb.due || kgb.overdue;

  const statuses: string[] = [];
  if (warningKP) statuses.push("Mendekati/Lewat KP (indikatif +4 th)");
  if (warningKGB) statuses.push("Mendekati/Lewat KGB (indikatif)");

  return {
    warningKP,
    warningKGB,
    status: statuses.join(", "),
    kp,
    kgb,
    clear: !warningKP && !warningKGB,
  };
}

/** Render label ringkas untuk badge, mis. "KP ~H-30" (indikatif). */
export function formatKPLabel(kind: "KP" | "KGB", status: KPStatus): string {
  if (status.overdue) return `${kind} lewat*`;
  if (status.due) {
    if (status.daysLeft === null) return `${kind}*`;
    if (status.daysLeft === 0) return `${kind} hari ini*`;
    return `${kind} H-${status.daysLeft}*`;
  }
  return `${kind}*`;
}
