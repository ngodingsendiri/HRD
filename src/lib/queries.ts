/**
 * Data access layer — the ONLY place that touches Prisma directly.
 * Computed fields (masaKerja, kelasJabatan,
 * bebanKerja, pensiun) are attached at read time, never persisted.
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
import { calculateMasaKerja } from "./employeeUtils.js";
import { lookupKamus } from "./kamus.js";

// Re-export for backwards compatibility (server code may import from here).
export { lookupKamus };

// --- Internal: map a Prisma row to the app Employee shape ---
type PrismaEmployee = {
  id: string;
  [k: string]: unknown;
  dataKeluarga: unknown;
};

function rowToEmployee(row: PrismaEmployee, kamusCsv?: string): EmployeeT {
  const parsed = EmployeeSchema.safeParse({
    id: row.id,
    nik: String(row.nik ?? ""),
    nama: String(row.nama ?? ""),
    nip: String(row.nip ?? ""),
    jk: (row.jk === "P" ? "P" : "L"),
    tempatLahir: String(row.tempatLahir ?? ""),
    tanggalLahir: String(row.tanggalLahir ?? ""),
    jalanDusun: String(row.jalanDusun ?? ""),
    rt: String(row.rt ?? ""),
    rw: String(row.rw ?? ""),
    desaKelurahan: String(row.desaKelurahan ?? ""),
    kecamatan: String(row.kecamatan ?? ""),
    kabupaten: String(row.kabupaten ?? ""),
    jabatan: String(row.jabatan ?? ""),
    bidang: String(row.bidang ?? ""),
    status: row.status,
    tmtKerja: String(row.tmtKerja ?? ""),
    pangkat: String(row.pangkat ?? ""),
    gol: String(row.gol ?? ""),
    pangkatGolongan: String(row.pangkatGolongan ?? ""),
    tmtGolonganRuang: String(row.tmtGolonganRuang ?? ""),
    masaKerjaGolonganRuang: String(row.masaKerjaGolonganRuang ?? ""),
    tanggalBerkalaTerakhir: String(row.tanggalBerkalaTerakhir ?? ""),
    gajiPokok: String(row.gajiPokok ?? ""),
    besaranGajiKotor: String(row.besaranGajiKotor ?? ""),
    digajiMenurut: String(row.digajiMenurut ?? ""),
    noRekeningBank: String(row.noRekeningBank ?? ""),
    npwp: String(row.npwp ?? ""),
    nomorKarpeg: String(row.nomorKarpeg ?? ""),
    pendidikan: String(row.pendidikan ?? ""),
    jurusan: String(row.jurusan ?? ""),
    diklatJenjang: String(row.diklatJenjang ?? ""),
    tahunDiklat: String(row.tahunDiklat ?? ""),
    statusKawin: String(row.statusKawin ?? ""),
    agama: String(row.agama ?? ""),
    nomorHp: String(row.nomorHp ?? ""),
    sisaCutiN: String(row.sisaCutiN ?? ""),
    sisaCutiN1: String(row.sisaCutiN1 ?? ""),
    sisaCutiN2: String(row.sisaCutiN2 ?? ""),
    skTerakhir: String(row.skTerakhir ?? ""),
    jumlahTertanggung: Number(row.jumlahTertanggung ?? 0),
    dataKeluarga: (row.dataKeluarga as FamilyMemberT[]) ?? [],
    createdAt: row.createdAt as number | undefined,
    updatedAt: row.updatedAt as number | undefined,
  });
  // If status union fails, coerce to "Lainnya" rather than throwing.
  const emp = parsed.success
    ? parsed.data
    : ({
        ...row,
        nama: String(row.nama ?? ""),
        nik: String(row.nik ?? ""),
        nip: String(row.nip ?? ""),
        status: "Lainnya",
        dataKeluarga: (row.dataKeluarga as FamilyMemberT[]) ?? [],
        jumlahTertanggung: Number(row.jumlahTertanggung ?? 0),
      } as EmployeeT);

  // --- Attach computed fields (never persisted) ---
  (emp as EmployeeT & { masaKerja: string }).masaKerja =
    computeMasaKerja(emp) ?? "";

  const { kelas, beban } = lookupKamus(emp.jabatan, kamusCsv);
  (emp as EmployeeT & { kelasJabatan: string; bebanKerja: string }).kelasJabatan = kelas;
  (emp as EmployeeT & { bebanKerja: string }).bebanKerja = beban;

  return emp as EmployeeT;
}

function computeMasaKerja(emp: EmployeeT): string | null {
  const statusVal = (emp.status || "").toUpperCase();
  // PNS/CPNS: derive from NIP digits 9-14
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
  // PPPK / others: derive from tmtKerja
  if (emp.tmtKerja) return calculateMasaKerja(emp.tmtKerja);
  return null;
}

// ============ Employees ============

export interface GetEmployeesOptions {
  q?: string;
  limit?: number;
  offset?: number;
}

export async function getEmployees(
  kamusCsv?: string,
  opts?: GetEmployeesOptions,
): Promise<EmployeeT[]> {
  const q = opts?.q?.trim();
  const take = opts?.limit;
  const skip = opts?.offset;

  const rows = await prisma.employee.findMany({
    orderBy: { nama: "asc" },
    ...(take != null ? { take } : {}),
    ...(skip != null ? { skip } : {}),
    ...(q
      ? {
          where: {
            OR: [
              { nama: { contains: q, mode: "insensitive" } },
              { nip: { contains: q, mode: "insensitive" } },
              { nik: { contains: q, mode: "insensitive" } },
              { jabatan: { contains: q, mode: "insensitive" } },
              { bidang: { contains: q, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  });
  return rows.map((r: PrismaEmployee) => rowToEmployee(r, kamusCsv));
}

export async function getEmployee(id: string, kamusCsv?: string): Promise<EmployeeT | null> {
  const row = await prisma.employee.findUnique({ where: { id } });
  if (!row) return null;
  return rowToEmployee(row as unknown as PrismaEmployee, kamusCsv);
}

/**
 * Find an employee id by NIP or NIK (non-empty keys only).
 * When `excludeId` is set, ignores that row (for update conflict checks).
 */
export async function findEmployeeIdByNipOrNik(
  nip?: string | null,
  nik?: string | null,
  excludeId?: string,
): Promise<string | null> {
  const nipKey = nip?.trim() || "";
  const nikKey = nik?.trim() || "";
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

/** Strip computed fields before persisting (they are re-derived on read). */
function toPersistence(emp: Partial<EmployeeT>) {
  const { masaKerja, kelasJabatan, bebanKerja, pensiun, id, ...rest } = emp as Record<
    string,
    unknown
  >;
  void masaKerja;
  void kelasJabatan;
  void bebanKerja;
  void pensiun;
  void id;
  return rest;
}

export async function createEmployee(emp: EmployeeT): Promise<EmployeeT> {
  const created = await prisma.employee.create({ data: toPersistence(emp) as never });
  return rowToEmployee(created as unknown as PrismaEmployee);
}

export async function updateEmployee(id: string, emp: Partial<EmployeeT>): Promise<EmployeeT> {
  const updated = await prisma.employee.update({
    where: { id },
    data: toPersistence(emp) as never,
  });
  return rowToEmployee(updated as unknown as PrismaEmployee);
}

export async function deleteEmployee(id: string): Promise<void> {
  await prisma.employee.delete({ where: { id } });
}

export async function deleteEmployees(ids: string[]): Promise<void> {
  await prisma.employee.deleteMany({ where: { id: { in: ids } } });
}

/**
 * Bulk import: match each incoming row against existing employees by nip/nik,
 * update if found, create otherwise. Returns counts.
 *
 * Invalid rows are skipped (counted in `errors`) so one bad row does not abort
 * the whole import.
 */
export async function bulkUpsertEmployees(
  rows: Record<string, unknown>[],
): Promise<{ created: number; updated: number; errors: number }> {
  let created = 0;
  let updated = 0;
  let errors = 0;

  // Build lookup maps for existing rows (only non-empty keys)
  const existingByNip = new Map<string, string>();
  const existingByNik = new Map<string, string>();
  const all = await prisma.employee.findMany({ select: { id: true, nip: true, nik: true } });
  for (const e of all) {
    const nip = String(e.nip ?? "").trim();
    const nik = String(e.nik ?? "").trim();
    if (nip) existingByNip.set(nip, e.id);
    if (nik) existingByNik.set(nik, e.id);
  }

  for (const row of rows) {
    const parsed = EmployeeSchema.safeParse(row);
    if (!parsed.success) {
      errors++;
      continue;
    }
    const emp = parsed.data;
    const nipKey = emp.nip?.trim() || "";
    const nikKey = emp.nik?.trim() || "";
    const existingId =
      (nipKey && existingByNip.get(nipKey)) || (nikKey && existingByNik.get(nikKey)) || undefined;

    try {
      if (existingId) {
        await prisma.employee.update({
          where: { id: existingId },
          data: toPersistence(emp) as never,
        });
        updated++;
      } else {
        const created_row = await prisma.employee.create({ data: toPersistence(emp) as never });
        if (nipKey) existingByNip.set(nipKey, created_row.id);
        if (nikKey) existingByNik.set(nikKey, created_row.id);
        created++;
      }
    } catch {
      errors++;
    }
  }

  return { created, updated, errors };
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

export async function getSettings(): Promise<AppSettingsT> {
  const row = await prisma.settings.findUnique({ where: { id: "app" } });
  if (!row) return SETTINGS_DEFAULT;
  const parsed = AppSettingsSchema.safeParse(row.data);
  return parsed.success
    ? { ...SETTINGS_DEFAULT, ...parsed.data }
    : { ...SETTINGS_DEFAULT, ...(row.data as object) };
}

export async function upsertSettings(settings: AppSettingsT): Promise<AppSettingsT> {
  await prisma.settings.upsert({
    where: { id: "app" },
    create: { id: "app", data: settings as never },
    update: { data: settings as never },
  });
  return settings;
}
