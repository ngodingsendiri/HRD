/**
 * Deterministic Excel header → field mapping for employee import.
 * Synonyms align with IMPORT_COLUMNS in employeeImport.ts plus common variants.
 */

interface FieldRule {
  field: string;
  synonyms: string[];
}

const RULES: FieldRule[] = [
  { field: "nama", synonyms: ["nama lengkap", "nama", "nama pegawai", "name"] },
  { field: "nik", synonyms: ["nik", "n i k", "no nik", "nomor induk kependudukan"] },
  { field: "nip", synonyms: ["nip", "n i p", "no nip", "nomor induk pegawai"] },
  { field: "jk", synonyms: ["jk", "jenis kelamin", "kelamin", "gender", "l/p"] },
  { field: "tempatLahir", synonyms: ["tempat lahir", "tmpl", "tempat"] },
  {
    field: "tanggalLahir",
    synonyms: ["tanggal lahir", "tgl lahir", "dob", "birth date"],
  },
  {
    field: "jalanDusun",
    synonyms: ["jalan/dusun", "jalan dusun", "alamat", "jalan", "alamat lengkap"],
  },
  { field: "rt", synonyms: ["rt", "r t"] },
  { field: "rw", synonyms: ["rw", "r w"] },
  {
    field: "desaKelurahan",
    synonyms: ["desa/kelurahan", "desa kelurahan", "kelurahan", "desa"],
  },
  { field: "kecamatan", synonyms: ["kecamatan", "kec"] },
  { field: "kabupaten", synonyms: ["kabupaten", "kab", "kota"] },
  { field: "tmtKerja", synonyms: ["tmt kerja", "tmt cpns", "tmt pppk"] },
  {
    field: "tmtGolonganRuang",
    synonyms: ["tmt golongan ruang", "tmt gol", "tmt golongan"],
  },
  {
    field: "masaKerjaGolonganRuang",
    synonyms: ["masa kerja golongan ruang", "mkg", "masa kerja gol"],
  },
  {
    field: "noRekeningBank",
    synonyms: ["no rekening bank", "no. rekening bank", "rekening", "norek"],
  },
  { field: "npwp", synonyms: ["npwp"] },
  { field: "pangkat", synonyms: ["pangkat"] },
  { field: "gol", synonyms: ["gol", "golongan", "golongan ruang"] },
  {
    field: "tanggalBerkalaTerakhir",
    synonyms: [
      "tanggal berkala terakhir",
      "tgl berkala",
      "kgb terakhir",
      "tmt berkala",
    ],
  },
  { field: "gajiPokok", synonyms: ["gaji pokok"] },
  { field: "besaranGajiKotor", synonyms: ["besaran gaji kotor", "gaji kotor"] },
  {
    field: "digajiMenurut",
    synonyms: ["digaji menurut pp/sk", "digaji menurut", "dasar gaji"],
  },
  { field: "jabatan", synonyms: ["jabatan", "position", "job title", "nama jabatan"] },
  { field: "bidang", synonyms: ["bidang", "unit kerja", "divisi", "department"] },
  { field: "status", synonyms: ["status", "status kepegawaian", "status pegawai"] },
  { field: "nomorKarpeg", synonyms: ["nomor karpeg", "no karpeg", "karpeg"] },
  {
    field: "pendidikan",
    synonyms: ["pendidikan", "jenjang pendidikan", "tingkat pendidikan"],
  },
  { field: "jurusan", synonyms: ["jurusan", "program studi"] },
  { field: "diklatJenjang", synonyms: ["diklat jenjang", "diklat"] },
  { field: "tahunDiklat", synonyms: ["tahun diklat"] },
  {
    field: "statusKawin",
    synonyms: ["status kawin", "status perkawinan", "perkawinan"],
  },
  { field: "agama", synonyms: ["agama", "religion"] },
  {
    field: "nomorHp",
    synonyms: ["nomor hp", "no hp", "no. hp", "handphone", "telepon", "hp", "no telp"],
  },
  {
    field: "sisaCutiN",
    synonyms: ["sisa cuti n", "sisa cuti tahunan n", "sisa cuti"],
  },
  {
    field: "sisaCutiN1",
    synonyms: ["sisa cuti n-1", "sisa cuti n1", "sisa cuti tahunan n1"],
  },
  {
    field: "sisaCutiN2",
    synonyms: ["sisa cuti n-2", "sisa cuti n2", "sisa cuti tahunan n2"],
  },
  {
    field: "skTerakhir",
    synonyms: ["sk terakhir", "sk terakhir yang dimiliki"],
  },
  { field: "jumlahTertanggung", synonyms: ["jumlah tertanggung", "jml tertanggung"] },
  {
    field: "bupTanggal",
    synonyms: [
      "bup manual",
      "bup tanggal",
      "tmt pensiun manual",
      "tanggal pensiun manual",
      "override bup",
    ],
  },
  {
    field: "tmtKp",
    synonyms: [
      "tmt kp manual",
      "tmt kp",
      "dasar kp",
      "override tmt kp",
      "tanggal kp manual",
    ],
  },
  // Derived — mapper may still see them; import layer ignores via DERIVED_HEADERS
];

function normalize(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[.\-_,/()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map an array of Excel headers to app field names. */
export function mapExcelHeaders(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const header of headers) {
    const norm = normalize(header);
    if (!norm) continue;
    if (norm === "no" || norm === "no urut" || norm === "nomor") continue;

    const rule = RULES.find((r) =>
      r.synonyms.some((syn) => normalize(syn) === norm),
    );
    if (rule) result[header] = rule.field;
  }
  return result;
}
