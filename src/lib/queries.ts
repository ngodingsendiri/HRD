/**
 * Data access layer — the ONLY place that touches Prisma directly.
 * Computed fields (masaKerja, kelasJabatan, bebanKerja, pensiun) are attached
 * at read time, never persisted.
 */
import { prisma } from "./db.js";
import {
  EmployeeSchema,
  AppSettingsSchema,
  type EmployeeT,
  type AppSettingsT,
  type FamilyMemberT,
} from "./schemas.js";
import { DEFAULT_KAMUS } from "../constants.js";
import { calculateMasaKerja, checkKGBandKP } from "./employeeUtils.js";
import { invalidateEmployeeStatsCache } from "./buildEmployeeStats.js";
import { invalidateKamusLookupCache, lookupKamus } from "./kamus.js";
import {
  hasFamilyKeys,
  kamusWarningForJabatan,
  mergeEmployeePatch,
  mergeFamilyPatch,
  normalizeEmployeeForImport,
  type ImportMode,
} from "./employeeImport.js";

// --- Internal: map a Prisma row to the app Employee shape ---
type PrismaEmployee = {
  id: string;
  [k: string]: unknown;
  dataKeluarga: unknown;
};

function toEpochMs(value: unknown): number | undefined {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : undefined;
  }
  return undefined;
}

const VALID_STATUS = new Set([
  "PNS",
  "CPNS",
  "PPPK",
  "PPPKPW",
  "Honorer",
  "Lainnya",
]);

/** Fast read mapper — no Zod (validation is for writes only). */
function mapRow(row: PrismaEmployee, kamusCsv?: string, lean = false): EmployeeT {
  const statusRaw = String(row.status ?? "Lainnya");
  const status = (VALID_STATUS.has(statusRaw) ? statusRaw : "Lainnya") as EmployeeT["status"];
  const jabatan = String(row.jabatan ?? "");
  const { kelas, beban } = lookupKamus(jabatan, kamusCsv);

  const emp = {
    id: String(row.id),
    nik: String(row.nik ?? ""),
    nama: String(row.nama ?? ""),
    nip: String(row.nip ?? ""),
    jk: (row.jk === "P" ? "P" : "L") as "L" | "P",
    tempatLahir: String(row.tempatLahir ?? ""),
    tanggalLahir: String(row.tanggalLahir ?? ""),
    jalanDusun: lean ? "" : String(row.jalanDusun ?? ""),
    rt: lean ? "" : String(row.rt ?? ""),
    rw: lean ? "" : String(row.rw ?? ""),
    desaKelurahan: lean ? "" : String(row.desaKelurahan ?? ""),
    kecamatan: lean ? "" : String(row.kecamatan ?? ""),
    kabupaten: lean ? "" : String(row.kabupaten ?? ""),
    jabatan,
    bidang: String(row.bidang ?? ""),
    status,
    tmtKerja: String(row.tmtKerja ?? ""),
    pangkat: String(row.pangkat ?? ""),
    gol: String(row.gol ?? ""),
    pangkatGolongan: String(row.pangkatGolongan ?? ""),
    tmtGolonganRuang: String(row.tmtGolonganRuang ?? ""),
    masaKerjaGolonganRuang: String(row.masaKerjaGolonganRuang ?? ""),
    tanggalBerkalaTerakhir: String(row.tanggalBerkalaTerakhir ?? ""),
    bupTanggal: String(row.bupTanggal ?? ""),
    tmtKp: String(row.tmtKp ?? ""),
    gajiPokok: lean ? "" : String(row.gajiPokok ?? ""),
    besaranGajiKotor: lean ? "" : String(row.besaranGajiKotor ?? ""),
    digajiMenurut: lean ? "" : String(row.digajiMenurut ?? ""),
    noRekeningBank: lean ? "" : String(row.noRekeningBank ?? ""),
    npwp: lean ? "" : String(row.npwp ?? ""),
    nomorKarpeg: lean ? "" : String(row.nomorKarpeg ?? ""),
    pendidikan: lean ? "" : String(row.pendidikan ?? ""),
    jurusan: lean ? "" : String(row.jurusan ?? ""),
    diklatJenjang: lean ? "" : String(row.diklatJenjang ?? ""),
    tahunDiklat: lean ? "" : String(row.tahunDiklat ?? ""),
    statusKawin: lean ? "" : String(row.statusKawin ?? ""),
    agama: lean ? "" : String(row.agama ?? ""),
    nomorHp: String(row.nomorHp ?? ""),
    sisaCutiN: lean ? "" : String(row.sisaCutiN ?? ""),
    sisaCutiN1: lean ? "" : String(row.sisaCutiN1 ?? ""),
    sisaCutiN2: lean ? "" : String(row.sisaCutiN2 ?? ""),
    skTerakhir: lean ? "" : String(row.skTerakhir ?? ""),
    jumlahTertanggung: Number(row.jumlahTertanggung ?? 0),
    dataKeluarga: lean ? [] : ((row.dataKeluarga as FamilyMemberT[]) ?? []),
    createdAt: toEpochMs(row.createdAt),
    updatedAt: toEpochMs(row.updatedAt),
    masaKerja: "",
    kelasJabatan: kelas,
    bebanKerja: beban,
  } as EmployeeT;

  (emp as EmployeeT & { masaKerja: string }).masaKerja = computeMasaKerja(emp) ?? "";
  return emp;
}

/** @deprecated use mapRow — kept name for call sites that need full fidelity */
function rowToEmployee(row: PrismaEmployee, kamusCsv?: string): EmployeeT {
  return mapRow(row, kamusCsv, false);
}

/** Columns needed for list UI + KP/KGB badges */
const LEAN_SELECT = {
  id: true,
  nik: true,
  nama: true,
  nip: true,
  jk: true,
  tanggalLahir: true,
  jabatan: true,
  bidang: true,
  status: true,
  tmtKerja: true,
  pangkat: true,
  gol: true,
  pangkatGolongan: true,
  tmtGolonganRuang: true,
  masaKerjaGolonganRuang: true,
  tanggalBerkalaTerakhir: true,
  bupTanggal: true,
  tmtKp: true,
  nomorHp: true,
  jumlahTertanggung: true,
  createdAt: true,
  updatedAt: true,
} as const;

function computeMasaKerja(emp: EmployeeT): string | null {
  const statusVal = (emp.status || "").toUpperCase();
  if ((statusVal === "PNS" || statusVal === "CPNS") && emp.nip) {
    const clean = emp.nip.replace(/\D/g, "");
    if (clean.length >= 14) {
      const y = parseInt(clean.substring(8, 12), 10);
      const m = parseInt(clean.substring(12, 14), 10);
      const now = new Date();
      if (!isNaN(y) && !isNaN(m) && y > 1900 && y <= now.getFullYear() && m >= 1 && m <= 12) {
        let years = now.getFullYear() - y;
        let months = now.getMonth() + 1 - m;
        if (months < 0) {
          years--;
          months += 12;
        }
        return `${years} Tahun ${months} Bulan`;
      }
    }
  }
  if (emp.tmtKerja) return calculateMasaKerja(emp.tmtKerja);
  return null;
}

// ============ Kamus helper (from settings) ============

let kamusCache: { value: string; expires: number } | null = null;
const KAMUS_TTL_MS = 60_000;

/** Resolve jabatan kamus CSV — cached 60s in-process (serverless warm reuse). */
export async function getKamusCsv(): Promise<string> {
  if (kamusCache && kamusCache.expires > Date.now()) {
    return kamusCache.value;
  }
  const settings = await getSettings({ include: ["kamus"] });
  const value = settings.jabatanKamusCsv || DEFAULT_KAMUS;
  kamusCache = { value, expires: Date.now() + KAMUS_TTL_MS };
  return value;
}

export function invalidateKamusCache(): void {
  kamusCache = null;
  invalidateKamusLookupCache();
}

// ============ Employees ============

export interface GetEmployeesOptions {
  q?: string;
  limit?: number;
  offset?: number;
  /** When true, strip heavy fields + use lean select. */
  lean?: boolean;
  /** Override kamus; if omitted, load from settings (cached). */
  kamusCsv?: string;
  /** Exact status match e.g. PNS */
  status?: string;
  /** Server-side alert filter (uses date columns). */
  alert?: "kp" | "kgb" | "any";
}

export interface EmployeesPage {
  data: EmployeeT[];
  total: number;
  limit: number;
  offset: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 500;

function buildEmployeeWhere(opts?: GetEmployeesOptions) {
  const q = opts?.q?.trim();
  const status = opts?.status?.trim();
  const and: object[] = [];
  if (q) {
    and.push({
      OR: [
        { nama: { contains: q, mode: "insensitive" as const } },
        { nip: { contains: q, mode: "insensitive" as const } },
        { nik: { contains: q, mode: "insensitive" as const } },
        { jabatan: { contains: q, mode: "insensitive" as const } },
        { bidang: { contains: q, mode: "insensitive" as const } },
      ],
    });
  }
  if (status && status !== "all" && VALID_STATUS.has(status)) {
    and.push({ status });
  }
  if (!and.length) return undefined;
  return and.length === 1 ? and[0] : { AND: and };
}

function matchesAlert(
  emp: {
    tmtGolonganRuang?: string | null;
    tanggalBerkalaTerakhir?: string | null;
    tmtKerja?: string | null;
    status?: string | null;
    gol?: string | null;
    pangkatGolongan?: string | null;
    tmtKp?: string | null;
  },
  alert: "kp" | "kgb" | "any",
): boolean {
  const { kp, kgb, clear } = checkKGBandKP(
    emp.tmtGolonganRuang,
    emp.tanggalBerkalaTerakhir,
    {
      tmtKerja: emp.tmtKerja,
      status: emp.status,
      gol: emp.gol,
      pangkatGolongan: emp.pangkatGolongan,
      tmtKp: emp.tmtKp,
    },
  );
  if (alert === "any") return !clear;
  if (alert === "kp") return kp.due || kp.overdue;
  if (alert === "kgb") return kgb.due || kgb.overdue;
  return true;
}

export async function getEmployeesPage(opts?: GetEmployeesOptions): Promise<EmployeesPage> {
  const limit = Math.min(Math.max(opts?.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
  const offset = Math.max(opts?.offset ?? 0, 0);
  const lean = opts?.lean !== false; // default lean for list
  const alert = opts?.alert;
  const where = buildEmployeeWhere(opts);
  const kamusCsv = opts?.kamusCsv ?? (await getKamusCsv());

  // Alert filter needs date scan then page — still select only slim columns
  if (alert && alert !== ("all" as string)) {
    const candidates = await prisma.employee.findMany({
      where: where as never,
      select: {
        id: true,
        tmtGolonganRuang: true,
        tanggalBerkalaTerakhir: true,
        tmtKerja: true,
        status: true,
        gol: true,
        pangkatGolongan: true,
        tmtKp: true,
      },
      orderBy: { nama: "asc" },
      take: 5000,
    });
    const matchedIds = candidates
      .filter((c) => matchesAlert(c, alert))
      .map((c) => c.id);
    const total = matchedIds.length;
    const pageIds = matchedIds.slice(offset, offset + limit);
    if (!pageIds.length) {
      return { data: [], total, limit, offset };
    }
    const rows = await prisma.employee.findMany({
      where: { id: { in: pageIds } },
      ...(lean ? { select: LEAN_SELECT } : {}),
      orderBy: { nama: "asc" },
    });
    // Preserve order of pageIds
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = pageIds
      .map((id) => byId.get(id))
      .filter(Boolean) as PrismaEmployee[];
    const data = ordered.map((r) => mapRow(r, kamusCsv, lean));
    return { data, total, limit, offset };
  }

  const [total, rows] = await Promise.all([
    prisma.employee.count({ where: where as never }),
    prisma.employee.findMany({
      where: where as never,
      orderBy: { nama: "asc" },
      take: limit,
      skip: offset,
      ...(lean ? { select: LEAN_SELECT } : {}),
    }),
  ]);

  const data = rows.map((r) =>
    mapRow(r as unknown as PrismaEmployee, kamusCsv, lean),
  );

  return { data, total, limit, offset };
}

export async function getEmployee(id: string, kamusCsv?: string): Promise<EmployeeT | null> {
  const row = await prisma.employee.findUnique({ where: { id } });
  if (!row) return null;
  const kamus = kamusCsv ?? (await getKamusCsv());
  return rowToEmployee(row as unknown as PrismaEmployee, kamus);
}

export async function findEmployeeIdByNipOrNik(
  nip?: string | null,
  nik?: string | null,
  excludeId?: string,
): Promise<string | null> {
  // Canonical digits-only (matches EmployeeSchema storage)
  const nipKey = (nip ?? "").replace(/\D/g, "");
  const nikKey = (nik ?? "").replace(/\D/g, "");
  if (!nipKey && !nikKey) return null;

  const or: Array<{ nip?: string; nik?: string }> = [];
  if (nipKey) or.push({ nip: nipKey });
  if (nikKey) or.push({ nik: nikKey });

  const row = await prisma.employee.findFirst({
    where: {
      OR: or,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  return row?.id ?? null;
}

function toPersistence(emp: Partial<EmployeeT>) {
  const { masaKerja, kelasJabatan, bebanKerja, pensiun, id, createdAt, updatedAt, ...rest } =
    emp as Record<string, unknown>;
  void masaKerja;
  void kelasJabatan;
  void bebanKerja;
  void pensiun;
  void id;
  void createdAt;
  void updatedAt;
  return rest;
}

export async function createEmployee(emp: EmployeeT): Promise<EmployeeT> {
  const created = await prisma.employee.create({ data: toPersistence(emp) as never });
  invalidateEmployeeStatsCache();
  return rowToEmployee(created as unknown as PrismaEmployee, await getKamusCsv());
}

export async function updateEmployee(id: string, emp: Partial<EmployeeT>): Promise<EmployeeT> {
  const updated = await prisma.employee.update({
    where: { id },
    data: toPersistence(emp) as never,
  });
  invalidateEmployeeStatsCache();
  return rowToEmployee(updated as unknown as PrismaEmployee, await getKamusCsv());
}

export async function deleteEmployee(id: string): Promise<void> {
  await prisma.employee.delete({ where: { id } });
  invalidateEmployeeStatsCache();
}

export async function deleteEmployees(ids: string[]): Promise<void> {
  await prisma.employee.deleteMany({ where: { id: { in: ids } } });
  invalidateEmployeeStatsCache();
}

export type BulkImportError = {
  row: number;
  nip?: string;
  nik?: string;
  nama?: string;
  message: string;
};

export type BulkImportWarning = {
  row: number;
  nip?: string;
  nama?: string;
  message: string;
};

export type BulkUpsertOptions = {
  mode?: ImportMode;
  dryRun?: boolean;
};

export type BulkUpsertResult = {
  created: number;
  updated: number;
  errors: number;
  errorDetails: BulkImportError[];
  warnings: BulkImportWarning[];
  dryRun: boolean;
  mode: ImportMode;
};

const BULK_CHUNK = 40;

/**
 * Bulk import with per-row errors and chunked transactions.
 * Match key: NIP first, else NIK.
 * mode patch (default): merge non-empty cells onto existing.
 * mode replace: full row overwrite.
 * dryRun: validate + count only, no writes.
 */
export async function bulkUpsertEmployees(
  rows: Record<string, unknown>[],
  opts?: BulkUpsertOptions,
): Promise<BulkUpsertResult> {
  const mode: ImportMode = opts?.mode === "replace" ? "replace" : "patch";
  const dryRun = Boolean(opts?.dryRun);
  let created = 0;
  let updated = 0;
  const errorDetails: BulkImportError[] = [];
  const warnings: BulkImportWarning[] = [];
  const kamusCsv = await getKamusCsv();

  const existingByNip = new Map<string, string>();
  const existingByNik = new Map<string, string>();
  const all = await prisma.employee.findMany({
    select: { id: true, nip: true, nik: true },
  });
  for (const e of all) {
    const nip = String(e.nip ?? "").replace(/\D/g, "") || String(e.nip ?? "").trim();
    const nik = String(e.nik ?? "").replace(/\D/g, "") || String(e.nik ?? "").trim();
    if (nip) existingByNip.set(nip, e.id);
    if (nik) existingByNik.set(nik, e.id);
  }

  type Op =
    | {
        kind: "create";
        row: number;
        data: Record<string, unknown>;
        nipKey: string;
        nikKey: string;
        nama: string;
      }
    | {
        kind: "update";
        row: number;
        id: string;
        data: Record<string, unknown>;
        nipKey: string;
        nikKey: string;
        nama: string;
      };

  const ops: Op[] = [];
  const seenNip = new Set<string>();
  const seenNik = new Set<string>();

  // Pre-resolve match ids so patch can batch-load existing rows (no N+1)
  type RowPlan = {
    rowNum: number;
    raw: Record<string, unknown>;
    existingId?: string;
    peekNip: string;
    peekNik: string;
  };
  const plans: RowPlan[] = rows.map((raw, i) => {
    const peekNip = String(raw.nip ?? "").replace(/\D/g, "");
    const peekNik = String(raw.nik ?? "").replace(/\D/g, "");
    const existingId =
      (peekNip && existingByNip.get(peekNip)) ||
      (peekNik && existingByNik.get(peekNik)) ||
      undefined;
    return {
      rowNum: i + 1,
      raw: raw as Record<string, unknown>,
      existingId,
      peekNip,
      peekNik,
    };
  });

  const patchIds = [
    ...new Set(
      plans
        .filter((p) => p.existingId && mode === "patch")
        .map((p) => p.existingId!),
    ),
  ];
  const existingFullById = new Map<string, Record<string, unknown>>();
  if (patchIds.length > 0) {
    const fullRows = await prisma.employee.findMany({
      where: { id: { in: patchIds } },
    });
    for (const row of fullRows) {
      const emp = mapRow(row as unknown as PrismaEmployee, kamusCsv, false);
      existingFullById.set(row.id, emp as unknown as Record<string, unknown>);
    }
  }

  for (const plan of plans) {
    const { rowNum, raw, existingId, peekNip, peekNik } = plan;
    const isCreate = !existingId;
    // patch+create and replace both need full shape; patch+update is sparse merge
    const norm = normalizeEmployeeForImport(raw, {
      mode,
      full: isCreate || mode === "replace",
    });

    if (!norm.ok) {
      errorDetails.push({
        row: rowNum,
        nip: norm.nip,
        nik: norm.nik,
        nama: norm.nama,
        message: norm.error,
      });
      continue;
    }

    for (const w of norm.warnings) {
      warnings.push({
        row: rowNum,
        nip: String(norm.data.nip || peekNip || ""),
        nama: String(norm.data.nama || ""),
        message: w,
      });
    }

    let finalData: Record<string, unknown> = norm.data;

    if (existingId && mode === "patch") {
      const existingEmp = existingFullById.get(existingId);
      if (!existingEmp) {
        errorDetails.push({
          row: rowNum,
          message: "Pegawai match hilang saat merge",
        });
        continue;
      }
      finalData = mergeEmployeePatch(existingEmp, norm.data);
      // If only pangkat or gol patched, rebuild composite from merged pair
      if (
        ("pangkat" in raw || "gol" in raw) &&
        !("pangkatGolongan" in raw)
      ) {
        const p = String(finalData.pangkat || "").trim();
        const g = String(finalData.gol || "").trim();
        finalData.pangkatGolongan = [p, g].filter(Boolean).join(" / ");
      }
      // Flat family columns: merge slots so partial spouse/child edits keep the rest
      if (hasFamilyKeys(raw) && !Array.isArray(raw.dataKeluarga)) {
        const jk = (String(finalData.jk || existingEmp.jk || "L") === "P"
          ? "P"
          : "L") as "L" | "P";
        const existingFam = Array.isArray(existingEmp.dataKeluarga)
          ? (existingEmp.dataKeluarga as FamilyMemberT[])
          : [];
        finalData.dataKeluarga = mergeFamilyPatch(existingFam, raw, jk);
        if (!("jumlahTertanggung" in raw)) {
          finalData.jumlahTertanggung = (
            finalData.dataKeluarga as FamilyMemberT[]
          ).length;
        }
      }
    }

    const parsed = EmployeeSchema.safeParse(finalData);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      errorDetails.push({
        row: rowNum,
        nip: String(finalData.nip || ""),
        nik: String(finalData.nik || ""),
        nama: String(finalData.nama || ""),
        message: first
          ? `${first.path.join(".") || "data"}: ${first.message}`
          : "Data tidak valid",
      });
      continue;
    }

    const emp = parsed.data;
    const nipKey = (emp.nip || "").replace(/\D/g, "") || emp.nip?.trim() || "";
    const nikKey = (emp.nik || "").replace(/\D/g, "") || emp.nik?.trim() || "";
    if (!nipKey && !nikKey) {
      errorDetails.push({
        row: rowNum,
        nama: emp.nama,
        message: "NIP atau NIK wajib diisi untuk match impor",
      });
      continue;
    }

    // In-file duplicates
    if (nipKey && seenNip.has(nipKey)) {
      errorDetails.push({
        row: rowNum,
        nip: nipKey,
        nama: emp.nama,
        message: `NIP duplikat dalam file (sudah ada di baris sebelumnya)`,
      });
      continue;
    }
    if (nikKey && seenNik.has(nikKey)) {
      errorDetails.push({
        row: rowNum,
        nik: nikKey,
        nama: emp.nama,
        message: `NIK duplikat dalam file (sudah ada di baris sebelumnya)`,
      });
      continue;
    }
    if (nipKey) seenNip.add(nipKey);
    if (nikKey) seenNik.add(nikKey);

    const kw = kamusWarningForJabatan(emp.jabatan, kamusCsv);
    if (kw) {
      warnings.push({
        row: rowNum,
        nip: nipKey,
        nama: emp.nama,
        message: kw,
      });
    }

    const data = toPersistence(emp) as Record<string, unknown>;
    const matchId =
      existingId ||
      (nipKey && existingByNip.get(nipKey)) ||
      (nikKey && existingByNik.get(nikKey)) ||
      undefined;

    if (matchId) {
      ops.push({
        kind: "update",
        row: rowNum,
        id: matchId,
        data,
        nipKey,
        nikKey,
        nama: emp.nama,
      });
    } else {
      ops.push({
        kind: "create",
        row: rowNum,
        data,
        nipKey,
        nikKey,
        nama: emp.nama,
      });
    }
  }

  if (dryRun) {
    return {
      created: ops.filter((o) => o.kind === "create").length,
      updated: ops.filter((o) => o.kind === "update").length,
      errors: errorDetails.length,
      errorDetails: errorDetails.slice(0, 50),
      warnings: warnings.slice(0, 50),
      dryRun: true,
      mode,
    };
  }

  for (let i = 0; i < ops.length; i += BULK_CHUNK) {
    const chunk = ops.slice(i, i + BULK_CHUNK);
    try {
      await prisma.$transaction(
        chunk.map((op) => {
          if (op.kind === "update") {
            return prisma.employee.update({
              where: { id: op.id },
              data: op.data as never,
            });
          }
          return prisma.employee.create({ data: op.data as never });
        }),
      );
      for (const op of chunk) {
        if (op.kind === "update") updated++;
        else created++;
      }
      if (chunk.some((c) => c.kind === "create")) {
        const createdNips = chunk
          .filter((c) => c.kind === "create" && c.nipKey)
          .map((c) => c.nipKey);
        const createdNiks = chunk
          .filter((c) => c.kind === "create" && c.nikKey)
          .map((c) => c.nikKey);
        if (createdNips.length || createdNiks.length) {
          const fresh = await prisma.employee.findMany({
            where: {
              OR: [
                ...(createdNips.length ? [{ nip: { in: createdNips } }] : []),
                ...(createdNiks.length ? [{ nik: { in: createdNiks } }] : []),
              ],
            },
            select: { id: true, nip: true, nik: true },
          });
          for (const e of fresh) {
            const n = String(e.nip ?? "").replace(/\D/g, "");
            const k = String(e.nik ?? "").replace(/\D/g, "");
            if (n) existingByNip.set(n, e.id);
            if (k) existingByNik.set(k, e.id);
          }
        }
      }
    } catch {
      for (const op of chunk) {
        try {
          if (op.kind === "update") {
            await prisma.employee.update({
              where: { id: op.id },
              data: op.data as never,
            });
            updated++;
          } else {
            const created_row = await prisma.employee.create({
              data: op.data as never,
            });
            if (op.nipKey) existingByNip.set(op.nipKey, created_row.id);
            if (op.nikKey) existingByNik.set(op.nikKey, created_row.id);
            created++;
          }
        } catch (err) {
          errorDetails.push({
            row: op.row,
            nip: op.nipKey,
            nik: op.nikKey,
            nama: op.nama,
            message:
              err instanceof Error
                ? err.message.includes("Unique")
                  ? "NIP/NIK bentrok (unique constraint)"
                  : "Gagal menyimpan baris"
                : "Gagal menyimpan baris",
          });
        }
      }
    }
  }

  if (created > 0 || updated > 0) {
    invalidateEmployeeStatsCache();
  }

  return {
    created,
    updated,
    errors: errorDetails.length,
    errorDetails: errorDetails.slice(0, 50),
    warnings: warnings.slice(0, 50),
    dryRun: false,
    mode,
  };
}

// ============ Settings ============

const SETTINGS_DEFAULT: AppSettingsT = {
  sekdaNama: "",
  sekdaNip: "",
  bupatiNama: "",
  kopLine1: "",
  kopLine2: "",
  kopLine3: "",
  kopLine4: "",
  logoBase64: "",
  jabatanKamusCsv: DEFAULT_KAMUS,
  petaJabatanCsv: "",
};

export type SettingsInclude = "core" | "logo" | "kamus" | "peta" | "all";

export async function getSettings(opts?: {
  include?: SettingsInclude[];
}): Promise<AppSettingsT> {
  const include = opts?.include?.length ? opts.include : (["all"] as SettingsInclude[]);
  const wantAll = include.includes("all");
  const wantCore = wantAll || include.includes("core");
  const wantLogo = wantAll || include.includes("logo");
  const wantKamus = wantAll || include.includes("kamus");
  const wantPeta = wantAll || include.includes("peta");

  const row = await prisma.settings.findUnique({ where: { id: "app" } });
  let full: AppSettingsT = SETTINGS_DEFAULT;
  if (row) {
    const parsed = AppSettingsSchema.safeParse(row.data);
    full = parsed.success
      ? { ...SETTINGS_DEFAULT, ...parsed.data }
      : { ...SETTINGS_DEFAULT, ...(row.data as object) };
  }

  // Project fields to keep payloads small for callers that only need a slice.
  const out: AppSettingsT = {
    sekdaNama: wantCore ? full.sekdaNama : "",
    sekdaNip: wantCore ? full.sekdaNip : "",
    bupatiNama: wantCore ? full.bupatiNama : "",
    kopLine1: wantCore ? full.kopLine1 : "",
    kopLine2: wantCore ? full.kopLine2 : "",
    kopLine3: wantCore ? full.kopLine3 : "",
    kopLine4: wantCore ? full.kopLine4 : "",
    logoBase64: wantLogo ? full.logoBase64 || "" : "",
    jabatanKamusCsv: wantKamus ? full.jabatanKamusCsv || DEFAULT_KAMUS : "",
    petaJabatanCsv: wantPeta ? full.petaJabatanCsv || "" : "",
  };

  // When only kamus requested, still return usable default
  if (wantKamus && !out.jabatanKamusCsv) out.jabatanKamusCsv = DEFAULT_KAMUS;

  return out;
}

export async function upsertSettings(settings: AppSettingsT): Promise<AppSettingsT> {
  // Merge with existing so partial clients don't wipe logo/kamus accidentally
  const existing = await getSettings({ include: ["all"] });
  const merged: AppSettingsT = {
    ...existing,
    ...settings,
    // Preserve large blobs if caller sent empty string while meaning "omit"
    logoBase64:
      settings.logoBase64 === undefined ? existing.logoBase64 : settings.logoBase64,
    jabatanKamusCsv:
      settings.jabatanKamusCsv === undefined || settings.jabatanKamusCsv === ""
        ? existing.jabatanKamusCsv || DEFAULT_KAMUS
        : settings.jabatanKamusCsv,
    petaJabatanCsv:
      settings.petaJabatanCsv === undefined
        ? existing.petaJabatanCsv
        : settings.petaJabatanCsv,
  };

  await prisma.settings.upsert({
    where: { id: "app" },
    create: { id: "app", data: merged as never },
    update: { data: merged as never },
  });
  invalidateKamusCache();
  return merged;
}
