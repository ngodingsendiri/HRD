import { z } from "zod";

/**
 * Single source of truth for all data definitions in the app.
 * Types in src/types.ts are derived from these schemas via z.infer.
 * Prisma schema (prisma/schema.prisma) and API validation also follow this.
 */

// --- Family member (nested object, stored as JSONB in Postgres) ---
export const FamilyMemberSchema = z.object({
  name: z.string(),
  relation: z.enum(["Istri", "Suami", "Anak"]),
  birthDate: z.string().optional(),
  marriageDate: z.string().optional(),
  occupation: z.string().optional(),
  description: z.string().optional(),
});

// --- Employment status: unified union (fixes audit inconsistency across
//     types.ts, firestore.rules, gemini.ts, firebase-blueprint.json) ---
export const EmployeeStatusSchema = z.enum([
  "PNS",
  "CPNS",
  "PPPK",
  "PPPKPW",
  "Honorer",
  "Lainnya",
]);

// --- Gender ---
export const GenderSchema = z.enum(["L", "P"]);

/**
 * Employee schema.
 * NOTE on computed/derived fields:
 *   masaKerja, kelasJabatan, bebanKerja, pensiun are DERIVED at read time
 *   (see src/lib/employeeUtils.ts) and are NOT persisted to the database.
 *   They are kept as optional here only to tolerate legacy Firestore documents
 *   during migration; new writes ignore them.
 */
export const EmployeeSchema = z.object({
  id: z.string().optional(),

  // --- Identity ---
  nik: z.string(),
  nama: z.string(),
  nip: z.string(),
  jk: GenderSchema,
  tempatLahir: z.string(),
  tanggalLahir: z.string(),

  // --- Address ---
  jalanDusun: z.string(),
  rt: z.string(),
  rw: z.string(),
  desaKelurahan: z.string(),
  kecamatan: z.string(),
  kabupaten: z.string(),

  // --- Position ---
  jabatan: z.string(),
  bidang: z.string(),
  status: EmployeeStatusSchema,
  tmtKerja: z.string(),

  // --- Rank / grade ---
  pangkat: z.string(),
  gol: z.string(),
  pangkatGolongan: z.string(),
  tmtGolonganRuang: z.string(),
  masaKerjaGolonganRuang: z.string(),
  tanggalBerkalaTerakhir: z.string(),

  // --- Salary ---
  gajiPokok: z.string(),
  besaranGajiKotor: z.string(),
  digajiMenurut: z.string(),
  noRekeningBank: z.string(),
  npwp: z.string(),

  // --- Administrative ---
  nomorKarpeg: z.string(),
  pendidikan: z.string(),
  jurusan: z.string(),
  diklatJenjang: z.string(),
  tahunDiklat: z.string(),
  statusKawin: z.string(),
  agama: z.string(),
  nomorHp: z.string(),

  // --- Leave ---
  sisaCutiN: z.string(),
  sisaCutiN1: z.string(),
  sisaCutiN2: z.string(),
  skTerakhir: z.string(),

  // --- Family / dependents ---
  jumlahTertanggung: z.number(),
  dataKeluarga: z.array(FamilyMemberSchema),

  // --- Derived (NOT persisted; tolerated for legacy compatibility) ---
  masaKerja: z.string().optional(),
  kelasJabatan: z.string().optional(),
  bebanKerja: z.string().optional(),
  pensiun: z.string().optional(),

  // --- Timestamps ---
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

// Form-friendly version: derived fields are omitted from input, all text
// fields default to "" so react-hook-form can register them cleanly.
export const EmployeeFormSchema = EmployeeSchema.extend({
  jk: GenderSchema.default("L"),
  status: EmployeeStatusSchema.default("PNS"),
  jumlahTertanggung: z.number().default(0),
}).catchall(z.string().default(""));

// --- App settings (single shared document) ---
export const AppSettingsSchema = z.object({
  sekdaNama: z.string(),
  sekdaNip: z.string(),
  bupatiNama: z.string(),
  kopLine1: z.string().optional(),
  kopLine2: z.string().optional(),
  kopLine3: z.string().optional(),
  kopLine4: z.string().optional(),
  logoBase64: z.string().optional(),
  jabatanKamusCsv: z.string().optional(),
  petaJabatanCsv: z.string().optional(),
});

export type FamilyMemberT = z.infer<typeof FamilyMemberSchema>;
export type EmployeeStatusT = z.infer<typeof EmployeeStatusSchema>;
export type EmployeeT = z.infer<typeof EmployeeSchema>;
export type AppSettingsT = z.infer<typeof AppSettingsSchema>;
