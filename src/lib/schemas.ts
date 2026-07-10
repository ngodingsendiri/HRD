import { z } from "zod";

/**
 * Single source of truth for all data definitions in the app.
 * Types in src/types.ts are derived from these schemas via z.infer.
 * Prisma schema (prisma/schema.prisma) and API validation also follow this.
 */

/** Trim + allow empty, or non-empty after trim. */
const optionalText = z.string().transform((s) => s.trim());

/** Required non-empty text after trim. */
const requiredText = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, "Wajib diisi"));

/**
 * NIK: empty (e.g. incomplete import) or exactly 16 digits.
 * Spaces/dashes stripped before check.
 */
export function isValidNik(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 0 || digits.length === 16;
}

/**
 * NIP: empty or 8–25 digits (spaces ignored). Covers classic 18-digit NIP and shorter codes.
 */
export function isValidNip(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 0 || (digits.length >= 8 && digits.length <= 25);
}

const nikField = z
  .string()
  .transform((s) => s.trim())
  .refine(isValidNik, { message: "NIK harus 16 digit angka (atau kosong)" });

const nipField = z
  .string()
  .transform((s) => s.trim())
  .refine(isValidNip, { message: "NIP harus 8–25 digit angka (atau kosong)" });

// --- Family member (nested object, stored as JSONB in Postgres) ---
export const FamilyMemberSchema = z.object({
  name: optionalText, // allow empty for legacy imports; form UI still prompts
  relation: z.enum(["Istri", "Suami", "Anak"]),
  birthDate: optionalText.optional(),
  marriageDate: optionalText.optional(),
  occupation: optionalText.optional(),
  description: optionalText.optional(),
});

// --- Employment status: unified union enforced across app and API layers ---
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
 *   They are kept as optional here for backward compatibility with imported data;
 *   new writes via the form/API ignore them.
 */
export const EmployeeSchema = z.object({
  id: z.string().optional(),

  // --- Identity ---
  nik: nikField,
  nama: requiredText,
  nip: nipField,
  jk: GenderSchema,
  tempatLahir: optionalText,
  tanggalLahir: optionalText,

  // --- Address ---
  jalanDusun: optionalText,
  rt: optionalText,
  rw: optionalText,
  desaKelurahan: optionalText,
  kecamatan: optionalText,
  kabupaten: optionalText,

  // --- Position ---
  jabatan: optionalText,
  bidang: optionalText,
  status: EmployeeStatusSchema,
  tmtKerja: optionalText,

  // --- Rank / grade ---
  pangkat: optionalText,
  gol: optionalText,
  pangkatGolongan: optionalText,
  tmtGolonganRuang: optionalText,
  masaKerjaGolonganRuang: optionalText,
  tanggalBerkalaTerakhir: optionalText,

  // --- Salary ---
  gajiPokok: optionalText,
  besaranGajiKotor: optionalText,
  digajiMenurut: optionalText,
  noRekeningBank: optionalText,
  npwp: optionalText,

  // --- Administrative ---
  nomorKarpeg: optionalText,
  pendidikan: optionalText,
  jurusan: optionalText,
  diklatJenjang: optionalText,
  tahunDiklat: optionalText,
  statusKawin: optionalText,
  agama: optionalText,
  nomorHp: optionalText,

  // --- Leave ---
  sisaCutiN: optionalText,
  sisaCutiN1: optionalText,
  sisaCutiN2: optionalText,
  skTerakhir: optionalText,

  // --- Family / dependents ---
  jumlahTertanggung: z.number().int().min(0).max(50),
  dataKeluarga: z.array(FamilyMemberSchema).max(50),

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
  jumlahTertanggung: z.number().int().min(0).max(50).default(0),
  dataKeluarga: z.array(FamilyMemberSchema).max(50).default([]),
});

// --- App settings (single shared document) ---
export const AppSettingsSchema = z.object({
  sekdaNama: optionalText,
  sekdaNip: optionalText,
  bupatiNama: optionalText,
  kopLine1: optionalText.optional(),
  kopLine2: optionalText.optional(),
  kopLine3: optionalText.optional(),
  kopLine4: optionalText.optional(),
  logoBase64: z.string().max(1_500_000).optional(),
  jabatanKamusCsv: z.string().max(5_000_000).optional(),
  petaJabatanCsv: z.string().max(5_000_000).optional(),
});

export type FamilyMemberT = z.infer<typeof FamilyMemberSchema>;
export type EmployeeStatusT = z.infer<typeof EmployeeStatusSchema>;
export type EmployeeT = z.infer<typeof EmployeeSchema>;
export type AppSettingsT = z.infer<typeof AppSettingsSchema>;
