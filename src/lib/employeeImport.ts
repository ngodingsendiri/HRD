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
 * - mode "patch" (default): only non-empty Excel cells update DB; empty = keep.
 * - mode "replace": full row write (blank cells clear stored fields).
 * - Status/JK tidak dikenali → baris ditolak (bukan default diam-diam).
 */
import type { Employee, EmployeeStatus, FamilyMember } from "../types.js";
import {
  calculateMasaKerja,
  validateAndExtractNIP,
  calculateBUP,
  checkKGBandKP,
  formatGolonganDisplay,
} from "./employeeUtils.js";
import { buildFamilyExportFields } from "./employeeExport.js";
import { mapExcelHeaders } from "./excelMapping.js";
import { lookupKamus } from "./kamus.js";
import { differenceInYears } from "date-fns";

/** How bulk import merges with existing rows. */
export type ImportMode = "patch" | "replace";

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
  {
    header: "Status",
    field: "status",
    hint: "PNS | CPNS | PPPK | PPPKPW | Honorer | Lainnya. Nilai lain ditolak.",
  },
  {
    header: "JK",
    field: "jk",
    hint: "L atau P. Wajib jika bukan NIP 18 digit PNS/CPNS. Nilai lain ditolak.",
  },
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
    hint: "Dasar prediksi KGB indikatif (+2 th / siklus pertama).",
  },
  {
    header: "BUP Manual",
    field: "bupTanggal",
    hint: "Opsional YYYY-MM-DD. Isi jika TMT pensiun beda dari hitungan otomatis.",
  },
  {
    header: "TMT KP Manual",
    field: "tmtKp",
    hint: "Opsional YYYY-MM-DD. Dasar prediksi KP indikatif (+4 th). Kosong = TMT Golongan.",
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

export type StatusResolve =
  | { kind: "empty" }
  | { kind: "ok"; status: EmployeeStatus }
  | { kind: "invalid"; raw: string };

/** Strict status parse — empty vs recognized vs garbage. */
export function resolveStatus(raw: unknown): StatusResolve {
  if (raw == null || String(raw).trim() === "") return { kind: "empty" };
  const s = String(raw)
    .toUpperCase()
    .replace(/\s+/g, "");
  // Order matters: CPNS before PNS, PPPKPW before PPPK
  if (s === "CPNS" || s.includes("CPNS")) return { kind: "ok", status: "CPNS" };
  if (
    s === "PPPKPW" ||
    s === "PPPK-PW" ||
    s === "PPPKP" ||
    s.includes("PPPKPW") ||
    s.includes("PPPKP")
  )
    return { kind: "ok", status: "PPPKPW" };
  if (s === "PPPK" || s.includes("PPPK")) return { kind: "ok", status: "PPPK" };
  if (s.includes("HONOR")) return { kind: "ok", status: "Honorer" };
  if (s === "LAINNYA" || s.includes("LAIN")) return { kind: "ok", status: "Lainnya" };
  // Exact PNS only — avoid mapping "PNSTEST" etc.
  if (s === "PNS") return { kind: "ok", status: "PNS" };
  return { kind: "invalid", raw: String(raw).trim() };
}

/** @deprecated prefer resolveStatus — maps empty/invalid to PNS for legacy callers */
export function parseStatus(raw: unknown): EmployeeStatus {
  const r = resolveStatus(raw);
  if (r.kind === "ok") return r.status;
  return "PNS";
}

export type JkResolve =
  | { kind: "empty" }
  | { kind: "ok"; jk: "L" | "P" }
  | { kind: "invalid"; raw: string };

export function resolveJk(raw: unknown): JkResolve {
  if (raw == null || String(raw).trim() === "") return { kind: "empty" };
  const s = String(raw).toUpperCase().trim();
  if (s.startsWith("L") || s === "1" || s.includes("PRIA") || s.includes("LAKI"))
    return { kind: "ok", jk: "L" };
  if (
    s.startsWith("P") ||
    s === "2" ||
    s.includes("WANITA") ||
    s.includes("PEREMPUAN")
  )
    return { kind: "ok", jk: "P" };
  return { kind: "invalid", raw: String(raw).trim() };
}

export function parseJk(raw: unknown): "L" | "P" | "" {
  const r = resolveJk(raw);
  if (r.kind === "ok") return r.jk;
  return "";
}

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

export function hasFamilyKeys(raw: Record<string, unknown>): boolean {
  if (Array.isArray(raw.dataKeluarga)) return true;
  return Object.keys(raw).some(
    (k) =>
      k.startsWith("spouse") ||
      k.startsWith("childName") ||
      k.startsWith("childBirth") ||
      k.startsWith("childMarriage") ||
      k.startsWith("childJob") ||
      k.startsWith("childNote"),
  );
}

function hasSpouseKeys(raw: Record<string, unknown>): boolean {
  return ["spouseName", "spouseBirth", "spouseMarriage", "spouseJob", "spouseNote"].some(
    (k) => k in raw,
  );
}

function hasChildSlotKeys(raw: Record<string, unknown>, n: 1 | 2 | 3 | 4 | 5): boolean {
  return (
    `childName${n}` in raw ||
    `childBirth${n}` in raw ||
    `childMarriage${n}` in raw ||
    `childJob${n}` in raw ||
    `childNote${n}` in raw
  );
}

// ─── Normalize one row for API / Prisma ──────────────────────────────────────

export type NormalizedImport = Record<string, unknown>;

export type NormalizeResult =
  | {
      ok: true;
      data: NormalizedImport;
      /** Keys included in `data` (for patch merge). */
      presentKeys: string[];
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
      nama?: string;
      nip?: string;
      nik?: string;
    };

export type NormalizeOptions = {
  mode?: ImportMode;
  /**
   * When true (create path / replace): fill full Employee shape with defaults.
   * When false (patch update): only keys present in Excel + machine fills.
   */
  full?: boolean;
};

/**
 * Coerce a sparse Excel-mapped row into employee fields.
 * Returns ok/error — never silently maps garbage status/JK to PNS/L.
 */
export function normalizeEmployeeForImport(
  raw: Record<string, unknown>,
  opts?: NormalizeOptions,
): NormalizeResult {
  const mode: ImportMode = opts?.mode ?? "patch";
  const full = opts?.full ?? mode === "replace";
  const warnings: string[] = [];
  const presentKeys = new Set<string>();

  const mark = (key: string) => presentKeys.add(key);
  const put = (data: NormalizedImport, key: string, value: unknown) => {
    data[key] = value;
    mark(key);
  };

  const data: NormalizedImport = {};

  // ── identity keys always considered if provided ──
  let nip = str(raw.nip).replace(/\s/g, "");
  const nipDigits = nip.replace(/\D/g, "");
  if (nipDigits) nip = nipDigits;
  let nik = str(raw.nik).replace(/\D/g, "");
  const nama = str(raw.nama);

  if ("nip" in raw || nip) put(data, "nip", nip);
  if ("nik" in raw || nik) put(data, "nik", nik);
  if ("nama" in raw || nama) put(data, "nama", nama);

  // ── status ──
  let status: EmployeeStatus | undefined;
  if ("status" in raw) {
    const rs = resolveStatus(raw.status);
    if (rs.kind === "invalid") {
      return {
        ok: false,
        error: `Status tidak dikenali: "${rs.raw}" (pakai PNS|CPNS|PPPK|PPPKPW|Honorer|Lainnya)`,
        nama,
        nip,
        nik,
      };
    }
    if (rs.kind === "ok") {
      status = rs.status;
      put(data, "status", status);
    } else if (full) {
      status = "PNS";
      put(data, "status", status);
      warnings.push("Status kosong → diisi PNS");
    }
  } else if (full) {
    status = "PNS";
    put(data, "status", status);
  }

  // ── JK ──
  let jk: "L" | "P" | "" = "";
  if ("jk" in raw) {
    const rj = resolveJk(raw.jk);
    if (rj.kind === "invalid") {
      return {
        ok: false,
        error: `JK tidak dikenali: "${rj.raw}" (pakai L atau P)`,
        nama,
        nip,
        nik,
      };
    }
    if (rj.kind === "ok") {
      jk = rj.jk;
      put(data, "jk", jk);
    }
  }

  // dates / text helpers — only if key in raw (patch) or full replace
  const takeText = (key: string, transform: (v: unknown) => string = str) => {
    if (full || key in raw) {
      put(data, key, transform(raw[key]));
    }
  };
  const takeDate = (key: string) => {
    if (full || key in raw) {
      put(data, key, excelDateToIso(raw[key]));
    }
  };

  takeText("tempatLahir");
  takeDate("tanggalLahir");
  takeText("jalanDusun");
  takeText("rt");
  takeText("rw");
  takeText("desaKelurahan");
  takeText("kecamatan");
  takeText("kabupaten");
  takeText("jabatan");
  takeText("bidang");
  takeDate("tmtKerja");
  // pangkat / gol / pangkatGolongan handled below (patch-safe composite)
  takeDate("tmtGolonganRuang");
  takeText("masaKerjaGolonganRuang");
  takeDate("tanggalBerkalaTerakhir");
  takeDate("bupTanggal");
  takeDate("tmtKp");
  takeText("gajiPokok");
  takeText("besaranGajiKotor");
  takeText("digajiMenurut");
  takeText("noRekeningBank");
  takeText("npwp");
  takeText("nomorKarpeg");
  takeText("pendidikan");
  takeText("jurusan");
  takeText("diklatJenjang");
  takeText("tahunDiklat");
  takeText("statusKawin");
  takeText("agama");
  takeText("nomorHp");
  takeText("sisaCutiN");
  takeText("sisaCutiN1");
  takeText("sisaCutiN2");
  takeText("skTerakhir");

  // NIP machine — ONLY on full create/replace.
  // Patch updates must not inject tgl lahir/TMT/JK just because NIP is present
  // (e.g. re-import sisa cuti alone would overwrite biodata).
  const statusForNip =
    status ||
    (typeof data.status === "string" ? (data.status as EmployeeStatus) : undefined);
  if (
    full &&
    nip &&
    (statusForNip === "PNS" || statusForNip === "CPNS" || !statusForNip)
  ) {
    const st = statusForNip === "CPNS" ? "CPNS" : "PNS";
    const extracted = validateAndExtractNIP(nip, st);
    if (
      extracted.tanggalLahir &&
      (!("tanggalLahir" in data) || !data.tanggalLahir)
    ) {
      put(data, "tanggalLahir", extracted.tanggalLahir);
      warnings.push("Tanggal lahir diisi dari NIP");
    }
    if (extracted.tmtKerja && (!("tmtKerja" in data) || !data.tmtKerja)) {
      put(data, "tmtKerja", extracted.tmtKerja);
      warnings.push("TMT kerja diisi dari NIP");
    }
    if (extracted.jk && !jk) {
      jk = extracted.jk;
      put(data, "jk", jk);
      warnings.push("JK diisi dari NIP");
    }
  }

  // Rank fields — patch must not rebuild pangkatGolongan from half a pair
  if (full || "pangkat" in raw) put(data, "pangkat", str(raw.pangkat));
  if (full || "gol" in raw) {
    const golRaw = str(raw.gol);
    put(data, "gol", golRaw ? formatGolonganDisplay(golRaw) : "");
  }
  if (full || "pangkatGolongan" in raw) {
    let pangkatGolongan = str(raw.pangkatGolongan);
    if (!pangkatGolongan) {
      const p = str(data.pangkat ?? raw.pangkat);
      const g = str(data.gol ?? raw.gol);
      if (p || g) pangkatGolongan = [p, g].filter(Boolean).join(" / ");
    }
    put(data, "pangkatGolongan", pangkatGolongan);
  } else if (full) {
    const p = str(data.pangkat);
    const g = str(data.gol);
    put(data, "pangkatGolongan", [p, g].filter(Boolean).join(" / "));
  } else if ("pangkat" in raw && "gol" in raw) {
    // Both present in patch Excel → safe to recompute composite
    const p = str(data.pangkat);
    const g = str(data.gol);
    put(data, "pangkatGolongan", [p, g].filter(Boolean).join(" / "));
  }

  // masa kerja golongan auto — only when TMT gol is in this payload (not every patch)
  const tmtGol = str(data.tmtGolonganRuang ?? "");
  if (
    tmtGol &&
    (full || "tmtGolonganRuang" in raw) &&
    (!("masaKerjaGolonganRuang" in data) || !data.masaKerjaGolonganRuang)
  ) {
    const mk = calculateMasaKerja(tmtGol);
    if (mk) put(data, "masaKerjaGolonganRuang", mk);
  }

  // Family
  // - full/replace: always set (build from flat or empty)
  // - patch + JSON array: replace
  // - patch + flat spouse/child columns: DO NOT put incomplete family here —
  //   bulkUpsert merges with existing via mergeFamilyPatch (preserves other members)
  if (Array.isArray(raw.dataKeluarga)) {
    put(data, "dataKeluarga", raw.dataKeluarga as FamilyMember[]);
    if (full || "jumlahTertanggung" in raw) {
      let jumlahTertanggung = Number(raw.jumlahTertanggung);
      if (!Number.isFinite(jumlahTertanggung) || jumlahTertanggung < 0) {
        jumlahTertanggung = (raw.dataKeluarga as FamilyMember[]).length;
      }
      put(data, "jumlahTertanggung", jumlahTertanggung);
    }
  } else if (full) {
    const dataKeluarga = buildFamilyFromFlat(raw, jk || "L");
    put(data, "dataKeluarga", dataKeluarga);
    let jumlahTertanggung = Number(raw.jumlahTertanggung);
    if (!Number.isFinite(jumlahTertanggung) || jumlahTertanggung < 0) {
      jumlahTertanggung = dataKeluarga.length;
    }
    put(data, "jumlahTertanggung", jumlahTertanggung);
  } else if ("jumlahTertanggung" in raw) {
    let jumlahTertanggung = Number(raw.jumlahTertanggung);
    if (!Number.isFinite(jumlahTertanggung) || jumlahTertanggung < 0) {
      jumlahTertanggung = 0;
    }
    put(data, "jumlahTertanggung", jumlahTertanggung);
  }

  // Create/replace must satisfy schema gender
  if (full && !data.jk) {
    return {
      ok: false,
      error:
        "JK wajib (L/P) — isi kolom JK atau gunakan NIP 18 digit PNS/CPNS",
      nama,
      nip,
      nik,
    };
  }
  if (full && !data.nama) {
    return { ok: false, error: "Nama wajib diisi", nama, nip, nik };
  }
  if (full && !data.nip && !data.nik) {
    return {
      ok: false,
      error: "NIP atau NIK wajib untuk match impor",
      nama,
      nip,
      nik,
    };
  }

  // Ensure full shape defaults for create/replace
  if (full) {
    const defaults: NormalizedImport = {
      nip: "",
      nik: "",
      nama: "",
      jk: "L",
      status: "PNS",
      tempatLahir: "",
      tanggalLahir: "",
      jalanDusun: "",
      rt: "",
      rw: "",
      desaKelurahan: "",
      kecamatan: "",
      kabupaten: "",
      jabatan: "",
      bidang: "",
      tmtKerja: "",
      pangkat: "",
      gol: "",
      pangkatGolongan: "",
      tmtGolonganRuang: "",
      masaKerjaGolonganRuang: "",
      tanggalBerkalaTerakhir: "",
      bupTanggal: "",
      tmtKp: "",
      gajiPokok: "",
      besaranGajiKotor: "",
      digajiMenurut: "",
      noRekeningBank: "",
      npwp: "",
      nomorKarpeg: "",
      pendidikan: "",
      jurusan: "",
      diklatJenjang: "",
      tahunDiklat: "",
      statusKawin: "",
      agama: "",
      nomorHp: "",
      sisaCutiN: "",
      sisaCutiN1: "",
      sisaCutiN2: "",
      skTerakhir: "",
      jumlahTertanggung: 0,
      dataKeluarga: [],
    };
    return {
      ok: true,
      data: { ...defaults, ...data },
      presentKeys: Object.keys({ ...defaults, ...data }),
      warnings,
    };
  }

  return {
    ok: true,
    data,
    presentKeys: [...presentKeys],
    warnings,
  };
}

/** Merge patch fields onto existing employee plain object (stored fields only). */
export function mergeEmployeePatch(
  existing: Record<string, unknown>,
  patch: NormalizedImport,
): NormalizedImport {
  const {
    masaKerja: _mk,
    kelasJabatan: _kj,
    bebanKerja: _bk,
    pensiun: _p,
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    ...base
  } = existing;
  void _mk;
  void _kj;
  void _bk;
  void _p;
  void _id;
  void _c;
  void _u;
  return { ...base, ...patch };
}

/** Warn when jabatan is set but missing from kamus. */
export function kamusWarningForJabatan(
  jabatan: string | undefined,
  kamusCsv?: string,
): string | null {
  const j = (jabatan || "").trim();
  if (!j) return null;
  const { kelas, beban } = lookupKamus(j, kamusCsv);
  if (!kelas && !beban) {
    return `Jabatan tidak ada di kamus: "${j}"`;
  }
  return null;
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

/**
 * Patch-safe family merge: only replace spouse / child slots that appear in Excel.
 * Prevents "isi nama pasangan saja" from wiping all children.
 */
export function mergeFamilyPatch(
  existing: FamilyMember[],
  raw: Record<string, unknown>,
  jk: "L" | "P" | "",
): FamilyMember[] {
  if (Array.isArray(raw.dataKeluarga)) {
    return raw.dataKeluarga as FamilyMember[];
  }

  let spouse = existing.find(
    (m) => m.relation === "Istri" || m.relation === "Suami",
  );
  const children = existing
    .filter((m) => m.relation === "Anak")
    .map((m) => ({ ...m }));

  if (hasSpouseKeys(raw)) {
    // Keep existing name if Excel only patches birth/job/etc.
    const name =
      "spouseName" in raw ? str(raw.spouseName) : spouse?.name || "";
    if (name) {
      spouse = {
        name,
        relation: jk === "P" ? "Suami" : "Istri",
        birthDate:
          "spouseBirth" in raw
            ? excelDateToIso(raw.spouseBirth) || undefined
            : spouse?.birthDate,
        marriageDate:
          "spouseMarriage" in raw
            ? excelDateToIso(raw.spouseMarriage) || undefined
            : spouse?.marriageDate,
        occupation:
          "spouseJob" in raw
            ? str(raw.spouseJob) || undefined
            : spouse?.occupation,
        description:
          "spouseNote" in raw
            ? str(raw.spouseNote) || undefined
            : spouse?.description,
      };
    } else if ("spouseName" in raw) {
      // Name explicitly empty in payload — drop spouse
      spouse = undefined;
    }
  }

  for (const n of [1, 2, 3, 4, 5] as const) {
    if (!hasChildSlotKeys(raw, n)) continue;
    const idx = n - 1;
    const prev = children[idx];
    const nameKey = `childName${n}`;
    const name = nameKey in raw ? str(raw[nameKey]) : prev?.name || "";
    if (!name && !prev) continue;
    if (!name && nameKey in raw) {
      // Name cleared — drop this slot
      children[idx] = { name: "", relation: "Anak" };
      continue;
    }
    children[idx] = {
      name: name || prev?.name || "",
      relation: "Anak",
      birthDate:
        `childBirth${n}` in raw
          ? excelDateToIso(raw[`childBirth${n}`]) || undefined
          : prev?.birthDate,
      marriageDate:
        `childMarriage${n}` in raw
          ? excelDateToIso(raw[`childMarriage${n}`]) || undefined
          : prev?.marriageDate,
      occupation:
        `childJob${n}` in raw
          ? str(raw[`childJob${n}`]) || undefined
          : prev?.occupation,
      description:
        `childNote${n}` in raw
          ? str(raw[`childNote${n}`]) || undefined
          : prev?.description,
    };
  }

  const out: FamilyMember[] = [];
  if (spouse?.name) out.push(spouse);
  for (const c of children) {
    if (c?.name) out.push(c);
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

    // Sparse field map only — server normalizes with mode patch|replace
    payload.push(raw);
  }

  return { payload, skipped };
}

// ─── Template & export builders ──────────────────────────────────────────────

/** Core columns for compact operator template (identity + rank + leave). */
export const IMPORT_CORE_FIELDS = new Set([
  "nama",
  "nip",
  "nik",
  "status",
  "jk",
  "tempatLahir",
  "tanggalLahir",
  "jabatan",
  "bidang",
  "tmtKerja",
  "pangkat",
  "gol",
  "tmtGolonganRuang",
  "tanggalBerkalaTerakhir",
  "bupTanggal",
  "tmtKp",
  "sisaCutiN",
  "sisaCutiN1",
  "sisaCutiN2",
  "nomorHp",
]);

export type TemplateVariant = "core" | "full";

export function columnsForTemplate(variant: TemplateVariant = "full"): ImportColumn[] {
  if (variant === "core") {
    return IMPORT_COLUMNS.filter((c) => IMPORT_CORE_FIELDS.has(String(c.field)));
  }
  return IMPORT_COLUMNS;
}

export function buildImportTemplateAoa(
  variant: TemplateVariant = "full",
): (string | number)[][] {
  const cols = columnsForTemplate(variant);
  const headers = cols.map((c) => c.header);
  // One sample row aligned with machine expectations
  const sample: (string | number)[] = cols.map((c) => {
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
      case "bupTanggal":
        return ""; // empty = hitung otomatis
      case "tmtKp":
        return ""; // empty = pakai TMT golongan
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

export function buildImportGuideAoa(variant: TemplateVariant = "full"): string[][] {
  const cols = columnsForTemplate(variant);
  return [
    ["Kolom", "Wajib?", "Keterangan"],
    ...cols.map((c) => [
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
      "1. Usia, Masa Kerja, Kelas, Beban, Prediksi KP/KGB dihitung sistem (indikatif*) — jangan diisi di sheet data.",
    ],
    [
      "2. NIP 18 digit (PNS/CPNS): Tanggal Lahir / TMT Kerja / JK kosong → diisi otomatis dari NIP.",
    ],
    [
      "3. Match update: NIP sama (atau NIK jika NIP kosong) = update, bukan double.",
    ],
    [
      "4. Jabatan sebaiknya sama teksnya dengan Kamus Jabatan di Pengaturan.",
    ],
    ["5. Format tanggal: YYYY-MM-DD (contoh 2021-10-01)."],
    [
      "6. Mode PATCH (default): sel kosong TIDAK menghapus data lama. Mode GANTI: sel kosong menimpa kosong.",
    ],
    [
      "7. Status/JK tidak dikenali → baris ditolak (bukan diubah diam-diam jadi PNS/L).",
    ],
    [
      "8. Impor = pratinjau dulu, baru terapkan. Template RINGKAS = kolom inti; LENGKAP = semua + keluarga.",
    ],
    [
      "9. BUP Manual / TMT KP Manual meng-override prediksi otomatis bila diisi (untuk kasus khusus Umpeg).",
    ],
    [
      "10. *Prediksi KP/KGB/BUP bersifat indikatif (bukan penetapan legal) kecuali diisi tanggal manual.",
    ],
    [
      "11. Patch keluarga: hanya kolom yang diisi yang berubah (pasangan/anak lain tetap).",
    ],
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
        usia = String(differenceInYears(today, birth));
      }
    }
    const bup =
      emp.pensiun ||
      calculateBUP(emp.tanggalLahir || "", emp.jabatan || "", emp.bupTanggal) ||
      "";
    const { kp, kgb } = checkKGBandKP(
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
    return {
      Nama: emp.nama || "",
      NIP: emp.nip || "",
      NIK: emp.nik || "",
      Usia: usia,
      "Masa Kerja": emp.masaKerja || "",
      "Kelas Jabatan": emp.kelasJabatan || "",
      "Beban Kerja": emp.bebanKerja || "",
      "Pensiun (BUP) indikatif": bup,
      "Prediksi KP indikatif*": kp.targetDate || "",
      "Prediksi KGB indikatif*": kgb.targetDate || "",
      "Override BUP Manual": emp.bupTanggal || "",
      "Override TMT KP": emp.tmtKp || "",
      Status: emp.status || "",
      Jabatan: emp.jabatan || "",
      Bidang: emp.bidang || "",
      Catatan:
        "*Prediksi indikatif (+4 th KP / siklus KGB) kecuali override manual diisi.",
    };
  });
}
