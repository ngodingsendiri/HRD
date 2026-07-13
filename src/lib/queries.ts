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
import { lookupKamus } from "./kamus.js";
import { normalizeEmployeeForImport } from "./employeeImport.js";

export { lookupKamus };

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

/** @deprecated Prefer getEmployeesPage — kept for simple internal callers. */
export async function getEmployees(
  kamusCsv?: string,
  opts?: GetEmployeesOptions,
): Promise<EmployeeT[]> {
  const page = await getEmployeesPage({
    ...opts,
    kamusCsv: kamusCsv ?? opts?.kamusCsv,
    limit: opts?.limit ?? MAX_LIST_LIMIT,
    offset: opts?.offset ?? 0,
  });
  return page.data;
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
  return rowToEmployee(created as unknown as PrismaEmployee, await getKamusCsv());
}

export async function updateEmployee(id: string, emp: Partial<EmployeeT>): Promise<EmployeeT> {
  const updated = await prisma.employee.update({
    where: { id },
    data: toPersistence(emp) as never,
  });
  return rowToEmployee(updated as unknown as PrismaEmployee, await getKamusCsv());
}

export async function deleteEmployee(id: string): Promise<void> {
  await prisma.employee.delete({ where: { id } });
}

export async function deleteEmployees(ids: string[]): Promise<void> {
  await prisma.employee.deleteMany({ where: { id: { in: ids } } });
}

export type BulkImportError = {
  row: number;
  nip?: string;
  nik?: string;
  nama?: string;
  message: string;
};

export type BulkUpsertResult = {
  created: number;
  updated: number;
  errors: number;
  errorDetails: BulkImportError[];
};

const BULK_CHUNK = 40;

/**
 * Bulk import with per-row errors and chunked transactions.
 * Match key: NIP first, else NIK.
 */
export async function bulkUpsertEmployees(
  rows: Record<string, unknown>[],
): Promise<BulkUpsertResult> {
  let created = 0;
  let updated = 0;
  const errorDetails: BulkImportError[] = [];

  const existingByNip = new Map<string, string>();
  const existingByNik = new Map<string, string>();
  const all = await prisma.employee.findMany({ select: { id: true, nip: true, nik: true } });
  for (const e of all) {
    const nip = String(e.nip ?? "").trim();
    const nik = String(e.nik ?? "").trim();
    if (nip) existingByNip.set(nip, e.id);
    if (nik) existingByNik.set(nik, e.id);
  }

  type Op =
    | { kind: "create"; row: number; data: Record<string, unknown>; nipKey: string; nikKey: string; nama: string }
    | { kind: "update"; row: number; id: string; data: Record<string, unknown>; nipKey: string; nikKey: string; nama: string };

  const ops: Op[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const normalized = normalizeEmployeeForImport(rows[i] as Record<string, unknown>);
    const parsed = EmployeeSchema.safeParse(normalized);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      errorDetails.push({
        row: rowNum,
        nip: String(normalized.nip || ""),
        nik: String(normalized.nik || ""),
        nama: String(normalized.nama || ""),
        message: first
          ? `${first.path.join(".") || "data"}: ${first.message}`
          : "Data tidak valid",
      });
      continue;
    }
    const emp = parsed.data;
    const nipKey = emp.nip?.trim() || "";
    const nikKey = emp.nik?.trim() || "";
    if (!nipKey && !nikKey) {
      errorDetails.push({
        row: rowNum,
        nama: emp.nama,
        message: "NIP atau NIK wajib diisi untuk match impor",
      });
      continue;
    }
    const existingId =
      (nipKey && existingByNip.get(nipKey)) ||
      (nikKey && existingByNik.get(nikKey)) ||
      undefined;
    const data = toPersistence(emp) as Record<string, unknown>;
    if (existingId) {
      ops.push({
        kind: "update",
        row: rowNum,
        id: existingId,
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
        if (op.kind === "update") {
          updated++;
        } else {
          created++;
          // IDs for new rows not in map yet — next chunks in same import
          // may not need them if NIP unique; refresh maps from op keys is incomplete without id.
        }
      }
      // Re-fetch ids for created rows in this chunk (for in-batch duplicate NIPs)
      if (chunk.some((c) => c.kind === "create")) {
        const createdNips = chunk.filter((c) => c.kind === "create" && c.nipKey).map((c) => c.nipKey);
        const createdNiks = chunk.filter((c) => c.kind === "create" && c.nikKey).map((c) => c.nikKey);
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
            if (e.nip) existingByNip.set(String(e.nip).trim(), e.id);
            if (e.nik) existingByNik.set(String(e.nik).trim(), e.id);
          }
        }
      }
    } catch {
      // Fall back to per-row so one conflict doesn't kill the chunk
      for (const op of chunk) {
        try {
          if (op.kind === "update") {
            await prisma.employee.update({
              where: { id: op.id },
              data: op.data as never,
            });
            updated++;
          } else {
            const created_row = await prisma.employee.create({ data: op.data as never });
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

  return {
    created,
    updated,
    errors: errorDetails.length,
    errorDetails: errorDetails.slice(0, 50), // cap payload
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
