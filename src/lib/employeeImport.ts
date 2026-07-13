/**
 * Single source of truth for employee Excel import / template / re-import export.
 *
 * Machine rules:
 * - Only STORED fields are on the import template (what Prisma persists).
 * - DERIVED fields (usia, masa kerja, kelas jabatan, BUP, prediksi KP/KGB)
 *   are computed at read time — never imported, never written by bulk upsert.
 * - NIP (18 digit, PNS/CPNS) can fill tanggalLahir, tmtKerja, jk when empty.
 * - masaKerjaGolonganRuang is auto-filled from tmtGolonganRuang when empty.
 * - Match key for upsert: NIP first, else NIK.
 */
import type { Employee, EmployeeStatus, FamilyMember } from "../types.js";
import {
  calculateMasaKerja,
  validateAndExtractNIP,
  calculateBUP,
  checkKGBandKP,
} from "./employeeUtils.js";
import { buildFamilyExportFields } from "./employeeExport.js";
import { mapExcelHeaders } from "./excelMapping.js";

// ─── Column definition (template header ↔ app field) ─────────────────────────

export type ImportColumn = {
  /** Exact Excel header on the template (must match import aliases). */
  header: string;
  /** App field, or special family/meta key. */
  field:
    | keyof Employee
    | "spouseName"
    | "spouseBirth"
    | "spouseMarriage"
    | "spouseJob"
    | "spouseNote"
    | `childName${1 | 2 | 3 | 4 | 5}`
    | `childBirth${1 | 2 | 3 | 4 | 5}`
    | `childMarriage${1 | 2 | 3 | 4 | 5}`
    | `childJob${1 | 2 | 3 | 4 | 5}`
    | `childNote${1 | 2 | 3 | 4 | 5}`;
  /** Shown on Petunjuk sheet. */
  hint: string;
  required?: boolean;
};

/**
 * Importable columns only — no Usia / Masa Kerja / Kelas / Beban / BUP / Prediksi.
 * Order is the template column order.
 */
export const IMPORT_COLUMNS: ImportColumn[] = [
  // Identity
  { header: "Nama", field: "nama", hint: "Wajib. Nama lengkap sesuai KTP.", required: true },
  { header: "NIP", field: "nip", hint: "18 digit untuk PNS/CPNS (mesin isi tgl lahir, TMT, JK jika kosong)." },
  { header: "NIK", field: "nik", hint: "16 digit. Dipakai match jika NIP kosong." },
  { header: "Status", field: "status", hint: "PNS | CPNS | PPPK | PPPKPW | Honorer | Lainnya" },
  { header: "JK", field: "jk", hint: "L atau P (bisa diisi otomatis dari NIP PNS/CPNS)." },
  { header: "Tempat Lahir", field: "tempatLahir", hint: "" },
  { header: "Tanggal Lahir", field: "tanggalLahir", hint: "YYYY-MM-DD atau tanggal Excel. Bisa dari NIP." },

  // Address
  { header: "Jalan/Dusun", field: "jalanDusun", hint: "" },
  { header: "RT", field: "rt", hint: "" },
  { header: "RW", field: "rw", hint: "" },
  { header: "Desa/Kelurahan", field: "desaKelurahan", hint: "" },
  { header: "Kecamatan", field: "kecamatan", hint: "" },
  { header: "Kabupaten", field: "kabupaten", hint: "" },

  // Position
  { header: "Jabatan", field: "jabatan", hint: "Harus cocok kamus jabatan agar kelas/beban terisi di sistem." },
  { header: "Bidang", field: "bidang", hint: "Unit kerja." },
  { header: "TMT Kerja", field: "tmtKerja", hint: "YYYY-MM-DD. PNS/CPNS bisa dari NIP." },

  // Rank / KGB base
  { header: "Pangkat", field: "pangkat", hint: "Contoh: Pembina Tk. I" },
  { header: "Gol", field: "gol", hint: "Contoh: IV/b atau IV.b" },
  { header: "TMT Golongan Ruang", field: "tmtGolonganRuang", hint: "Dasar prediksi KP (+4 th)." },
  {
    header: "Masa Kerja Golongan Ruang",
    field: "masaKerjaGolonganRuang",
    hint: "Opsional. Kosong = dihitung mesin dari TMT Golongan.",
  },
  {
    header: "Tanggal Berkala Terakhir",
    field: "tanggalBerkalaTerakhir",
    hint: "Dasar prediksi KGB (+2 th).",
  },

  // Salary
  { header: "Gaji Pokok", field: "gajiPokok", hint: "Teks bebas / angka." },
  { header: "Besaran Gaji Kotor", field: "besaranGajiKotor", hint: "" },
  { header: "Digaji Menurut PP/SK", field: "digajiMenurut", hint: "" },
  { header: "No. Rekening Bank", field: "noRekeningBank", hint: "" },
  { header: "NPWP", field: "npwp", hint: "" },

  // Admin
  { header: "Nomor Karpeg", field: "nomorKarpeg", hint: "" },
  { header: "Pendidikan", field: "pendidikan", hint: "Contoh: S1, S2" },
  { header: "Jurusan", field: "jurusan", hint: "" },
  { header: "Diklat Jenjang", field: "diklatJenjang", hint: "" },
  { header: "Tahun Diklat", field: "tahunDiklat", hint: "" },
  { header: "Status Kawin", field: "statusKawin", hint: "Kawin / Belum Kawin / dll." },
  { header: "Agama", field: "agama", hint: "" },
  { header: "Nomor HP", field: "nomorHp", hint: "" },

  // Leave / SK
  { header: "Sisa Cuti N", field: "sisaCutiN", hint: "Sisa cuti tahun berjalan." },
  { header: "Sisa Cuti N-1", field: "sisaCutiN1", hint: "" },
  { header: "Sisa Cuti N-2", field: "sisaCutiN2", hint: "" },
  { header: "SK Terakhir", field: "skTerakhir", hint: "" },

  // Family (flat → JSON dataKeluarga)
  { header: "Nama Istri/Suami", field: "spouseName", hint: "Relasi diisi otomatis dari JK pegawai." },
  { header: "Tanggal Lahir Pasangan", field: "spouseBirth", hint: "YYYY-MM-DD" },
  { header: "Tanggal Nikah Pasangan", field: "spouseMarriage", hint: "YYYY-MM-DD" },
  { header: "Pekerjaan Pasangan", field: "spouseJob", hint: "" },
  { header: "Keterangan Pasangan", field: "spouseNote", hint: "" },
  ...([1, 2, 3, 4, 5] as const).flatMap(
    (n) =>
      [
        { header: `Nama Anak ${n}`, field: `childName${n}` as const, hint: n === 1 ? "Maks 5 anak." : "" },
        { header: `Tanggal Lahir Anak ${n}`, field: `childBirth${n}` as const, hint: "" },
        { header: `Tanggal Nikah Anak ${n}`, field: `childMarriage${n}` as const, hint: "" },
        { header: `Pekerjaan Anak ${n}`, field: `childJob${n}` as const, hint: "" },
        { header: `Keterangan Anak ${n}`, field: `childNote${n}` as const, hint: "" },
      ] satisfies ImportColumn[],
  ),
  {
    header: "Jumlah Tertanggung",
    field: "jumlahTertanggung",
    hint: "Opsional. Kosong = dihitung dari data keluarga yang diisi.",
  },
];

/** Headers that import must ignore (report-only / legacy). */
export const DERIVED_HEADERS = new Set(
  [
    "usia",
    "kelas jabatan",
    "beban kerja",
    "masa kerja",
    "pensiun (bup)",
    "pensiun",
    "bup",
    "prediksi kenaikan pangkat (kp)",
    "prediksi kenaikan gaji berkala (kgb)",
    "prediksi kp",
    "prediksi kgb",
    "pangkat golongan",
  ].map((s) => s.toLowerCase()),
);

// ─── Date / status helpers ───────────────────────────────────────────────────

export function excelDateToIso(serial: unknown): string {
  if (serial == null || serial === "") return "";
  if (typeof serial === "number") {
    if (serial < 10000) return String(serial).trim();
    const utc_days = Math.floor(serial - 25569);
    const date_info = new Date(utc_days * 86400 * 1000);
    if (isNaN(date_info.getTime())) return String(serial);
    return date_info.toISOString().split("T")[0];
  }
  const s = String(serial).trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const d = m[1]!.padStart(2, "0");
    const mo = m[2]!.padStart(2, "0");
    return `${m[3]}-${mo}-${d}`;
  }
  // Already ISO-ish
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

export function parseStatus(raw: unknown): EmployeeStatus {
  const s = String(raw || "PNS")
    .toUpperCase()
    .replace(/\s+/g, "");
  if (s.includes("CPNS")) return "CPNS";
  if (s.includes("PPPKPW") || s === "PPPK-PW" || s.includes("PPPKP")) return "PPPKPW";
  if (s.includes("PPPK")) return "PPPK";
  if (s.includes("HONOR")) return "Honorer";
  if (s.includes("LAIN")) return "Lainnya";
  if (s.includes("PNS")) return "PNS";
  return "PNS";
}

export function parseJk(raw: unknown): "L" | "P" | "" {
  const s = String(raw || "")
    .toUpperCase()
    .trim();
  if (!s) return "";
  if (s.startsWith("L") || s === "1" || s.includes("PRIA") || s.includes("LAKI")) return "L";
  if (s.startsWith("P") || s === "2" || s.includes("WANITA") || s.includes("PEREMPUAN")) return "P";
  return "";
}

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

// ─── Normalize one row for API / Prisma ──────────────────────────────────────

export type NormalizedImport = Record<string, unknown>;

/**
 * Coerce a partial mapped row into a full Employee-shaped object ready for
 * EmployeeSchema / bulkUpsert. Applies machine enrichments.
 */
export function normalizeEmployeeForImport(
  raw: Record<string, unknown>,
): NormalizedImport {
  const status = parseStatus(raw.status);
  let nip = str(raw.nip).replace(/\s/g, "");
  let nik = str(raw.nik).replace(/\D/g, "") || str(raw.nik);
  // Keep NIP digits only for storage consistency
  const nipDigits = nip.replace(/\D/g, "");
  if (nipDigits) nip = nipDigits;

  let nama = str(raw.nama);
  let jk = parseJk(raw.jk);
  let tanggalLahir = excelDateToIso(raw.tanggalLahir);
  let tmtKerja = excelDateToIso(raw.tmtKerja);
  let tmtGolonganRuang = excelDateToIso(raw.tmtGolonganRuang);
  let tanggalBerkalaTerakhir = excelDateToIso(raw.tanggalBerkalaTerakhir);

  // NIP machine (PNS/CPNS, 18 digit)
  if (nip && (status === "PNS" || status === "CPNS")) {
    const extracted = validateAndExtractNIP(nip, status);
    if (!tanggalLahir && extracted.tanggalLahir) tanggalLahir = extracted.tanggalLahir;
    if (!tmtKerja && extracted.tmtKerja) tmtKerja = extracted.tmtKerja;
    if (!jk && extracted.jk) jk = extracted.jk;
  }

  if (!jk) jk = "L"; // schema requires L|P; default L when unknown

  const pangkat = str(raw.pangkat);
  const gol = str(raw.gol);
  let pangkatGolongan = str(raw.pangkatGolongan);
  if (!pangkatGolongan && (pangkat || gol)) {
    pangkatGolongan = [pangkat, gol].filter(Boolean).join(" / ");
  }

  let masaKerjaGolonganRuang = str(raw.masaKerjaGolonganRuang);
  if (!masaKerjaGolonganRuang && tmtGolonganRuang) {
    masaKerjaGolonganRuang = calculateMasaKerja(tmtGolonganRuang) || "";
  }

  // Family
  let dataKeluarga: FamilyMember[] = Array.isArray(raw.dataKeluarga)
    ? (raw.dataKeluarga as FamilyMember[])
    : [];

  if (dataKeluarga.length === 0) {
    dataKeluarga = buildFamilyFromFlat(raw, jk);
  }

  let jumlahTertanggung = Number(raw.jumlahTertanggung);
  if (!Number.isFinite(jumlahTertanggung) || jumlahTertanggung < 0) {
    jumlahTertanggung = dataKeluarga.length;
  }

  return {
    // identity
    nama,
    nip,
    nik,
    jk,
    status,
    tempatLahir: str(raw.tempatLahir),
    tanggalLahir,
    // address
    jalanDusun: str(raw.jalanDusun),
    rt: str(raw.rt),
    rw: str(raw.rw),
    desaKelurahan: str(raw.desaKelurahan),
    kecamatan: str(raw.kecamatan),
    kabupaten: str(raw.kabupaten),
    // position
    jabatan: str(raw.jabatan),
    bidang: str(raw.bidang),
    tmtKerja,
    // rank
    pangkat,
    gol,
    pangkatGolongan,
    tmtGolonganRuang,
    masaKerjaGolonganRuang,
    tanggalBerkalaTerakhir,
    // salary
    gajiPokok: str(raw.gajiPokok),
    besaranGajiKotor: str(raw.besaranGajiKotor),
    digajiMenurut: str(raw.digajiMenurut),
    noRekeningBank: str(raw.noRekeningBank),
    npwp: str(raw.npwp),
    // admin
    nomorKarpeg: str(raw.nomorKarpeg),
    pendidikan: str(raw.pendidikan),
    jurusan: str(raw.jurusan),
    diklatJenjang: str(raw.diklatJenjang),
    tahunDiklat: str(raw.tahunDiklat),
    statusKawin: str(raw.statusKawin),
    agama: str(raw.agama),
    nomorHp: str(raw.nomorHp),
    // leave
    sisaCutiN: str(raw.sisaCutiN),
    sisaCutiN1: str(raw.sisaCutiN1),
    sisaCutiN2: str(raw.sisaCutiN2),
    skTerakhir: str(raw.skTerakhir),
    // family
    jumlahTertanggung,
    dataKeluarga,
    // NEVER pass derived fields through — stripped explicitly
  };
}

function buildFamilyFromFlat(
  raw: Record<string, unknown>,
  jk: "L" | "P" | "",
): FamilyMember[] {
  const out: FamilyMember[] = [];
  const spouseName = str(raw.spouseName);
  if (spouseName) {
    out.push({
      name: spouseName,
      relation: jk === "P" ? "Suami" : "Istri",
      birthDate: excelDateToIso(raw.spouseBirth) || undefined,
      marriageDate: excelDateToIso(raw.spouseMarriage) || undefined,
      occupation: str(raw.spouseJob) || undefined,
      description: str(raw.spouseNote) || undefined,
    });
  }
  for (const n of [1, 2, 3, 4, 5] as const) {
    const name = str(raw[`childName${n}`]);
    if (!name) continue;
    out.push({
      name,
      relation: "Anak",
      birthDate: excelDateToIso(raw[`childBirth${n}`]) || undefined,
      marriageDate: excelDateToIso(raw[`childMarriage${n}`]) || undefined,
      occupation: str(raw[`childJob${n}`]) || undefined,
      description: str(raw[`childNote${n}`]) || undefined,
    });
  }
  return out;
}

// ─── Parse Excel grid → normalized payload ───────────────────────────────────

/**
 * Convert sheet_to_json header:1 grid into bulk-upsert payload rows.
 */
export function parseEmployeeImportGrid(
  rows: unknown[][],
): { payload: NormalizedImport[]; skipped: number } {
  if (!rows.length) return { payload: [], skipped: 0 };

  // Find header row
  let headerIdx = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = rows[i] || [];
    const cells = row.map((c) => String(c || "").toUpperCase().trim());
    const hasName = cells.some((s) => s === "NAMA" || s === "NAMA LENGKAP");
    const hasId = cells.some(
      (s) => s === "NIP" || s === "N I P" || s === "NIK" || s === "N I K",
    );
    if (hasName || hasId) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) headerIdx = 0;

  const headerRow = (rows[headerIdx] || []).map((h) => String(h || "").trim());
  const colIndex: Record<string, number> = {};
  headerRow.forEach((h, idx) => {
    if (h) colIndex[h.toUpperCase()] = idx;
  });

  // Map headers → logical import fields via template + excelMapping
  const fieldByCol: Record<number, string> = {};
  const mapped = mapExcelHeaders(headerRow);
  headerRow.forEach((h, idx) => {
    if (!h) return;
    const norm = h.toLowerCase().replace(/\s+/g, " ").trim();
    if (DERIVED_HEADERS.has(norm)) return;

    // Prefer exact template match
    const exact = IMPORT_COLUMNS.find(
      (c) => c.header.toUpperCase() === h.toUpperCase(),
    );
    if (exact) {
      fieldByCol[idx] = exact.field;
      return;
    }
    // Synonym mapper
    if (mapped[h]) {
      fieldByCol[idx] = mapped[h];
      return;
    }
  });

  // Also map family by normalized header text
  const familyAliases: Record<string, string> = {
    "NAMA ISTRI/SUAMI": "spouseName",
    "NAMA PASANGAN": "spouseName",
    "TANGGAL LAHIR PASANGAN": "spouseBirth",
    "TGL LAHIR PASANGAN": "spouseBirth",
    "TANGGAL NIKAH PASANGAN": "spouseMarriage",
    "PERKAWINAN PASANGAN": "spouseMarriage",
    "TGL NIKAH": "spouseMarriage",
    "TANGGAL NIKAH": "spouseMarriage",
    "PEKERJAAN PASANGAN": "spouseJob",
    "KETERANGAN PASANGAN": "spouseNote",
  };
  for (let n = 1; n <= 5; n++) {
    familyAliases[`NAMA ANAK ${n}`] = `childName${n}`;
    familyAliases[`TANGGAL LAHIR ANAK ${n}`] = `childBirth${n}`;
    familyAliases[`TGL LAHIR ANAK ${n}`] = `childBirth${n}`;
    familyAliases[`TANGGAL NIKAH ANAK ${n}`] = `childMarriage${n}`;
    familyAliases[`PERKAWINAN ANAK ${n}`] = `childMarriage${n}`;
    familyAliases[`TGL NIKAH ANAK ${n}`] = `childMarriage${n}`;
    familyAliases[`PEKERJAAN ANAK ${n}`] = `childJob${n}`;
    familyAliases[`KETERANGAN ANAK ${n}`] = `childNote${n}`;
  }

  headerRow.forEach((h, idx) => {
    if (fieldByCol[idx] != null) return;
    const key = h.toUpperCase().trim();
    if (familyAliases[key]) fieldByCol[idx] = familyAliases[key];
  });

  const payload: NormalizedImport[] = [];
  let skipped = 0;

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    if (!row || row.length === 0) continue;

    const raw: Record<string, unknown> = {};
    for (const [idxStr, field] of Object.entries(fieldByCol)) {
      const idx = Number(idxStr);
      const val = row[idx];
      if (val === undefined || val === null || val === "") continue;
      raw[field] = val;
    }

    // Skip empty / header-echo rows
    const nama = str(raw.nama);
    const nip = str(raw.nip);
    const nik = str(raw.nik);
    if (!nama && !nip && !nik) {
      skipped++;
      continue;
    }
    if (nama.toLowerCase().includes("nama lengkap") && !nip && !nik) {
      skipped++;
      continue;
    }

    payload.push(normalizeEmployeeForImport(raw));
  }

  return { payload, skipped };
}

// ─── Template & export builders ──────────────────────────────────────────────

export function buildImportTemplateAoa(): (string | number)[][] {
  const headers = IMPORT_COLUMNS.map((c) => c.header);
  // One sample row aligned with machine expectations
  const sample: (string | number)[] = IMPORT_COLUMNS.map((c) => {
    switch (c.field) {
      case "nama":
        return "Contoh Nama Lengkap, S.Kom.";
      case "nip":
        return "198301112001121002";
      case "nik":
        return "3509191101830005";
      case "status":
        return "PNS";
      case "jk":
        return "L";
      case "tempatLahir":
        return "Jember";
      case "tanggalLahir":
        return "1983-01-11";
      case "jalanDusun":
        return "Jl. Contoh No. 1";
      case "rt":
        return "001";
      case "rw":
        return "002";
      case "desaKelurahan":
        return "Contoh";
      case "kecamatan":
        return "Contoh";
      case "kabupaten":
        return "Jember";
      case "jabatan":
        return "Penata Kelola Sistem dan Teknologi Informasi";
      case "bidang":
        return "Sekretariat";
      case "tmtKerja":
        return "2001-12-01";
      case "pangkat":
        return "Penata";
      case "gol":
        return "III/c";
      case "tmtGolonganRuang":
        return "2021-10-01";
      case "masaKerjaGolonganRuang":
        return ""; // machine fills
      case "tanggalBerkalaTerakhir":
        return "2023-10-01";
      case "gajiPokok":
        return "3000000";
      case "besaranGajiKotor":
        return "4500000";
      case "digajiMenurut":
        return "PP 15 Tahun 2019";
      case "noRekeningBank":
        return "1234567890";
      case "npwp":
        return "";
      case "nomorKarpeg":
        return "";
      case "pendidikan":
        return "S1";
      case "jurusan":
        return "Informatika";
      case "diklatJenjang":
        return "";
      case "tahunDiklat":
        return "";
      case "statusKawin":
        return "Kawin";
      case "agama":
        return "Islam";
      case "nomorHp":
        return "081234567890";
      case "sisaCutiN":
        return "12";
      case "sisaCutiN1":
        return "0";
      case "sisaCutiN2":
        return "0";
      case "skTerakhir":
        return "";
      case "spouseName":
        return "Nama Pasangan";
      case "spouseBirth":
        return "1985-01-01";
      case "spouseMarriage":
        return "2010-06-01";
      case "spouseJob":
        return "Wiraswasta";
      case "spouseNote":
        return "";
      case "childName1":
        return "Anak Pertama";
      case "childBirth1":
        return "2012-05-10";
      case "childJob1":
        return "Pelajar";
      case "jumlahTertanggung":
        return ""; // machine counts
      default:
        return "";
    }
  });
  return [headers, sample];
}

export function buildImportGuideAoa(): string[][] {
  return [
    ["Kolom", "Wajib?", "Keterangan"],
    ...IMPORT_COLUMNS.map((c) => [
      c.header,
      c.required ? "Ya" : "Tidak",
      c.hint ||
        (c.field.startsWith("child") || c.field.startsWith("spouse")
          ? "Data keluarga (disimpan sebagai JSON)."
          : "Disimpan ke database."),
    ]),
    [],
    ["CATATAN MESIN"],
    [
      "1. Kolom Usia, Masa Kerja, Kelas Jabatan, Beban Kerja, Pensiun, Prediksi KP/KGB TIDAK perlu diisi — dihitung sistem.",
    ],
    [
      "2. NIP 18 digit (PNS/CPNS): jika Tanggal Lahir / TMT Kerja / JK kosong, diisi otomatis dari NIP.",
    ],
    [
      "3. Match update: baris dengan NIP yang sama (atau NIK jika NIP kosong) akan di-UPDATE, bukan double.",
    ],
    [
      "4. Jabatan sebaiknya sama teksnya dengan Kamus Jabatan di Pengaturan agar kelas/beban terisi.",
    ],
    ["5. Format tanggal disarankan YYYY-MM-DD (contoh 2021-10-01)."],
  ];
}

/** Export rows using the same headers as the import template (round-trip safe). */
export function buildReimportExportRows(employees: Employee[]): Record<string, string | number>[] {
  return employees.map((emp) => {
    const family = buildFamilyExportFields(emp.dataKeluarga);
    // Align family keys with NEW template headers
    const row: Record<string, string | number> = {};
    for (const col of IMPORT_COLUMNS) {
      switch (col.field) {
        case "spouseName":
          row[col.header] = family["Nama Istri/Suami"] ?? "";
          break;
        case "spouseBirth":
          row[col.header] = family["Tanggal Lahir Pasangan"] ?? "";
          break;
        case "spouseMarriage":
          row[col.header] =
            family["Tanggal Nikah Pasangan"] ||
            family["Perkawinan Pasangan"] ||
            "";
          break;
        case "spouseJob":
          row[col.header] = family["Pekerjaan Pasangan"] ?? "";
          break;
        case "spouseNote":
          row[col.header] = family["Keterangan Pasangan"] ?? "";
          break;
        case "childName1":
        case "childName2":
        case "childName3":
        case "childName4":
        case "childName5": {
          const n = col.field.slice(-1);
          row[col.header] = family[`Nama Anak ${n}`] ?? "";
          break;
        }
        case "childBirth1":
        case "childBirth2":
        case "childBirth3":
        case "childBirth4":
        case "childBirth5": {
          const n = col.field.slice(-1);
          row[col.header] = family[`Tanggal Lahir Anak ${n}`] ?? "";
          break;
        }
        case "childMarriage1":
        case "childMarriage2":
        case "childMarriage3":
        case "childMarriage4":
        case "childMarriage5": {
          const n = col.field.slice(-1);
          row[col.header] =
            family[`Tanggal Nikah Anak ${n}`] ||
            family[`Perkawinan Anak ${n}`] ||
            "";
          break;
        }
        case "childJob1":
        case "childJob2":
        case "childJob3":
        case "childJob4":
        case "childJob5": {
          const n = col.field.slice(-1);
          row[col.header] = family[`Pekerjaan Anak ${n}`] ?? "";
          break;
        }
        case "childNote1":
        case "childNote2":
        case "childNote3":
        case "childNote4":
        case "childNote5": {
          const n = col.field.slice(-1);
          row[col.header] = family[`Keterangan Anak ${n}`] ?? "";
          break;
        }
        case "jumlahTertanggung":
          row[col.header] = emp.jumlahTertanggung ?? 0;
          break;
        default: {
          const key = col.field as keyof Employee;
          const v = emp[key];
          row[col.header] = v == null ? "" : String(v);
        }
      }
    }
    return row;
  });
}

/** Report sheet: derived fields for human reading (not re-imported). */
export function buildDerivedReportRows(employees: Employee[]): Record<string, string>[] {
  const today = new Date();
  return employees.map((emp) => {
    let usia = "";
    if (emp.tanggalLahir) {
      const birth = new Date(emp.tanggalLahir);
      if (!isNaN(birth.getTime())) {
        const ageDate = new Date(today.getTime() - birth.getTime());
        usia = String(Math.abs(ageDate.getUTCFullYear() - 1970));
      }
    }
    const bup =
      emp.pensiun ||
      (emp.tanggalLahir ? calculateBUP(emp.tanggalLahir, emp.jabatan || "") : "") ||
      "";
    const { kp, kgb } = checkKGBandKP(
      emp.tmtGolonganRuang,
      emp.tanggalBerkalaTerakhir,
      {
        tmtKerja: emp.tmtKerja,
        status: emp.status,
        gol: emp.gol,
        pangkatGolongan: emp.pangkatGolongan,
      },
    );
    return {
      Nama: emp.nama || "",
      NIP: emp.nip || "",
      NIK: emp.nik || "",
      Usia: usia,
      "Masa Kerja": emp.masaKerja || "",
      "Kelas Jabatan": emp.kelasJabatan || "",
      "Beban Kerja": emp.bebanKerja || "",
      "Pensiun (BUP)": bup,
      "Prediksi KP": kp.targetDate || "",
      "Prediksi KGB": kgb.targetDate || "",
      Status: emp.status || "",
      Jabatan: emp.jabatan || "",
      Bidang: emp.bidang || "",
    };
  });
}
