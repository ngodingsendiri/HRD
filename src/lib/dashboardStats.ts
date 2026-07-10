/**
 * Server-safe dashboard aggregations (also usable on the client if needed).
 * Dates are ISO strings for JSON transport.
 */
import type { EmployeeT } from "./schemas.js";

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
  generatedAt: string;
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

const normalizeBidang = normalizeBidangLabel;

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
    let baselineDate: Date | null = null;
    let isFirst = false;

    if (emp.tanggalBerkalaTerakhir) {
      baselineDate = new Date(emp.tanggalBerkalaTerakhir);
    } else {
      const rawDate = emp.tmtKerja || emp.tmtGolonganRuang;
      if (rawDate) {
        baselineDate = new Date(rawDate);
        isFirst = true;
      }
    }
    if (!baselineDate || isNaN(baselineDate.getTime())) continue;

    const nextDate = new Date(baselineDate);
    const status = emp.status || "";
    const golRaw = (emp.gol || emp.pangkatGolongan || "").toUpperCase().replace(/\s/g, "");

    const isPnsIIa =
      status === "PNS" &&
      (golRaw.includes("II/A") || golRaw.includes("II.A") || golRaw === "IIA");
    const isPppk5 =
      status === "PPPK" &&
      (golRaw === "V" || golRaw === "5" || golRaw.includes("/V") || golRaw.includes(".V"));

    if (isFirst && (isPnsIIa || isPppk5)) {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    } else {
      nextDate.setFullYear(nextDate.getFullYear() + 2);
    }

    const diffDays = daysUntil(nextDate, today);
    list.push({
      id: emp.id || emp.nik || emp.nip,
      nama: emp.nama,
      nip: emp.nip,
      status,
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
    "id" | "nik" | "nama" | "nip" | "status" | "gol" | "pangkatGolongan" | "tmtGolonganRuang"
  >[],
): TimelineItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const list: TimelineItem[] = [];

  for (const emp of employees) {
    if (!emp.tmtGolonganRuang) continue;
    const baselineDate = new Date(emp.tmtGolonganRuang);
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
    "id" | "nik" | "nama" | "nip" | "status" | "gol" | "pangkatGolongan" | "tanggalLahir"
  >[],
): TimelineItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const list: TimelineItem[] = [];

  for (const emp of employees) {
    if (!emp.tanggalLahir) continue;
    const baselineDate = new Date(emp.tanggalLahir);
    if (isNaN(baselineDate.getTime())) continue;
    const nextDate = new Date(baselineDate);
    nextDate.setFullYear(nextDate.getFullYear() + 58);
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
      tanggalLahir: emp.tanggalLahir,
    });
  }

  return list.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

/** Build full dashboard payload from employee rows (lean fields enough). */
export function buildDashboardStats(
  employees: Pick<
    EmployeeT,
    | "id"
    | "nik"
    | "nama"
    | "nip"
    | "status"
    | "gol"
    | "pangkatGolongan"
    | "bidang"
    | "tanggalBerkalaTerakhir"
    | "tmtKerja"
    | "tmtGolonganRuang"
    | "tanggalLahir"
  >[],
): DashboardStats {
  const totals = {
    total: employees.length,
    pns: 0,
    cpns: 0,
    pppk: 0,
    pppkpw: 0,
    honorer: 0,
    lainnya: 0,
  };
  const bidangMap: Record<string, number> = {};

  for (const e of employees) {
    if (e.status === "PNS") totals.pns++;
    else if (e.status === "CPNS") totals.cpns++;
    else if (e.status === "PPPK") totals.pppk++;
    else if (e.status === "PPPKPW") totals.pppkpw++;
    else if (e.status === "Honorer") totals.honorer++;
    else totals.lainnya++;

    const bidang = normalizeBidang(e.bidang || "Lainnya");
    bidangMap[bidang] = (bidangMap[bidang] || 0) + 1;
  }

  const byBidang = Object.entries(bidangMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return {
    totals,
    byBidang,
    kgb: buildKgbList(employees),
    kp: buildKpList(employees),
    pensiun: buildPensiunList(employees),
    generatedAt: new Date().toISOString(),
  };
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
