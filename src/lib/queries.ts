/**
 * Data access layer — the ONLY place that touches Prisma directly.
 * Data access layer — the ONLY place that touches Prisma directly.
 * Computed fields (masaKerja, kelasJabatan,
 * bebanKerja, pensiun) are attached at read time, never persisted.
 */
import { prisma } from "./db";
import {
  EmployeeSchema,
  AppSettingsSchema,
  type EmployeeT,
  type AppSettingsT,
  type FamilyMemberT,
} from "./schemas";
import { DEFAULT_KAMUS } from "../constants";
import { calculateMasaKerja } from "./employeeUtils";
import { lookupKamus } from "./kamus";

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
  const emp = parsed.success ? parsed.data : { ...row, status: "Lainnya" } as EmployeeT;

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
        if (months < 0) { years--; months += 12; }
        return `${years} Tahun ${months} Bulan`;
      }
    }
  }
  // PPPK / others: derive from tmtKerja
  if (emp.tmtKerja) return calculateMasaKerja(emp.tmtKerja);
  return null;
}

// ============ Employees ============

export async function getEmployees(kamusCsv?: string): Promise<EmployeeT[]> {
  const rows = await prisma.employee.findMany({ orderBy: { nama: "asc" } });
  return rows.map((r) => rowToEmployee(r as unknown as PrismaEmployee, kamusCsv));
}

export async function getEmployee(id: string, kamusCsv?: string): Promise<EmployeeT | null> {
  const row = await prisma.employee.findUnique({ where: { id } });
  if (!row) return null;
  return rowToEmployee(row as unknown as PrismaEmployee, kamusCsv);
}

/** Strip computed fields before persisting (they are re-derived on read). */
function toPersistence(emp: Partial<EmployeeT>) {
  const { masaKerja, kelasJabatan, bebanKerja, pensiun, id, ...rest } = emp as Record<string, unknown>;
  void masaKerja; void kelasJabatan; void bebanKerja; void pensiun; void id;
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
 * Input rows are NOT yet validated against EmployeeSchema — the import handler
 * in the client pre-maps Excel columns to the field names. We validate here
 * too and skip invalid rows (counted in `errors`) to avoid a single bad row
 * aborting the whole import.
 */
export async function bulkUpsertEmployees(
  rows: Record<string, unknown>[],
): Promise<{ created: number; updated: number; errors: number }> {
  let created = 0;
  let updated = 0;
  let errors = 0;

  // Build lookup maps for existing rows
  const existingByNip = new Map<string, string>();
  const existingByNik = new Map<string, string>();
  const all = await prisma.employee.findMany({ select: { id: true, nip: true, nik: true } });
  for (const e of all) {
    if (e.nip) existingByNip.set(String(e.nip).trim(), e.id);
    if (e.nik) existingByNik.set(String(e.nik).trim(), e.id);
  }

  for (const row of rows) {
    const parsed = EmployeeSchema.safeParse(row);
    if (!parsed.success) {
      errors++;
      continue;
    }
    const emp = parsed.data;
    const nipKey = emp.nip?.trim();
    const nikKey = emp.nik?.trim();
    const existingId = (nipKey && existingByNip.get(nipKey)) || (nikKey && existingByNik.get(nikKey));

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
  return parsed.success ? { ...SETTINGS_DEFAULT, ...parsed.data } : { ...SETTINGS_DEFAULT, ...(row.data as object) };
}

export async function upsertSettings(settings: AppSettingsT): Promise<AppSettingsT> {
  await prisma.settings.upsert({
    where: { id: "app" },
    create: { id: "app", data: settings as never },
    update: { data: settings as never },
  });
  return settings;
}
