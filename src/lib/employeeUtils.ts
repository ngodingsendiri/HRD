import { differenceInMonths, differenceInYears, addMonths, addYears, startOfMonth } from "date-fns";

export interface NIPExtractionResult {
  tanggalLahir: string | null;
  tmtKerja: string | null;
  jk: "L" | "P" | null;
}

export function validateAndExtractNIP(nip: string, status: string): NIPExtractionResult {
  const result: NIPExtractionResult = {
    tanggalLahir: null,
    tmtKerja: null,
    jk: null,
  };

  const cleanNip = nip.replace(/\D/g, '');
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
  if (jkCode === '1') {
    result.jk = "L";
  } else if (jkCode === '2') {
    result.jk = "P";
  }

  return result;
}

export function calculateBUP(tanggalLahir: string, jabatan: string): string | null {
  if (!tanggalLahir) return null;
  
  const birthDate = new Date(tanggalLahir);
  if (isNaN(birthDate.getTime())) return null;

  const jabatanLower = (jabatan || "").toLowerCase();
  
  let bupYears = 58;

  // Cek kata kunci untuk BUP 60 atau 65
  if (
    jabatanLower.includes("madya") || 
    jabatanLower.includes("eselon ii") || 
    jabatanLower.includes("kepala dinas") || 
    jabatanLower.includes("kepala badan")
  ) {
    bupYears = 60;
  } else if (jabatanLower.includes("utama")) {
    bupYears = 65;
  }
  
  // TMT Pensiun adalah awal bulan setelah ulang tahun BUP
  const pensiunDate = addYears(birthDate, bupYears);
  const tmtPensiun = addMonths(startOfMonth(pensiunDate), 1);
  
  const pad = (num: number) => num.toString().padStart(2, '0');
  
  return `${tmtPensiun.getFullYear()}-${pad(tmtPensiun.getMonth() + 1)}-${pad(tmtPensiun.getDate())}`;
}

export function calculateMasaKerja(startDate: string): string | null {
  if (!startDate) return null;

  const start = new Date(startDate);
  if (isNaN(start.getTime())) return null;

  const now = new Date();
  
  if (start > now) return "0 Tahun 0 Bulan";

  let years = differenceInYears(now, start);
  const dateAfterYears = addYears(start, years);
  let months = differenceInMonths(now, dateAfterYears);
  
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

const WARNING_DAYS = 90; // H-90 dianggap "mendekati"

function buildStatus(
  baseDate: string | null | undefined,
  cycleYears: number,
): KPStatus {
  const empty: KPStatus = {
    overdue: false,
    due: false,
    daysLeft: null,
    targetDate: null,
  };
  if (!baseDate) return empty;

  const start = new Date(baseDate);
  if (isNaN(start.getTime())) return empty;

  const target = addYears(start, cycleYears);
  const now = new Date();
  const diffDays = Math.floor(
    (target.getTime() - now.getTime()) / (1000 * 3600 * 24),
  );

  const pad = (num: number) => num.toString().padStart(2, "0");
  const targetStr = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;

  return {
    overdue: diffDays < 0,
    due: diffDays >= 0 && diffDays <= WARNING_DAYS,
    daysLeft: diffDays,
    targetDate: targetStr,
  };
}

export function checkKGBandKP(
  tmtGolonganRuang: string | null | undefined,
  tanggalBerkalaTerakhir: string | null | undefined,
): KPStatusResult {
  const kp = buildStatus(tmtGolonganRuang, 4);
  const kgb = buildStatus(tanggalBerkalaTerakhir, 2);

  const warningKP = kp.due || kp.overdue;
  const warningKGB = kgb.due || kgb.overdue;

  const statuses: string[] = [];
  if (warningKP) statuses.push("Mendekati/Lewat KP (4 Thn)");
  if (warningKGB) statuses.push("Mendekati/Lewat KGB (2 Thn)");

  return {
    warningKP,
    warningKGB,
    status: statuses.join(", "),
    kp,
    kgb,
    clear: !warningKP && !warningKGB,
  };
}

/** Render label ringkas untuk badge, mis. "KP H-30" atau "KGB Lewat". */
export function formatKPLabel(kind: "KP" | "KGB", status: KPStatus): string {
  if (status.overdue) return `${kind} Lewat`;
  if (status.due) {
    if (status.daysLeft === null) return kind;
    if (status.daysLeft === 0) return `${kind} Hari Ini`;
    return `${kind} H-${status.daysLeft}`;
  }
  return kind;
}
