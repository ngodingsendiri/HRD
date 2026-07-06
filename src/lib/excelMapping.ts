/**
 * Deterministic Excel header → field mapping.
 *
 * Replaces the old Gemini-based mapExcelColumnsWithAI. Uses synonym lists and
 * light normalization (strip dots/spaces, lowercase) to recognize common
 * header variants. No network calls, no API key, no cost, no privacy concerns.
 *
 * Returns a map of { excelHeader → appFieldName } for headers it can identify.
 */

interface FieldRule {
  field: string;
  synonyms: string[];
}

const RULES: FieldRule[] = [
  { field: "nama", synonyms: ["nama lengkap", "nama", "nama pegawai", "name"] },
  { field: "nik", synonyms: ["nik", "n i k", "no nik", "nomor induuk kependudukan"] },
  { field: "nip", synonyms: ["nip", "n i p", "no nip", "nomor induk pegawai"] },
  { field: "jk", synonyms: ["jk", "jenis kelamin", "kelamin", "gender", "l/p"] },
  { field: "tempatLahir", synonyms: ["tempat lahir", "tmpl", "tempat"] },
  { field: "tanggalLahir", synonyms: ["tanggal lahir", "tgl lahir", "tgl lahirt", "tanggal lahirt", "dob", "birth date", "tanggal lahirs"] },
  { field: "jalanDusun", synonyms: ["jalan/dusun", "jalan dusun", "alamat", "jalan", "alamat lengkap"] },
  { field: "rt", synonyms: ["rt", "r t"] },
  { field: "rw", synonyms: ["rw", "r w"] },
  { field: "desaKelurahan", synonyms: ["desa/kelurahan", "desa kelurahan", "kelurahan", "desa"] },
  { field: "kecamatan", synonyms: ["kecamatan", "kec"] },
  { field: "kabupaten", synonyms: ["kabupaten", "kab", "kota"] },
  { field: "kelasJabatan", synonyms: ["kelas jabatan"] },
  { field: "bebanKerja", synonyms: ["beban kerja"] },
  { field: "tmtKerja", synonyms: ["tmt kerja", "tmt cpns", "tmt"] },
  { field: "masaKerja", synonyms: ["masa kerja"] },
  { field: "pensiun", synonyms: ["pensiun", "pensiun (bup)", "bup"] },
  { field: "tmtGolonganRuang", synonyms: ["tmt golongan ruang", "tmt gol"] },
  { field: "masaKerjaGolonganRuang", synonyms: ["masa kerja golongan ruang"] },
  { field: "noRekeningBank", synonyms: ["no. rekening bank", "rekening", "no rekening", "norek"] },
  { field: "npwp", synonyms: ["npwp"] },
  { field: "pangkat", synonyms: ["pangkat"] },
  { field: "gol", synonyms: ["gol", "golongan"] },
  { field: "tanggalBerkalaTerakhir", synonyms: ["tanggal berkala terakhir", "tgl berkala", "kgb terakhir"] },
  { field: "gajiPokok", synonyms: ["gaji pokok"] },
  { field: "besaranGajiKotor", synonyms: ["besaran gaji kotor"] },
  { field: "digajiMenurut", synonyms: ["digaji menurut pp/sk", "digaji menurut"] },
  { field: "jabatan", synonyms: ["jabatan", "position", "job title"] },
  { field: "bidang", synonyms: ["bidang", "unit kerja", "divisi", "department"] },
  { field: "status", synonyms: ["status", "status kepegawaian"] },
  { field: "nomorKarpeg", synonyms: ["nomor karpeg", "no karpeg", "karpeg"] },
  { field: "pendidikan", synonyms: ["pendidikan", "jenjang pendidikan", "tingkat pendidikan"] },
  { field: "jurusan", synonyms: ["jurusan", "program studi"] },
  { field: "diklatJenjang", synonyms: ["diklat jenjang", "diklat"] },
  { field: "tahunDiklat", synonyms: ["tahun diklat"] },
  { field: "statusKawin", synonyms: ["status kawin", "status perkawinan", "perkawinan"] },
  { field: "agama", synonyms: ["agama", "religion"] },
  { field: "nomorHp", synonyms: ["nomor hp", "no hp", "nomo hp", "no. hp", "handphone", "telepon", "hp"] },
  { field: "sisaCutiN", synonyms: ["sisa cuti n", "sisa cuti tahunan n"] },
  { field: "sisaCutiN1", synonyms: ["sisa cuti n-1", "sisa cuti tahunan n1"] },
  { field: "sisaCutiN2", synonyms: ["sisa cuti n-2", "sisa cuti tahunan n2"] },
  { field: "skTerakhir", synonyms: ["sk terakhir", "sk terakhir yang dimiliki"] },
  { field: "jumlahTertanggung", synonyms: ["jumlah tertanggung"] },
  // Family columns are handled specially in handleImport (children loop).
];

function normalize(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[.\-_,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map an array of Excel headers to app field names. */
export function mapExcelHeaders(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const header of headers) {
    const norm = normalize(header);
    if (!norm) continue;
    // Skip row-number-ish headers
    if (norm === "no" || norm === "no urut" || /^nomor$/.test(norm)) continue;

    const rule = RULES.find((r) =>
      r.synonyms.some((syn) => normalize(syn) === norm),
    );
    if (rule) result[header] = rule.field;
  }
  return result;
}
