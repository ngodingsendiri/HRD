/**
 * Server-safe dashboard aggregations (also usable on the client if needed).
 * Dates are ISO strings for JSON transport.
 *
 * KP/KGB/BUP rules live in employeeUtils — keep this file as presentation + aggregation.
 */
import type { EmployeeT } from "./schemas.js";
import { calculateBUP, resolveKgbCycle } from "./employeeUtils.js";

export type TimelineItem = {
  id: string;
  nama: string;
  nip: string;
  status: string;
  golongan: string;
  nextDate: string;
  diffDays: number;
  isOverdue: boolean;
  baselineDate?: string;
  isFirst?: boolean;
  tanggalLahir?: string;
};

/** Master-data quality counters for Dashboard “kesehatan data”. */
export type DataHealth = {
  withoutNip: number;
  withoutTmtGol: number;
  jabatanOffKamus: number;
  withoutHp: number;
};

export type DashboardStats = {
  totals: {
    total: number;
    pns: number;
    cpns: number;
    pppk: number;
    pppkpw: number;
    honorer: number;
    lainnya: number;
  };
  byBidang: { name: string; value: number }[];
  kgb: TimelineItem[];
  kp: TimelineItem[];
  pensiun: TimelineItem[];
  health: DataHealth;
  generatedAt: string;
};

export const EMPTY_DATA_HEALTH: DataHealth = {
  withoutNip: 0,
  withoutTmtGol: 0,
  jabatanOffKamus: 0,
  withoutHp: 0,
};

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Merge bidang labels for chart buckets (session + external stats). */
export function normalizeBidangLabel(raw: string): string {
  const b = raw || "Lainnya";
  const lower = b.toLowerCase();
  if (lower.includes("sekretariat")) return "Sekretariat";
  if (lower.includes("infrastruktur")) return "Infrastruktur";
  if (lower.includes("aspirasi")) return "Aspirasi";
  if (lower.includes("smart") || lower.includes("city")) return "Smartcity";
  if (lower.includes("media")) return "Media";
  return b;
}

function daysUntil(target: Date, today: Date): number {
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function buildKgbList(
  employees: Pick<
    EmployeeT,
    | "id"
    | "nik"
    | "nama"
    | "nip"
    | "status"
    | "gol"
    | "pangkatGolongan"
    | "tanggalBerkalaTerakhir"
    | "tmtKerja"
    | "tmtGolonganRuang"
  >[],
): TimelineItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const list: TimelineItem[] = [];

  for (const emp of employees) {
    const { baseDate, cycleYears, isFirst } = resolveKgbCycle({
      tanggalBerkalaTerakhir: emp.tanggalBerkalaTerakhir,
      tmtKerja: emp.tmtKerja,
      tmtGolonganRuang: emp.tmtGolonganRuang,
      status: emp.status,
      gol: emp.gol,
      pangkatGolongan: emp.pangkatGolongan,
    });
    if (!baseDate) continue;

    const baselineDate = new Date(baseDate);
    if (isNaN(baselineDate.getTime())) continue;

    const nextDate = new Date(baselineDate);
    nextDate.setFullYear(nextDate.getFullYear() + cycleYears);

    const diffDays = daysUntil(nextDate, today);
    list.push({
      id: emp.id || emp.nik || emp.nip,
      nama: emp.nama,
      nip: emp.nip,
      status: emp.status || "",
      golongan: emp.pangkatGolongan || emp.gol || "-",
      nextDate: toIso(nextDate),
      diffDays,
      isOverdue: diffDays < 0,
      baselineDate: toIso(baselineDate),
      isFirst,
    });
  }

  return list.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

export function buildKpList(
  employees: Pick<
    EmployeeT,
    | "id"
    | "nik"
    | "nama"
    | "nip"
    | "status"
    | "gol"
    | "pangkatGolongan"
    | "tmtGolonganRuang"
    | "tmtKp"
  >[],
): TimelineItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const list: TimelineItem[] = [];

  for (const emp of employees) {
    const base = (emp.tmtKp || emp.tmtGolonganRuang || "").trim();
    if (!base) continue;
    const baselineDate = new Date(base);
    if (isNaN(baselineDate.getTime())) continue;
    const nextDate = new Date(baselineDate);
    nextDate.setFullYear(nextDate.getFullYear() + 4);
    const diffDays = daysUntil(nextDate, today);
    list.push({
      id: emp.id || emp.nik || emp.nip,
      nama: emp.nama,
      nip: emp.nip,
      status: emp.status || "",
      golongan: emp.pangkatGolongan || emp.gol || "-",
      nextDate: toIso(nextDate),
      diffDays,
      isOverdue: diffDays < 0,
      baselineDate: toIso(baselineDate),
    });
  }

  return list.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

export function buildPensiunList(
  employees: Pick<
    EmployeeT,
    | "id"
    | "nik"
    | "nama"
    | "nip"
    | "status"
    | "gol"
    | "pangkatGolongan"
    | "tanggalLahir"
    | "jabatan"
    | "bupTanggal"
  >[],
): TimelineItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const list: TimelineItem[] = [];

  for (const emp of employees) {
    if (!emp.tanggalLahir && !emp.bupTanggal) continue;
    const nextStr = calculateBUP(
      emp.tanggalLahir || "",
      emp.jabatan || "",
      emp.bupTanggal,
    );
    if (!nextStr) continue;
    const nextDate = new Date(nextStr);
    if (isNaN(nextDate.getTime())) continue;

    const diffDays = daysUntil(nextDate, today);
    list.push({
      id: emp.id || emp.nik || emp.nip,
      nama: emp.nama,
      nip: emp.nip,
      status: emp.status || "",
      golongan: emp.pangkatGolongan || emp.gol || "-",
      nextDate: nextStr,
      diffDays,
      isOverdue: diffDays < 0,
      tanggalLahir: emp.tanggalLahir,
    });
  }

  return list.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

/**
 * Count incomplete / risky master-data rows for Dashboard.
 * kamusLookup: (jabatan) => true if found in kamus.
 */
export function buildDataHealth(
  rows: {
    nip?: string | null;
    tmtGolonganRuang?: string | null;
    jabatan?: string | null;
    nomorHp?: string | null;
    status?: string | null;
  }[],
  kamusLookup: (jabatan: string) => boolean,
): DataHealth {
  let withoutNip = 0;
  let withoutTmtGol = 0;
  let jabatanOffKamus = 0;
  let withoutHp = 0;
  for (const r of rows) {
    if (!(r.nip || "").replace(/\D/g, "")) withoutNip++;
    // TMT gol mainly for ASN with rank track
    const st = (r.status || "").toUpperCase();
    if (
      (st === "PNS" || st === "CPNS" || st === "PPPK" || st === "PPPKPW") &&
      !(r.tmtGolonganRuang || "").trim()
    ) {
      withoutTmtGol++;
    }
    const jab = (r.jabatan || "").trim();
    if (jab && !kamusLookup(jab)) jabatanOffKamus++;
    if (!(r.nomorHp || "").trim()) withoutHp++;
  }
  return { withoutNip, withoutTmtGol, jabatanOffKamus, withoutHp };
}

export function formatRelativeTime(diffDays: number): string {
  if (diffDays === 0) return "Hari ini";
  if (diffDays < 0) {
    const abs = Math.abs(diffDays);
    if (abs > 365) return `Lewat ${Math.floor(abs / 365)} tahun`;
    if (abs > 30) return `Lewat ${Math.floor(abs / 30)} bulan`;
    return `Lewat ${abs} hari`;
  }
  if (diffDays > 365)
    return `Dalam ${Math.floor(diffDays / 365)} tahun, ${Math.floor((diffDays % 365) / 30)} bln`;
  if (diffDays > 30) return `Dalam ${Math.floor(diffDays / 30)} bulan, ${diffDays % 30} hr`;
  return `Dalam ${diffDays} hari`;
}
